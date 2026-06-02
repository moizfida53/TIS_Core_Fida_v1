using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

/// <summary>
/// Settings → Configuration, Manage Policy (call-type rules) and Manage Provider.
/// All data access goes through stored procedures (see SQL/SettingStoredProcedures.sql)
/// — zero inline SQL. No jqWidgets — the views use Bootstrap + DataTables.
/// </summary>
[RoleAuthorize(Roles.SuperAdmin)]
public class SettingController : Controller
{
    private readonly DB _db;
    private readonly ILogger<SettingController> _logger;

    public SettingController(DB db, ILogger<SettingController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── Views ──────────────────────────────────────────────────────────────────
    public IActionResult Index()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View("Config");

    public IActionResult Policy()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View("ManageCallType");

    public IActionResult Provider()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View("ManageProvider");

    // ── Lookups ────────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetProvider()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetProviders", []);
            var list = new List<Provider>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new Provider
                    {
                        Id        = ToInt(r["ID"]),
                        Name      = r["Name"].ToString() ?? string.Empty,
                        IsVoip    = ToBool(r["IsVoip"]),
                        CountryId = ToInt(r["COUNTRYID"])
                    });
            return Json(new { ProviderList = list });
        }
        catch (Exception ex) { LogFail("GetProvider", ex); return Json(new { Fail = true }); }
    }

    // ── Configuration (tblConfiguration, single row ID=1) ──────────────────────

    [HttpGet]
    public IActionResult GetConfig()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetConfiguration", []);
            if (ds is null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return Json(new { dtConfig = new Config() });

            var r = ds.Tables[0].Rows[0];

            var cfg = new Config
            {
                EmpReminder        = r["EmpReminder"].ToString(),
                MgrReminder        = r["MgrComplaintReminder"].ToString(),
                FbReminder         = r["ForceBillReminder"].ToString(),
                LmReminder         = r["LMReminder"].ToString(),
                Smtp               = r["SMTPSettings"].ToString(),
                AdminEmail         = r["AdminEmail"].ToString(),
                HostUrl            = r["HostUrl"].ToString(),
                SupGrade           = r["SuperGrade"].ToString(),
                EnableGrade        = ToBool(r["EnableGrade"]),
                DntSndEmail        = ToBool(r["NotSendMail"]),
                HidePerCalls       = ToBool(r["HidePersonalCalls"]),
                GmApp              = ToBool(r["skipGMApproval"]),
                EnableDiscrepancy  = ToBool(r["EnableDiscrepancy"]),
                SkipAppBusZero     = ToBool(r["SkipApprovalBuss"]),
                DedBusCharges      = ToBool(r["DedBussinessCharges"]),
                ZeroUnlimited      = ToBool(r["BusinessZeroAsUnlimited"]),
                AlwWav             = ToBool(r["AllowWaiver"]),
                EnableDelete       = ToBool(r["DeleteBut"]),
                AlwTrainFb         = ToBool(r["AllowTrainForceBill"]),
                HideAllowanceLimit = ToBool(r["HideAllowanceLimit"]),
                HidePersonalLimit  = ToBool(r["HidePersonalLimit"])
            };
            return Json(new { dtConfig = cfg });
        }
        catch (Exception ex) { LogFail("GetConfig", ex); return Json(new { Fail = true }); }
    }

    [HttpPost]
    public IActionResult SaveConfig([FromBody] Config config)
    {
        try
        {
            _db.ExecuteStoredProc("sp_SaveConfiguration",
            [
                Text("@EmpReminder",        config.EmpReminder),
                Text("@MgrReminder",        config.MgrReminder),
                Text("@FbReminder",         config.FbReminder),
                Text("@LmReminder",         config.LmReminder),
                Text("@Smtp",               config.Smtp),
                Text("@AdminEmail",         config.AdminEmail),
                Text("@HostUrl",            config.HostUrl),
                Text("@SupGrade",           config.SupGrade),
                Flag("@EnableGrade",        config.EnableGrade),
                Flag("@DntSndEmail",        config.DntSndEmail),
                Flag("@HidePerCalls",       config.HidePerCalls),
                Flag("@GmApp",              config.GmApp),
                Flag("@EnableDiscrepancy",  config.EnableDiscrepancy),
                Flag("@SkipAppBusZero",     config.SkipAppBusZero),
                Flag("@DedBusCharges",      config.DedBusCharges),
                Flag("@ZeroUnlimited",      config.ZeroUnlimited),
                Flag("@AlwWav",             config.AlwWav),
                Flag("@EnableDelete",       config.EnableDelete),
                Flag("@AlwTrainFb",         config.AlwTrainFb),
                Flag("@HideAllowanceLimit", config.HideAllowanceLimit),
                Flag("@HidePersonalLimit",  config.HidePersonalLimit)
            ]);
            Audit("Configuration", "Success");
            return Json(new { Message = "Configuration Saved Successfully" });
        }
        catch (Exception ex)
        {
            LogFail("SaveConfig", ex);
            return Json(new { Message = "Error Please Contact Your Manager" });
        }
    }

    // ── Provider management ─────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult AddProvider([FromBody] Provider provider)
    {
        try
        {
            _db.ExecuteStoredProc("sp_AddProvider",
            [
                new SqlParameter("@Name",   SqlDbType.NVarChar) { Value = provider.Name },
                Flag("@IsVoip", provider.IsVoip ?? false)
            ]);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex) { LogFail("AddProvider", ex); return Json(new { Message = "Error Please Contact Your Manager" }); }
    }

    [HttpPost]
    public IActionResult UpdateProvider([FromBody] Provider provider)
    {
        try
        {
            _db.ExecuteStoredProc("sp_UpdateProvider",
            [
                new SqlParameter("@ID",     SqlDbType.Int)      { Value = provider.Id },
                new SqlParameter("@Name",   SqlDbType.NVarChar) { Value = provider.Name },
                Flag("@IsVoip", provider.IsVoip ?? false)
            ]);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex) { LogFail("UpdateProvider", ex); return Json(new { Message = "Error Please Contact Your Manager" }); }
    }

    [HttpPost]
    public IActionResult DeleteProvider([FromBody] Provider provider)
    {
        try
        {
            _db.ExecuteStoredProc("sp_DeleteProvider",
                [new SqlParameter("@ID", SqlDbType.Int) { Value = provider.Id }]);
            return Json(new { Message = "Success" });
        }
        catch (Exception ex) { LogFail("DeleteProvider", ex); return Json(new { Message = "Error Please Contact Your Manager" }); }
    }

    [HttpGet]
    public IActionResult FillTransType(int providerId)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetTransTypes",
                [new SqlParameter("@ProviderId", SqlDbType.Int) { Value = providerId }]);
            var list = new List<object>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new { transType = r["TRANS_TYPE"].ToString() });
            return Json(new { dtTransType = list });
        }
        catch (Exception ex) { LogFail("FillTransType", ex); return Json(new { Fail = true }); }
    }

    [HttpGet]
    public IActionResult FillDesc(int providerId, string transType)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetDescriptions",
            [
                new SqlParameter("@ProviderId", SqlDbType.Int)      { Value = providerId },
                new SqlParameter("@TransType",  SqlDbType.NVarChar) { Value = (object?)transType ?? DBNull.Value }
            ]);
            var list = new List<object>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new { description = r["DESCRIPTION"].ToString() });
            return Json(new { dtdesc = list });
        }
        catch (Exception ex) { LogFail("FillDesc", ex); return Json(new { Fail = true }); }
    }

    [HttpGet]
    public IActionResult GetCallType()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetCallTypes", []);
            var list = new List<CallType>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new CallType { Id = ToInt(r["ID"]), Name = r["Name"].ToString() ?? string.Empty });
            return Json(new { CallTypeList = list });
        }
        catch (Exception ex) { LogFail("GetCallType", ex); return Json(new { Fail = true }); }
    }

    [HttpGet]
    public IActionResult GetLineTypes()
    {
        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetLineTypes", []);
            var list = new List<object>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new { id = ToInt(r["Id"]), name = r["LineType"].ToString() });
            return Json(list);
        }
        catch (Exception ex) { LogFail("GetLineTypes", ex); return Json(new { Fail = true }); }
    }

    [HttpGet]
    public IActionResult GetEmployee()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetEmpCallId", []);
            var list = new List<EmpSub>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new EmpSub
                    {
                        Uid          = ToInt(r["UID"]),
                        EmployeeName = r["NAME"].ToString(),
                        Org          = r["ORG"].ToString(),
                        SubNoId      = ToInt(r["Subs_no_ID"]),
                        SubNo        = r["SUB_NO"].ToString()
                    });
            return Json(new { dtEmp = list });
        }
        catch (Exception ex) { LogFail("GetEmployee", ex); return Json(new { Fail = true }); }
    }

    // ── Policy grid ─────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetPolicy()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPolicies", []);
            var list = new List<Policy>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new Policy
                    {
                        Id          = ToInt(r["ID"]),
                        ProviderId  = ToInt(r["provider"]),
                        ProviderName= r["providername"].ToString(),
                        TransType   = r["Provider_type_desc"].ToString(),
                        Description = r["destination_desc"].ToString(),
                        CallTypeId  = ToInt(r["call_type"]),
                        CallType    = r["call_type_desc"].ToString(),
                        LineTypeId  = ToInt(r["LineType"]),
                        LineType    = r["LineTypeName"].ToString(),
                        IsAll       = ToBool(r["IsAll"]),
                        IsSupImp    = ToBool(r["Superimpose_train"])
                    });
            return Json(new { dtPolicy = list });
        }
        catch (Exception ex) { LogFail("GetPolicy", ex); return Json(new { Fail = true }); }
    }

    [HttpPost]
    public IActionResult AddPolicy([FromBody] Policy policy)
    {
        try
        {
            if (policy.IsAllDesc)
            {
                int id = InsertPolicy(policy, string.Empty);
                Audit("Add Policy", "Success");
                if (!policy.IsAll) InsertDetails(id, policy);
            }
            else
            {
                foreach (var desc in policy.Des ?? [])
                {
                    int id = InsertPolicy(policy, desc);
                    Audit("Add Policy", "Success");
                    if (!policy.IsAll) InsertDetails(id, policy);
                }
            }
            return Json(new { Message = "Policy Added Successfully" });
        }
        catch (Exception ex)
        {
            LogFail("AddPolicy", ex);
            return Json(new { Message = "Error Please Contact Your Manager" });
        }
    }

    [HttpPost]
    public IActionResult UpdatePolicy([FromBody] Policy policy)
    {
        try
        {
            Audit("Update Policy", "Success");
            _db.ExecuteStoredProc("sp_UpdatePolicyHeader",
            [
                new SqlParameter("@Id",       SqlDbType.Int) { Value = policy.Id },
                Flag("@IsAll",    policy.IsAll),
                Flag("@IsSupImp", policy.IsSupImp)
            ]);
            if (!policy.IsAll) InsertDetails(policy.Id, policy);
            return Json(new { Message = "Policy Updated Successfully" });
        }
        catch (Exception ex)
        {
            LogFail("UpdatePolicy", ex);
            return Json(new { Message = "Error Please Contact Your Manager" });
        }
    }

    [HttpPost]
    public IActionResult ApplyPolicy()
    {
        try
        {
            _db.ExecuteStoredProc("sp_ApplyPolicy", []);
            return Json(new { Message = "Policy Applied Successfully" });
        }
        catch (Exception ex) { LogFail("ApplyPolicy", ex); return Json(new { Message = "Error Please Contact Your Manager" }); }
    }

    [HttpPost]
    public IActionResult DeletePolicy([FromBody] Policy policy)
    {
        try
        {
            _db.ExecuteStoredProc("sp_DeletePolicy",
                [new SqlParameter("@ID", SqlDbType.VarChar) { Value = policy.Id.ToString() }]);
            return Json(new { Message = "Deleted Successfully" });
        }
        catch (Exception ex) { LogFail("DeletePolicy", ex); return Json(new { Message = "Error Please Contact Your Manager" }); }
    }

    [HttpGet]
    public IActionResult GetPolicyDetail(int id)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPolicyDetail",
                [new SqlParameter("@Id", SqlDbType.Int) { Value = id }]);
            var list = new List<object>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new { id = ToInt(r["Sub_No_ID"]) });
            return Json(new { dtID = list });
        }
        catch (Exception ex) { LogFail("GetPolicyDetail", ex); return Json(new { Fail = true }); }
    }

    [HttpGet]
    public IActionResult GetEmpList(int id)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPolicyEmployees",
                [new SqlParameter("@Id", SqlDbType.Int) { Value = id }]);
            var list = new List<Employee>();
            if (ds is not null && ds.Tables.Count > 0)
                foreach (DataRow r in ds.Tables[0].Rows)
                    list.Add(new Employee { EmpName = r["NAME"].ToString(), EmpNo = r["EMPLOYEENO"].ToString() });
            return Json(new { dtEmp = list });
        }
        catch (Exception ex) { LogFail("GetEmpList", ex); return Json(new { Fail = true }); }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    // Inserts a policy header via sp_InsertPolicy and returns the new ID.
    private int InsertPolicy(Policy p, string destinationDesc)
    {
        var ds = _db.ExecuteStoredProcDataSet("sp_InsertPolicy",
        [
            new SqlParameter("@ProviderId",      SqlDbType.Int)      { Value = p.ProviderId },
            new SqlParameter("@TransType",       SqlDbType.NVarChar) { Value = (object?)p.TransType ?? DBNull.Value },
            new SqlParameter("@DestinationDesc", SqlDbType.NVarChar) { Value = (object?)destinationDesc ?? string.Empty },
            new SqlParameter("@CallTypeId",      SqlDbType.Int)      { Value = p.CallTypeId },
            Flag("@IsAll",    p.IsAll),
            Flag("@IsSupImp", p.IsSupImp),
            new SqlParameter("@LineTypeId",      SqlDbType.Int)      { Value = p.LineTypeId }
        ]);
        return ds is not null && ds.Tables.Count > 0 && ds.Tables[0].Rows.Count > 0
            ? ToInt(ds.Tables[0].Rows[0]["NewId"])
            : 0;
    }

    private void InsertDetails(int manageCallTypeId, Policy p)
    {
        var emp = p.Emp ?? [];
        var num = p.Num ?? [];
        for (int i = 0; i < emp.Length; i++)
        {
            var subNoId = i < num.Length ? num[i] : 0;
            _db.ExecuteStoredProc("sp_InsertPolicyDetail",
            [
                new SqlParameter("@Uid",              SqlDbType.Int) { Value = emp[i] },
                new SqlParameter("@SubNoId",          SqlDbType.Int) { Value = subNoId },
                new SqlParameter("@ManageCallTypeId", SqlDbType.Int) { Value = manageCallTypeId }
            ]);
        }
    }

    private void Audit(string action, string result)
    {
        try
        {
            _db.ExecuteStoredProc("sp_InsertAuditLog",
            [
                new SqlParameter("@FormId",     SqlDbType.Int)      { Value = 18 },
                new SqlParameter("@ActionName", SqlDbType.VarChar)  { Value = action },
                new SqlParameter("@Result",     SqlDbType.VarChar)  { Value = result },
                new SqlParameter("@UserId",     SqlDbType.VarChar)  { Value = HttpContext.Session.GetString("EmpUID") ?? "0" },
                new SqlParameter("@ErrorMsg",   SqlDbType.NVarChar) { Value = DBNull.Value }
            ]);
        }
        catch { /* never break the request for audit */ }
    }

    private void LogFail(string action, Exception ex)
    {
        _logger.LogError(ex, "Setting.{Action} failed", action);
        try
        {
            _db.ExecuteStoredProc("sp_InsertAuditLog",
            [
                new SqlParameter("@FormId",     SqlDbType.Int)      { Value = 18 },
                new SqlParameter("@ActionName", SqlDbType.VarChar)  { Value = action },
                new SqlParameter("@Result",     SqlDbType.VarChar)  { Value = "Fail" },
                new SqlParameter("@UserId",     SqlDbType.VarChar)  { Value = HttpContext.Session.GetString("EmpUID") ?? "0" },
                new SqlParameter("@ErrorMsg",   SqlDbType.NVarChar) { Value = ex.ToString().Replace("'", " ") }
            ]);
        }
        catch { }
    }

    // SqlParameter factories -----------------------------------------------------

    // Text parameter (null → DBNull).
    private static SqlParameter Text(string name, string? value)
        => new(name, SqlDbType.NVarChar) { Value = (object?)value ?? DBNull.Value };

    // Boolean flag persisted as the legacy "True"/"False" text the schema expects.
    private static SqlParameter Flag(string name, bool value)
        => new(name, SqlDbType.NVarChar) { Value = value ? "True" : "False" };

    // Null-safe conversions (legacy data can contain NULL COUNTRYID / IsVoip etc.)
    private static int ToInt(object? v)
        => v is null || v == DBNull.Value ? 0 : int.TryParse(v.ToString(), out var n) ? n : 0;
    private static bool ToBool(object? v)
        => v is not null && v != DBNull.Value && bool.TryParse(v.ToString(), out var b) && b;
}
