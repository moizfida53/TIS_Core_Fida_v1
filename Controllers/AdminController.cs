using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Text.RegularExpressions;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

/// <summary>
/// Handles all administrative operations: employee management, cost centres,
/// countries, telephone assignment, delegation, and package configuration.
/// All data access goes through stored procedures — zero inline SQL.
/// </summary>
[RoleAuthorize(Roles.Administrator, Roles.SuperAdmin)]
public class AdminController : Controller
{
    private readonly DB _db;
    private readonly ILogger<AdminController> _logger;

    public AdminController(DB db, ILogger<AdminController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    public IActionResult Index()
    {
        if (HttpContext.Session.GetString("EmpRoleID") is null)
            return View("AccessDenied");

        return View("ManageEmployee");
    }

    public IActionResult Telephone()
    {
        // Manage Telephone is SuperAdmin-only per the legacy TelephoneController gate.
        if (HttpContext.Session.GetString("EmpLoginName") is null) return View("AccessDenied");
        if (HttpContext.Session.GetString("EmpRoleID") != "8")    return View("AccessDenied");
        return View("AddTelephone");
    }

    public IActionResult Delegate()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View("DelegateBills");

    public IActionResult Package()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View();

    // ── Employee ──────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetUser()
    {
        try
        {
            var username = HttpContext.Session.GetString("EmpLoginAs") ?? string.Empty;

            SqlParameter[] p =
            [
                new SqlParameter("@Username", SqlDbType.VarChar) { Value = username }
            ];

            var ds = _db.ExecuteStoredProcDataSet("sp_GetEmployee", p);

            var employees  = MapEmployees(ds.Tables[0]);
            var roles      = MapRoles(ds.Tables[1]);
            var countries  = MapCountries(ds.Tables[2]);
            var costCentres = MapCostCentres(ds.Tables[3]);
            var companies  = MapCompanies(ds.Tables[4]);

            return Json(new { dtEmp = employees, RoleList = roles, CountryList = countries, dtCC = costCentres, CompanyList = companies });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetUser", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Active Directory lookup (AD button on the Add Employee modal) ──────────
    // Pulls Employee Name, Department, Title, Employee Number, Email and Mobile
    // from AD by username. Attribute names + domain are configurable in
    // appsettings.json → ActiveDirectory.
    [HttpGet]
    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    public IActionResult AdLookup(string username, [FromServices] AdLookupService ad)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            AuditTrail("AdLookup", "AD search attempted with an empty username.");
            return Json(new { success = false, message = "Please enter a Username." });
        }

        if (!ad.IsConfigured)
        {
            AuditTrail("AdLookup", "AD search failed — ActiveDirectory:Domain is not configured in appsettings.json.");
            return Json(new { success = false, message = "Active Directory is not configured. Set the 'ActiveDirectory:Domain' key in appsettings.json." });
        }

        try
        {
            var user = ad.FindByUsername(username);
            if (user is null)
            {
                AuditTrail("AdLookup", $"AD search returned no user for '{username}'.");
                return Json(new { success = false, message = $"No AD user found for '{username}'." });
            }

            return Json(new
            {
                success = true,
                message = "User found.",
                data = new
                {
                    displayName    = user.DisplayName,
                    department     = user.Department,
                    title          = user.Title,
                    employeeNumber = user.EmployeeNumber,
                    email          = user.Email,
                    mobile         = user.Mobile,
                    samAccount     = user.SamAccount
                }
            });
        }
        catch (Exception ex)
        {
            AuditTrail("AdLookup", $"AD search failed for '{username}': {ex}");
            LogAuditFail("AdLookup", ex);
            return Json(new { success = false, message = $"AD lookup failed: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult AddEmployee([FromBody] EmployeeRequest request)
    {
        try
        {
            var emp = request.Emp;
            var cnt = request.Cnt;

            if (!IsValidName(emp.Name))
                return Json(new { myMessage = "Invalid employee name. Only letters, numbers, and spaces are allowed." });

            for (int i = 0; i < (cnt.SelectedValues?.Length ?? 0); i++)
            {
                _db.ExecuteStoredProc("sp_AddEmployee", BuildEmployeeParams(emp, cnt.SelectedValues![i], i, isUpdate: false));
            }

            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddEmployee", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateEmployee([FromBody] EmployeeRequest request)
    {
        try
        {
            var emp = request.Emp;
            var cnt = request.Cnt;

            if (!IsValidName(emp.Name))
                return Json(new { myMessage = "Invalid employee name. Only letters, numbers, and spaces are allowed." });

            for (int i = 0; i < (cnt.SelectedValues?.Length ?? 0); i++)
            {
                _db.ExecuteStoredProc("sp_UpdateEmployee", BuildEmployeeUpdateParams(emp, cnt.SelectedValues![i], i));
            }

            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateEmployee", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteEmployee([FromBody] EmployeeDetails emp)
    {
        try
        {
            var uid = HttpContext.Session.GetString("EmpUID") ?? "0";
            SqlParameter[] p =
            [
                new SqlParameter("@UID",     SqlDbType.VarChar) { Value = emp.Uid },
                new SqlParameter("@UserUid", SqlDbType.Int)     { Value = int.Parse(uid) }
            ];

            _db.ExecuteStoredProc("sp_DeleteEmployee", p);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteEmployee", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Cost Centres ──────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetCC()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetCC");
            return Json(new { dtCC = MapCostCentres(ds.Tables[0]), CountryList = MapCountries(ds.Tables[1]) });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetCC", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult AddCC([FromBody] CostCenter cc)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command",    SqlDbType.Int)     { Value = 1 },
                new SqlParameter("@NAME",       SqlDbType.VarChar) { Value = cc.CcName },
                new SqlParameter("@EMPLOYEENO", SqlDbType.VarChar) { Value = cc.CcNum ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_ManageCC", p);
            return Json(new { myMessage = "Added Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddCC", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateCC([FromBody] CostCenter cc)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command",    SqlDbType.Int)     { Value = 2 },
                new SqlParameter("@UID",        SqlDbType.VarChar) { Value = cc.Uid },
                new SqlParameter("@NAME",       SqlDbType.VarChar) { Value = cc.CcName },
                new SqlParameter("@EMPLOYEENO", SqlDbType.VarChar) { Value = cc.CcNum ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_ManageCC", p);
            return Json(new { myMessage = "Updated Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateCC", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteCC([FromBody] CostCenter cc)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command", SqlDbType.Int)     { Value = 3 },
                new SqlParameter("@UID",     SqlDbType.VarChar) { Value = cc.Uid }
            ];
            _db.ExecuteStoredProc("sp_ManageCC", p);
            return Json(new { myMessage = "Deleted Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteCC", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Countries ─────────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult AddCountry([FromBody] Country con)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@COUNTRYNAME", SqlDbType.VarChar)  { Value = con.CountryName },
                new SqlParameter("@COUNTRYCODE", SqlDbType.VarChar)  { Value = con.CountryCode  ?? (object)DBNull.Value },
                new SqlParameter("@SHAYACODE",   SqlDbType.VarChar)  { Value = con.ShayaCode    ?? (object)DBNull.Value },
                new SqlParameter("@EXCHANGERATE",SqlDbType.Decimal)  { Value = con.ExchangeRate },
                new SqlParameter("@CURRENCY",    SqlDbType.VarChar)  { Value = con.Currency     ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_AddCountry", p);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddCountry", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateCountry([FromBody] Country con)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@COUNTRYID",   SqlDbType.Int)      { Value = con.CountryId },
                new SqlParameter("@COUNTRYNAME", SqlDbType.VarChar)  { Value = con.CountryName },
                new SqlParameter("@COUNTRYCODE", SqlDbType.VarChar)  { Value = con.CountryCode  ?? (object)DBNull.Value },
                new SqlParameter("@SHAYACODE",   SqlDbType.VarChar)  { Value = con.ShayaCode    ?? (object)DBNull.Value },
                new SqlParameter("@EXCHANGERATE",SqlDbType.Decimal)  { Value = con.ExchangeRate },
                new SqlParameter("@CURRENCY",    SqlDbType.VarChar)  { Value = con.Currency     ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_UpdateCountry", p);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateCountry", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteCountry([FromBody] Country con)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@COUNTRYID", SqlDbType.Int) { Value = con.CountryId }
            ];
            _db.ExecuteStoredProc("sp_DeleteCountry", p);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteCountry", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Manager ───────────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult AddManager([FromBody] EmployeeDetails man)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@NAME",       SqlDbType.VarChar) { Value = man.Name },
                new SqlParameter("@EMPLOYEENO", SqlDbType.VarChar) { Value = man.EmployeeNo ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_AddManager", p);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddManager", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateManager([FromBody] CostCenter man)
    {
        // Currently a no-op in the original; stub retained for API compatibility
        return Json(new { Message = "Success" });
    }

    [HttpPost]
    public IActionResult DeleteManager([FromBody] CostCenter man)
    {
        // Currently a no-op in the original; stub retained for API compatibility
        return Json(new { Message = "Success" });
    }

    // ── Telephone / Subscription Numbers ─────────────────────────────────────

    [HttpGet]
    public IActionResult GetTelData()
    {
        try
        {
            var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
            var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

            SqlParameter[] p =
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ];

            var ds        = _db.ExecuteStoredProcDataSet("sp_GetTelData", p);
            var telephones = MapTelephones(ds.Tables[0]);
            var unassigned = MapUnassigned(ds.Tables[0]);
            var assigned   = MapAssigned(ds.Tables[1]);
            var providers  = MapProviders(ds.Tables[2]);
            var employees  = MapEmployeeList(ds.Tables[3]);

            return Json(new { dtTel = telephones, dtUnAsg = unassigned, dtAsg = assigned, dtProvider = providers, dtEmp = employees });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetTelData", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetTelNo()
    {
        try
        {
            var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
            var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

            SqlParameter[] p =
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@Command",   SqlDbType.Int) { Value = 1 },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ];

            var ds = _db.ExecuteStoredProcDataSet("sp_GetNumber", p);
            var telephones = MapTelephones(ds.Tables[0]);
            var unassigned = MapUnassigned(ds.Tables[0]);

            return Json(new { dtTel = telephones, dtUnAsg = unassigned });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetTelNo", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetAsgNo()
    {
        try
        {
            var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
            var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

            SqlParameter[] p =
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@Command",   SqlDbType.Int) { Value = 2 },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ];

            var ds = _db.ExecuteStoredProcDataSet("sp_GetNumber", p);
            return Json(new
            {
                dtTel   = MapTelephones(ds.Tables[0]),
                dtUnAsg = MapUnassigned(ds.Tables[0]),
                dtAsg   = MapAssigned(ds.Tables[1])
            });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetAsgNo", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetProvider()
    {
        try
        {
            var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
            var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

            SqlParameter[] p =
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ];

            var ds = _db.ExecuteStoredProcDataSet("sp_GetProvider", p);
            return Json(new { ProviderList = MapProviders(ds.Tables[0]) });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetProvider", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // Dropdown lookups for the AddTelephone view (ported from legacy TelephoneController).
    [HttpGet]
    public IActionResult GetLineTypes()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetLineTypes");
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new { id = Convert.ToInt32(r["Id"]), name = r["LineType"].ToString() })
                .ToList();
            return Json(list);
        }
        catch (Exception ex)
        {
            LogAuditFail("GetLineTypes", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetCostCenter()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetCostCenter");
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new
                {
                    id   = Convert.ToInt32(r["Id"]),
                    code = r["Code"].ToString(),
                    name = r["CostCenter_Name"].ToString()
                })
                .ToList();
            return Json(list);
        }
        catch (Exception ex)
        {
            LogAuditFail("GetCostCenter", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult AddTelephone([FromBody] Telephone tel)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@SUBNO",          SqlDbType.VarChar)  { Value = tel.SubNo },
                new SqlParameter("@PROVIDER",       SqlDbType.VarChar)  { Value = tel.Provider },
                new SqlParameter("@DESCRIPTION",    SqlDbType.VarChar)  { Value = tel.Description  ?? (object)DBNull.Value },
                new SqlParameter("@TYPE",           SqlDbType.VarChar)  { Value = tel.Type         ?? (object)DBNull.Value },
                new SqlParameter("@LINETYPE",       SqlDbType.VarChar)  { Value = tel.LineType },
                new SqlParameter("@ACCOUNTNO",      SqlDbType.VarChar)  { Value = tel.AccountNo    ?? (object)DBNull.Value },
                new SqlParameter("@ContractExpiry", SqlDbType.DateTime) { Value = tel.ContractExpiry.HasValue ? tel.ContractExpiry.Value : DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_AddTelephone", p);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddTelephone", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateTelephone([FromBody] Telephone tel)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID",             SqlDbType.VarChar)  { Value = tel.Id },
                new SqlParameter("@SUBNO",          SqlDbType.VarChar)  { Value = tel.SubNo },
                new SqlParameter("@PROVIDER",       SqlDbType.VarChar)  { Value = tel.Provider },
                new SqlParameter("@DESCRIPTION",    SqlDbType.VarChar)  { Value = tel.Description  ?? (object)DBNull.Value },
                new SqlParameter("@TYPE",           SqlDbType.VarChar)  { Value = tel.Type         ?? (object)DBNull.Value },
                new SqlParameter("@LINETYPE",       SqlDbType.VarChar)  { Value = tel.LineType },
                new SqlParameter("@ACCOUNTNO",      SqlDbType.VarChar)  { Value = tel.AccountNo    ?? (object)DBNull.Value },
                new SqlParameter("@ContractExpiry", SqlDbType.DateTime) { Value = tel.ContractExpiry.HasValue ? tel.ContractExpiry.Value : DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_UpdateTelephone", p);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateTelephone", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteTelephone([FromBody] Telephone tel)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID", SqlDbType.Int) { Value = tel.Id }
            ];
            var ds     = _db.ExecuteStoredProcDataSet("sp_DeleteTelephone", p);
            var result = ds.Tables[0].Rows[0]["Result"].ToString();
            return Json(new { myMessage = result });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteTelephone", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Assignment ────────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult Assign([FromBody] AssignNo assign)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@UID",            SqlDbType.Int)      { Value = assign.Uid },
                new SqlParameter("@SubNoId",        SqlDbType.Int)      { Value = assign.SubNoId },
                new SqlParameter("@STARTDATE",      SqlDbType.DateTime) { Value = assign.StartDate },
                new SqlParameter("@ENDDATE",        SqlDbType.DateTime) { Value = assign.EndDate },
                new SqlParameter("@ALLOWANCELIMIT", SqlDbType.Decimal)  { Value = assign.AllowanceLimit },
                new SqlParameter("@BUSINESSLIMIT",  SqlDbType.Decimal)  { Value = assign.BusinessLimit },
                new SqlParameter("@LINESTATUS",     SqlDbType.Int)      { Value = assign.LineStatus },
                new SqlParameter("@CostCenterID",   SqlDbType.Int)      { Value = assign.CostCenterId }
            ];
            _db.ExecuteStoredProc("sp_AssignNumber", p);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("Assign", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateAssign([FromBody] AssignNo assign)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID",             SqlDbType.Int)      { Value = assign.Id },
                new SqlParameter("@UID",            SqlDbType.Int)      { Value = assign.Uid },
                new SqlParameter("@SubNoId",        SqlDbType.Int)      { Value = assign.SubNoId },
                new SqlParameter("@STARTDATE",      SqlDbType.DateTime) { Value = assign.StartDate },
                new SqlParameter("@ENDDATE",        SqlDbType.DateTime) { Value = assign.EndDate },
                new SqlParameter("@ALLOWANCELIMIT", SqlDbType.Decimal)  { Value = assign.AllowanceLimit },
                new SqlParameter("@BUSINESSLIMIT",  SqlDbType.Decimal)  { Value = assign.BusinessLimit },
                new SqlParameter("@LINESTATUS",     SqlDbType.Int)      { Value = assign.LineStatus },
                new SqlParameter("@CostCenterID",   SqlDbType.Int)      { Value = assign.CostCenterId }
            ];
            _db.ExecuteStoredProc("sp_UpdateAssignNumber", p);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateAssign", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteAssign([FromBody] AssignNo assign)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID", SqlDbType.Int) { Value = assign.Id }
            ];
            _db.ExecuteStoredProc("sp_DeleteAssignNumber", p);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteAssign", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Delegation ────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetDelegate()
    {
        try
        {
            var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
            var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

            SqlParameter[] p =
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId },
                new SqlParameter("@Command",   SqlDbType.Int) { Value = 1 }
            ];

            var ds = _db.ExecuteStoredProcDataSet("sp_GetDelegate", p);
            return Json(new { dtSec = MapDelegations(ds.Tables[0]), EmpList = MapEmployeeList(ds.Tables[1]) });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetDelegate", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult SaveDelegate([FromBody] Delg dlg)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command",   SqlDbType.Int) { Value = 1 },
                new SqlParameter("@secid",     SqlDbType.Int) { Value = dlg.SecId },
                new SqlParameter("@managerid", SqlDbType.Int) { Value = dlg.ManagerId },
                new SqlParameter("@app",       SqlDbType.Bit) { Value = dlg.CanApprove },
                new SqlParameter("@idt",       SqlDbType.Bit) { Value = dlg.CanIdentify }
            ];
            _db.ExecuteStoredProc("sp_ManageDelegate", p);
            return Json(new { myMessage = "Added Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("SaveDelegate", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateDelegate([FromBody] Delg dlg)
    {
        try
        {
            if (dlg.Id <= 0 || dlg.SecId <= 0 || dlg.ManagerId <= 0)
                throw new ArgumentException("IDs must be positive integers.");

            SqlParameter[] p =
            [
                new SqlParameter("@Command",   SqlDbType.Int) { Value = 2 },
                new SqlParameter("@ID",        SqlDbType.Int) { Value = dlg.Id },
                new SqlParameter("@secid",     SqlDbType.Int) { Value = dlg.SecId },
                new SqlParameter("@managerid", SqlDbType.Int) { Value = dlg.ManagerId },
                new SqlParameter("@app",       SqlDbType.Bit) { Value = dlg.CanApprove },
                new SqlParameter("@idt",       SqlDbType.Bit) { Value = dlg.CanIdentify }
            ];
            _db.ExecuteStoredProc("sp_ManageDelegate", p);
            return Json(new { myMessage = "Updated Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateDelegate", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteDelegate([FromBody] Delg dlg)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command", SqlDbType.Int) { Value = 3 },
                new SqlParameter("@ID",      SqlDbType.Int) { Value = dlg.Id }
            ];
            _db.ExecuteStoredProc("sp_ManageDelegate", p);
            return Json(new { myMessage = "Deleted Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteDelegate", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Packages ──────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetPkgData()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPkgData");
            return Json(new { dtPro = MapProviders(ds.Tables[0]), dtPkg = MapPackages(ds.Tables[1]) });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetPkgData", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetPackage()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetAllPackages");
            return Json(new { dtPkg = MapPackages(ds.Tables[0]) });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetPackage", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult FillTransType([FromBody] Package pkg)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ProviderID", SqlDbType.Int) { Value = pkg.ProviderId }
            ];
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPackageTransTypes", p);
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new Package { TransId = Convert.ToInt32(r["ID"]), TransName = r["PKG_CALLTYPE"].ToString() })
                .ToList();
            return Json(new { dtTransType = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("FillTransType", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult FillDesc([FromBody] Package pkg)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@TransID", SqlDbType.Int) { Value = pkg.TransId }
            ];
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPackageCallDescs", p);
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new Package { DescId = Convert.ToInt32(r["ID"]), DescName = r["CALLTYPEDESC"].ToString() })
                .ToList();
            return Json(new { dtdesc = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("FillDesc", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult AddPackage([FromBody] PackageRequest request)
    {
        try
        {
            for (int i = 0; i < request.Detail.Count; i++)
            {
                _db.ExecuteStoredProc("sp_AddPackage", BuildPackageParams(request.Detail[i], request.Master, i, isUpdate: false));
            }
            return Json(new { myMessage = "Added Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddPackage", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdatePackage([FromBody] PackageRequest request)
    {
        try
        {
            for (int i = 0; i < request.Detail.Count; i++)
            {
                _db.ExecuteStoredProc("sp_UpdatePackage", BuildPackageParams(request.Detail[i], request.Master, i, isUpdate: true));
            }
            return Json(new { myMessage = "Updated Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdatePackage", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeletePackage([FromBody] Package pkg)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID", SqlDbType.Int) { Value = pkg.Id }
            ];
            _db.ExecuteStoredProc("sp_DeletePackage", p);
            return Json(new { Message = "Deleted Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeletePackage", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetPkgDetail([FromQuery] int id)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID", SqlDbType.Int) { Value = id }
            ];
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetPkgDetail", p);
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new Package
                {
                    Id           = Convert.ToInt32(r["ID"]),
                    ProviderId   = Convert.ToInt32(r["PROVIDER"]),
                    ProviderName = r["ProviderName"].ToString(),
                    TransId      = Convert.ToInt32(r["CALLTYPEID"]),
                    TransName    = r["TransName"].ToString(),
                    DescId       = Convert.ToInt32(r["CALLDESCID"]),
                    DescName     = r["DescName"].ToString(),
                    ExpType      = Convert.ToInt32(r["EXP_TYPE"]),
                    Amount       = Convert.ToDouble(r["AMT"])
                }).ToList();

            return Json(new { PkgDetail = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetPkgDetail", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Contacts ──────────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult SaveContact([FromBody] Contact value)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Uid",      SqlDbType.Int)     { Value = value.Uid },
                new SqlParameter("@Name",     SqlDbType.VarChar) { Value = value.Name     ?? (object)DBNull.Value },
                new SqlParameter("@DialledNo",SqlDbType.VarChar) { Value = value.DialledNo ?? (object)DBNull.Value },
                new SqlParameter("@ExName",   SqlDbType.VarChar) { Value = value.ExName   ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_SaveContact", p);
            return Json(new { Message = value.ExName is not null ? "Contact Updated Successfully" : "Contact Saved Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("SaveContact", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Data Roaming ──────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetDataRoaming()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetDataRoaming");
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new DataRoaming
                {
                    Id       = Convert.ToInt32(r["ID"]),
                    Country  = r["Country"].ToString()!,
                    Operator = r["Operator"].ToString()
                }).ToList();
            return Json(new { dtCountry = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetDataRoaming", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult AddDataRoaming([FromBody] DataRoaming value)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Country",  SqlDbType.VarChar) { Value = value.Country },
                new SqlParameter("@Operator", SqlDbType.VarChar) { Value = value.Operator ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_AddDataRoaming", p);
            return Json(new { myMessage = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("AddDataRoaming", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateDataRoaming([FromBody] DataRoaming value)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID",       SqlDbType.VarChar) { Value = value.Id },
                new SqlParameter("@Country",  SqlDbType.VarChar) { Value = value.Country },
                new SqlParameter("@Operator", SqlDbType.VarChar) { Value = value.Operator ?? (object)DBNull.Value }
            ];
            _db.ExecuteStoredProc("sp_UpdateDataRoaming", p);
            return Json(new { myMessage = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateDataRoaming", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult DeleteDataRoaming([FromBody] DataRoaming value)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@ID", SqlDbType.Int) { Value = value.Id }
            ];
            _db.ExecuteStoredProc("sp_DeleteDataRoaming", p);
            return Json(new { myMessage = "Success" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteDataRoaming", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetNewData()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetEmployee");
            return Json(new { CountryList = MapCountries(ds.Tables[2]) });
        }
        catch (Exception ex)
        {
            LogAuditFail("GetNewData", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static bool IsValidName(string? name)
        => !string.IsNullOrWhiteSpace(name) && !Regex.IsMatch(name, @"[^\w\s]");

    private string CurrentUid()
        => HttpContext.Session.GetString("EmpUID") ?? "0";

    // Logs an error to tblAuditTrail via sp_CreateException (same sink the
    // ImportController uses). @Uid is the current user; severity defaults high.
    private void AuditTrail(string eventName, string message)
    {
        try
        {
            int.TryParse(CurrentUid(), out int uid);
            SqlParameter[] p =
            [
                new SqlParameter("@Uid",           SqlDbType.Int)      { Value = uid },
                new SqlParameter("@EventName",     SqlDbType.NVarChar) { Value = eventName },
                new SqlParameter("@EventType",     SqlDbType.NVarChar) { Value = "Fail" },
                new SqlParameter("@EventMsg",      SqlDbType.NVarChar) { Value = (object?)message ?? DBNull.Value },
                new SqlParameter("@EventSeverity", SqlDbType.NVarChar) { Value = "severity_high" }
            ];
            _db.ExecuteStoredProcDataSet("sp_CreateException", p);
        }
        catch { /* never let audit logging break the request */ }
    }

    private void LogAuditFail(string action, Exception ex)
    {
        _logger.LogError(ex, "Action={Action} failed", action);

        SqlParameter[] p =
        [
            new SqlParameter("@FormId",     SqlDbType.Int)      { Value = 1 },
            new SqlParameter("@ActionName", SqlDbType.VarChar)  { Value = action },
            new SqlParameter("@Result",     SqlDbType.VarChar)  { Value = "Fail" },
            new SqlParameter("@UserId",     SqlDbType.VarChar)  { Value = CurrentUid() },
            new SqlParameter("@ErrorMsg",   SqlDbType.NVarChar) { Value = ex.ToString().Replace("'", " ") }
        ];

        try { _db.ExecuteStoredProc("sp_InsertAuditLog", p); }
        catch { /* swallow secondary failures */ }
    }

    // ── DataTable mappers ─────────────────────────────────────────────────────

    private static List<EmployeeDetails> MapEmployees(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new EmployeeDetails
        {
            Uid         = Convert.ToInt32(r["UID"]),
            Name        = r["NAME"].ToString()!,
            EmployeeNo  = r["EMPLOYEENO"].ToString(),
            Email       = r["EMAIL"].ToString(),
            UserName    = r["USERNAME"].ToString(),
            Org         = r["ORG"].ToString(),
            Description = r["DESCRIPTION"].ToString(),
            Grade       = r["GRADE"].ToString(),
            ManagerId   = Convert.ToInt32(r["MANAGERID"]),
            ManagerName = r["MANAGER"].ToString(),
            Extension   = r["EXTENSION"].ToString(),
            Payroll     = r["PAYROLLCATEGORY"].ToString(),
            RoleId      = Convert.ToInt32(r["RID"]),
            RoleName    = r["RoleName"].ToString(),
            CountryId   = Convert.ToInt32(r["COUNTRYID"]),
            CountryName = r["COUNTRYNAME"].ToString(),
            CcNo        = r["COSTCENTER"].ToString(),
            IsCostCenter= r["ISCOSTCENTER"].ToString(),
            Company     = r["Company"].ToString(),
            CompanyId   = r["CompanyID"].ToString(),
            IsActive    = bool.Parse(r["IsActive"].ToString()!)
        }).ToList();

    private static List<Role> MapRoles(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Role
        {
            Id       = Convert.ToInt32(r["Role_ID"]),
            RoleName = r["RoleName"].ToString()!
        }).ToList();

    private static List<Country> MapCountries(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Country
        {
            CountryId   = Convert.ToInt32(r["COUNTRYID"]),
            CountryName = r["COUNTRYNAME"].ToString()!,
            Currency    = r["CURRENCY"].ToString(),
            CountryCode = r["COUNTRYCODE"].ToString(),
            ExchangeRate= Convert.ToDecimal(r["EXCHANGERATE"]),
            ShayaCode   = r["SHAYACODE"].ToString()
        }).ToList();

    private static List<CostCenter> MapCostCentres(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new CostCenter
        {
            Uid    = Convert.ToInt32(r["UID"]),
            CcName = r["NAME"].ToString()!,
            CcNum  = r["EMPLOYEENO"].ToString()
        }).ToList();

    private static List<Company> MapCompanies(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Company
        {
            Id          = Convert.ToInt32(r["ID"]),
            CompanyName = r["CompanyName"].ToString()!
        }).ToList();

    private static List<Telephone> MapTelephones(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Telephone
        {
            Id            = Convert.ToInt32(r["ID"]),
            SubNo         = r["SUB_NO"].ToString()!,
            Provider      = Convert.ToInt32(r["SUB_TYPE"]),
            ProviderName  = r["SUBS_TYPE"].ToString(),
            Description   = r["SUB_DESC"].ToString(),
            AccountNo     = r["ACCOUNTNO"].ToString(),
            LineType      = Convert.ToInt32(r["LINETYPE"]),
            LineTypeName  = r["LineTypeName"].ToString(),
            IsAssigned    = Convert.ToBoolean(r["ISASSIGNED"]),
            GeneralPhone  = Convert.ToBoolean(r["GENERALPHONE"]),
            Type          = r["BUSSINESSTYPE"].ToString(),
            ContractExpiry= string.IsNullOrEmpty(r["ContractExpiry"].ToString())
                            ? null
                            : Convert.ToDateTime(r["ContractExpiry"])
        }).ToList();

    private static List<Unassigned> MapUnassigned(DataTable t) =>
        t.Rows.Cast<DataRow>()
         // sp_GetTelData returns ISASSIGNED as the literal string 'TRUE'/'FALSE'
         // (uppercase), so a case-sensitive == "False" check matched nothing.
         .Where(r => string.Equals(r["ISASSIGNED"]?.ToString(), "False", StringComparison.OrdinalIgnoreCase))
         .Select(r => new Unassigned
         {
             Id          = Convert.ToInt32(r["ID"]),
             SubNo       = r["SUB_NO"].ToString()!,
             Description = r["SUB_DESC"].ToString()
         }).ToList();

    private static List<AssignNo> MapAssigned(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new AssignNo
        {
            Id             = Convert.ToInt32(r["ID"]),
            SubNoId        = Convert.ToInt32(r["Subs_no_ID"]),
            SubNo          = r["SUB_NO"].ToString(),
            Description    = r["SUB_DESC"].ToString(),
            Uid            = Convert.ToInt32(r["UID"]),
            EmployeeName   = r["NAME"].ToString(),
            EmployeeNo     = r["EMPLOYEENO"].ToString(),
            BusinessLimit  = Convert.ToDecimal(r["BUSSINESSLIMIT"]),
            AllowanceLimit = Convert.ToDecimal(r["MONTHLYLIMIT"]),
            LineStatus     = Convert.ToInt32(r["LineStatusID"]),
            LineStatusName = r["LineStatus"].ToString(),
            StartDate      = Convert.ToDateTime(r["StartDate"]),
            EndDate        = Convert.ToDateTime(r["EndDate"]),
            CostCenterId   = Convert.ToInt32(r["CostCenterID"]),
            CostCenterName = r["CostCenter_Name"].ToString()
        }).ToList();

    private static List<Provider> MapProviders(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Provider
        {
            Id   = Convert.ToInt32(r["ID"]),
            Name = r["Name"].ToString()!
        }).ToList();

    private static List<Employee> MapEmployeeList(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Employee
        {
            EmpId   = Convert.ToInt32(r["UID"]),
            EmpNo   = r["EMPLOYEENO"].ToString(),
            EmpName = r["NAME"].ToString()
        }).ToList();

    private static List<Delg> MapDelegations(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Delg
        {
            Id          = Convert.ToInt32(r["ID"]),
            ManagerId   = Convert.ToInt32(r["ManagerID"]),
            ManName     = r["ManagerName"].ToString(),
            SecId       = Convert.ToInt32(r["SecrateryID"]),
            SecName     = r["SecrateryName"].ToString(),
            CanIdentify = Convert.ToBoolean(r["CanIdentify"]),
            CanApprove  = Convert.ToBoolean(r["CanApprove"])
        }).ToList();

    private static List<Package> MapPackages(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Package
        {
            Id        = Convert.ToInt32(r["ID"]),
            PkgName   = r["PKGNAME"].ToString()!,
            PkgDesc   = r["DESCRIPTION"].ToString(),
            StartDate = Convert.ToDateTime(r["STARTDATE"])
        }).ToList();

    private SqlParameter[] BuildEmployeeParams(EmployeeDetails emp, string countryId, int index, bool isUpdate)
    {
        var uid = CurrentUid();
        return
        [
            new SqlParameter("@NAME",       SqlDbType.VarChar) { Value = emp.Name },
            new SqlParameter("@EMPLOYEENO", SqlDbType.VarChar) { Value = emp.EmployeeNo ?? (object)DBNull.Value },
            new SqlParameter("@CCNO",       SqlDbType.VarChar) { Value = emp.CcNo       ?? (object)DBNull.Value },
            new SqlParameter("@EMAIL",      SqlDbType.VarChar) { Value = emp.Email      ?? (object)DBNull.Value },
            new SqlParameter("@USERNAME",   SqlDbType.VarChar) { Value = emp.UserName   ?? (object)DBNull.Value },
            new SqlParameter("@ORG",        SqlDbType.VarChar) { Value = emp.Org        ?? (object)DBNull.Value },
            new SqlParameter("@DESCRIPTION",SqlDbType.VarChar) { Value = emp.Description?? (object)DBNull.Value },
            new SqlParameter("@MANAGERID",  SqlDbType.Int)     { Value = emp.ManagerId },
            new SqlParameter("@GRADE",      SqlDbType.VarChar) { Value = emp.Grade      ?? (object)DBNull.Value },
            new SqlParameter("@EXTENSION",  SqlDbType.VarChar) { Value = emp.Extension  ?? (object)DBNull.Value },
            new SqlParameter("@PAYROLL",    SqlDbType.VarChar) { Value = emp.Payroll    ?? (object)DBNull.Value },
            new SqlParameter("@ROLEID",     SqlDbType.Int)     { Value = emp.RoleId },
            new SqlParameter("@COUNTRYID",  SqlDbType.Int)     { Value = int.Parse(countryId) },
            new SqlParameter("@Count",      SqlDbType.Int)     { Value = index },
            new SqlParameter("@UserUid",    SqlDbType.Int)     { Value = int.Parse(uid) },
            new SqlParameter("@CompanyID",  SqlDbType.Int)     { Value = int.TryParse(emp.CompanyId, out var cid) ? cid : 0 },
            new SqlParameter("@IsActive",   SqlDbType.Bit)     { Value = emp.IsActive }
        ];
    }

    private SqlParameter[] BuildEmployeeUpdateParams(EmployeeDetails emp, string countryId, int index)
    {
        var uid = CurrentUid();
        return
        [
            new SqlParameter("@UID",        SqlDbType.VarChar) { Value = emp.Uid },
            new SqlParameter("@NAME",       SqlDbType.VarChar) { Value = emp.Name.Trim() },
            new SqlParameter("@EMPLOYEENO", SqlDbType.VarChar) { Value = emp.EmployeeNo?.Trim() ?? (object)DBNull.Value },
            new SqlParameter("@CCNO",       SqlDbType.VarChar) { Value = emp.CcNo?.Trim()       ?? (object)DBNull.Value },
            new SqlParameter("@EMAIL",      SqlDbType.VarChar) { Value = emp.Email?.Trim()      ?? (object)DBNull.Value },
            new SqlParameter("@USERNAME",   SqlDbType.VarChar) { Value = emp.UserName?.Trim()   ?? (object)DBNull.Value },
            new SqlParameter("@ORG",        SqlDbType.VarChar) { Value = emp.Org?.Trim()        ?? (object)DBNull.Value },
            new SqlParameter("@DESCRIPTION",SqlDbType.VarChar) { Value = emp.Description?.Trim()?? (object)DBNull.Value },
            new SqlParameter("@MANAGERID",  SqlDbType.Int)     { Value = emp.ManagerId },
            new SqlParameter("@GRADE",      SqlDbType.VarChar) { Value = emp.Grade?.Trim()      ?? (object)DBNull.Value },
            new SqlParameter("@EXTENSION",  SqlDbType.VarChar) { Value = emp.Extension?.Trim()  ?? (object)DBNull.Value },
            new SqlParameter("@PAYROLL",    SqlDbType.VarChar) { Value = emp.Payroll?.Trim()    ?? (object)DBNull.Value },
            new SqlParameter("@ROLEID",     SqlDbType.Int)     { Value = emp.RoleId },
            new SqlParameter("@COUNTRYID",  SqlDbType.Int)     { Value = int.Parse(countryId) },
            new SqlParameter("@Count",      SqlDbType.Int)     { Value = index },
            new SqlParameter("@UserUid",    SqlDbType.Int)     { Value = int.Parse(uid) },
            new SqlParameter("@CompanyID",  SqlDbType.Int)     { Value = int.TryParse(emp.CompanyId, out var cid) ? cid : 0 },
            new SqlParameter("@IsActive",   SqlDbType.Bit)     { Value = emp.IsActive }
        ];
    }

    private static SqlParameter[] BuildPackageParams(Package detail, Package master, int index, bool isUpdate)
    {
        var pList = new List<SqlParameter>
        {
            new("@Count",      SqlDbType.VarChar) { Value = index },
            new("@PkgName",    SqlDbType.VarChar) { Value = master.PkgName },
            new("@PkgDesc",    SqlDbType.VarChar) { Value = master.PkgDesc  ?? (object)DBNull.Value },
            new("@ProviderID", SqlDbType.VarChar) { Value = detail.ProviderId },
            new("@TransID",    SqlDbType.VarChar) { Value = detail.TransId },
            new("@DescID",     SqlDbType.VarChar) { Value = detail.DescId },
            new("@IsAll",      SqlDbType.VarChar) { Value = detail.IsAll },
            new("@ExpType",    SqlDbType.VarChar) { Value = detail.ExpType },
            new("@Amount",     SqlDbType.VarChar) { Value = detail.Amount },
            new("@StartDate",  SqlDbType.VarChar) { Value = master.StartDate }
        };

        if (isUpdate)
            pList.Insert(1, new SqlParameter("@PkgID", SqlDbType.VarChar) { Value = master.Id });

        return [.. pList];
    }

    // ── Request helper record ─────────────────────────────────────────────────

    /// <summary>Wrapper for Add/UpdatePackage which receives a master + detail list.</summary>
    public record PackageRequest(List<Package> Detail, Package Master);

    /// <summary>
    /// Wraps an employee payload and its country selection for Add/UpdateEmployee.
    /// ASP.NET Core only supports a single [FromBody] binding per action, so both
    /// the employee data and the country selection are bundled into this record.
    /// </summary>
    public record EmployeeRequest(EmployeeDetails Emp, Country Cnt);
}
