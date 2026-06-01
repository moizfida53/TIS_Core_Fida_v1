using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Net.Mail;
using System.Xml.Linq;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

/// <summary>
/// Core Ajax endpoint used by employee-facing bill identification, approval,
/// delegation, and archive views.
/// All data access via stored procedures — zero inline SQL.
/// </summary>
[RoleAuthorize(Roles.Administrator, Roles.SuperAdmin, Roles.Employee)]
public class AjaxController : Controller
{
    private readonly DB _db;
    private readonly ILogger<AjaxController> _logger;

    public AjaxController(DB db, ILogger<AjaxController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    public IActionResult Index()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View();

    // ── Templates ─────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult LoadTemplates()
    {
        var templateTypes = new List<TemplateType>();
        var countries     = new List<Country>();
        var templates     = new List<Template>();

        var ds = _db.ExecuteStoredProcDataSet("sp_GetTemplates");

        if (ds?.Tables.Count > 0 && ds.Tables[0].Rows.Count > 0)
        {
            if (ds.Tables.Count > 0)
            {
                templateTypes = ds.Tables[0].Rows.Cast<DataRow>()
                    .Select(r => new TemplateType
                    {
                        Id = Convert.ToInt32(r["Id"]),
                        TemplateName = r["Template"].ToString()!
                    })
                    .ToList();
            }

            if (ds.Tables.Count > 1)
            {
                countries = ds.Tables[1].Rows.Cast<DataRow>()
                    .Select(r => new Country
                    {
                        CountryId = Convert.ToInt32(r["COUNTRYID"]),
                        CountryName = r["COUNTRYNAME"].ToString()!
                    })
                    .ToList();
            }

            if (ds.Tables.Count > 2)
            {
                templates = ds.Tables[2].Rows.Cast<DataRow>()
                    .Select(r => new Template
                    {
                        TemplateId   = Convert.ToInt32(r["TemplateId"]),
                        TemplateText = r["TText"].ToString()!,
                        EmailBcc     = r["EmailBCC"].ToString(),
                        EmailFrom    = r["EmailFrom"].ToString(),
                        CountryId    = Convert.ToInt32(r["CountryId"]),
                        CountryName  = r["COUNTRYNAME"].ToString(),
                        Id           = Convert.ToInt32(r["Id"]),
                        TemplateName = r["Template"].ToString()!
                    })
                    .ToList();
            }
        }

        var vm = new TemplateViewModel
        {
            TemplateTypes = templateTypes,
            Countries     = countries,
            Templates     = templates
        };

        return Json(new { tmvm = vm });
    }

    [HttpPost]
    public IActionResult UpdateTemplates([FromBody] Template t)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Id",       SqlDbType.Int)      { Value = t.Id },
                new SqlParameter("@CId",      SqlDbType.Int)      { Value = t.CountryId },
                new SqlParameter("@TId",      SqlDbType.Int)      { Value = t.TemplateId },
                new SqlParameter("@Text",     SqlDbType.NVarChar) { Value = t.TemplateText.Trim() },
                new SqlParameter("@EmailFrom",SqlDbType.VarChar)  { Value = t.EmailFrom  ?? (object)DBNull.Value },
                new SqlParameter("@EmailBCC", SqlDbType.NVarChar) { Value = string.IsNullOrEmpty(t.EmailBcc) ? DBNull.Value : (object)t.EmailBcc }
            ];

            var ds   = _db.ExecuteStoredProcDataSet("sp_SaveTemplates", p);
            var list = MapTemplates(ds.Tables[0]);
            return Json(new { Templates = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateTemplates", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Bills ─────────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetBills([FromQuery] string uid)
    {
        if (!long.TryParse(uid, out long parsedUid) || parsedUid <= 0)
            return Json(new { Error = "Invalid UID" });

        try
        {
            var ds      = _db.ExecuteStoredProcDataSet("sp_GetUserBills",
                [new SqlParameter("@Uid", SqlDbType.Int) { Value = (int)parsedUid }]);

            var bills   = MapBills(ds.Tables[0]);
            var empList = ds.Tables[0].Rows.Count > 1
                ? ds.Tables[1].Rows.Cast<DataRow>()
                    .Select(r => new Employee { EmpId = Convert.ToInt32(r["UID"]), EmpNo = r["EMPLOYEENO"].ToString(), EmpName = r["NAME"].ToString() })
                    .ToList()
                : new List<Employee>();

            return Json(new { dtBills = bills, EmpList = empList });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetBills failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult GetBillDetails([FromQuery] string id, [FromQuery] int type = 0)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Id",   SqlDbType.Int) { Value = id },
                new SqlParameter("@type", SqlDbType.Int) { Value = type }
            ];

            var ds      = _db.ExecuteStoredProcDataSet("sp_GetBillDetails", p);
            var details = MapBillDetails(ds.Tables[0]);

            string blim = "", mlim = "", plim = "";
            if (ds.Tables.Count > 1)
            {
                blim = ds.Tables[1].Rows[0]["BussinessLimit"].ToString()!;
                mlim = ds.Tables[1].Rows[0]["MonthlyLimit"].ToString()!;
                plim = ds.Tables[1].Rows[0]["PLimit"].ToString()!;
            }

            var settings = new Settings();
            if (ds.Tables.Count > 2)
            {
                var sr = ds.Tables[2].Rows[0];
                settings = new Settings
                {
                    EnableDiscrepancy      = Convert.ToBoolean(sr["EnableDiscrepancy"]),
                    DedBussinessCharges    = Convert.ToBoolean(sr["DedBussinessCharges"]),
                    DedPersonalCharges     = Convert.ToBoolean(sr["DedPersonalCharges"]),
                    HideAllowanceLimit     = Convert.ToBoolean(sr["HideAllowanceLimit"]),
                    HidePersonalLimit      = Convert.ToBoolean(sr["HidePersonalLimit"]),
                    IsAllowWaiver          = Convert.ToBoolean(sr["AllowWaiver"]),
                    IsZeroUnlimited        = Convert.ToBoolean(sr["BusinessZeroAsUnlimited"]),
                    IsZeroUnlimitedPersonal= Convert.ToBoolean(sr["PersonalZeroAsUnlimited"])
                };
            }

            return Json(new { bill_details = details, blim, mlim, plim, setting = settings });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetBillDetails failed");
            return Json(new { Fail = true });
        }
    }

    // ── Employees ─────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetEmp()
    {
        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_LoginAs");
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new Employee { UserName = r["USERNAME"].ToString(), EmpNo = r["EMPLOYEENO"].ToString(), EmpName = r["NAME"].ToString() })
                .ToList();
            return Json(new { EmpList = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetEmp failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult GetEmployees()
    {
        var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
        var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ];

            var ds   = _db.ExecuteStoredProcDataSet("sp_GetEmp", p);
            var list = ds.Tables[0].Rows.Cast<DataRow>()
                .Select(r => new Employee
                {
                    EmpId    = Convert.ToInt32(r["UID"]),
                    UserName = r["USERNAME"].ToString(),
                    EmpNo    = r["EMPLOYEENO"].ToString(),
                    EmpName  = r["NAME"].ToString()
                }).ToList();

            return Json(new { EmpList = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetEmployees failed");
            return Json(new { Fail = true });
        }
    }

    // ── Bill closing / call log save ──────────────────────────────────────────

    [HttpPost]
    public IActionResult SaveCallLogs([FromBody] SaveCallLogsRequest request)
    {
        try
        {
            var xml = BuildCallLogXml(request.CallLogs);

            SqlParameter[] p =
            [
                new SqlParameter("@xml",                 SqlDbType.Xml)   { Value = xml },
                new SqlParameter("@BusinessCharges",     SqlDbType.Float) { Value = request.Close.BusinessCharges },
                new SqlParameter("@PersonalCharges",     SqlDbType.Float) { Value = request.Close.PersonalCharges },
                new SqlParameter("@PersonalLimitCharges",SqlDbType.Float) { Value = request.Close.PersonalLimitCharges },
                new SqlParameter("@DeductibleAmount",    SqlDbType.Float) { Value = request.Close.DeductibleAmount },
                new SqlParameter("@TOTALAMOUNT",         SqlDbType.Float) { Value = request.Close.TotalAmount },
                new SqlParameter("@BID",                 SqlDbType.Int)   { Value = request.Close.Bid },
                new SqlParameter("@comment",             SqlDbType.VarChar){ Value = request.Close.Comments ?? string.Empty },
                new SqlParameter("@Uid",                 SqlDbType.Int)   { Value = request.Close.Uid },
                new SqlParameter("@Waiver",              SqlDbType.Float) { Value = request.Close.WaiverAmount }
            ];

            var ds   = _db.ExecuteStoredProcDataSet("sp_CloseBill", p);
            var list = MapBills(ds.Tables[0]);

            SendEmailById(request.Close.Bid.ToString());
            return Json(new { dtBills = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("SaveCallLogs", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpPost]
    public IActionResult UpdateRecord([FromBody] List<BillDetails> billDetails)
    {
        try
        {
            var xml = BuildCallLogXml(billDetails);
            _db.ExecuteStoredProcDataSet("sp_SaveCloseBill",
            [
                new SqlParameter("@xml", SqlDbType.Xml) { Value = xml }
            ]);
            return Json(new { Message = "Updated Successfully" });
        }
        catch (Exception ex)
        {
            LogAuditFail("UpdateRecord", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Approval ──────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetApprovalBills([FromQuery] string uid)
    {
        if (!long.TryParse(uid, out long parsedUid) || parsedUid <= 0)
            return Json(new { Error = "Invalid UID" });

        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetArrovalBills",
                [new SqlParameter("@Uid", SqlDbType.Int) { Value = (int)parsedUid }]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new ArrovalBills
            {
                BillId          = Convert.ToInt32(r["BILL_ID"]),
                BillDate        = r["BILLDATE"].ToString(),
                SubNo           = r["SUB_NO"].ToString(),
                Name            = r["NAME"].ToString(),
                Org             = r["ORG"].ToString(),
                Total           = r["TOTALAMOUNT"].ToString(),
                BusinessLimit   = r["BUSSINESSLIMIT"].ToString(),
                BusinessCharges = r["BUSINESSCHARGES"].ToString(),
                DeductableAmount= r["DEDUCTIBLEAMOUNT"].ToString(),
                WaiverAmount    = r["WAIVERAMOUNT"].ToString(),
                Comments        = r["COMMENTS"].ToString(),
                AComments       = " ",
                IsSelected      = false
            }).ToList();

            return Json(new { dtBills = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetApprovalBills failed");
            return Json(new { Fail = true });
        }
    }

    [HttpPost]
    public IActionResult ApproveBills([FromBody] ApproveBillsRequest request)
    {
        try
        {
            var xml = new XElement("newCallLog",
                request.CallLogs.Select(p => new XElement("CallLogRecords",
                    new XAttribute("ID",   p.Id),
                    new XAttribute("Comm", p.Comment ?? string.Empty)))).ToString();

            SqlParameter[] p =
            [
                new SqlParameter("@xml",  SqlDbType.Xml) { Value = xml },
                new SqlParameter("@opt",  SqlDbType.Int) { Value = request.Opt },
                new SqlParameter("@Uid",  SqlDbType.Int) { Value = request.Uid }
            ];

            var ds   = _db.ExecuteStoredProcDataSet("sp_Approve", p);
            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new ArrovalBills
            {
                BillId          = Convert.ToInt32(r["BILL_ID"]),
                BillDate        = r["BILLDATE"].ToString(),
                SubNo           = r["SUB_NO"].ToString(),
                Name            = r["NAME"].ToString(),
                Org             = r["ORG"].ToString(),
                Total           = r["TOTALAMOUNT"].ToString(),
                BusinessLimit   = r["BUSSINESSLIMIT"].ToString(),
                BusinessCharges = r["BUSINESSCHARGES"].ToString(),
                DeductableAmount= r["DEDUCTIBLEAMOUNT"].ToString(),
                WaiverAmount    = r["WAIVERAMOUNT"].ToString(),
                Comments        = r["COMMENTS"].ToString(),
                AComments       = " ",
                IsSelected      = false
            }).ToList();

            SendEmailApprove();
            return Json(new { dtBills = list });
        }
        catch (Exception ex)
        {
            LogAuditFail("ApproveBills", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    [HttpGet]
    public IActionResult GetBillDetailsApproval([FromQuery] string id, [FromQuery] int type = 0)
    {
        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Id",   SqlDbType.Int) { Value = id },
                new SqlParameter("@type", SqlDbType.Int) { Value = 0 }
            ];

            var ds      = _db.ExecuteStoredProcDataSet("sp_GetBillDetailsAppr", p);
            var details = MapBillDetails(ds.Tables[0]);

            string blim = "", mlim = "";
            if (ds.Tables.Count > 1)
            {
                blim = ds.Tables[1].Rows[0]["BussinessLimit"].ToString()!;
                mlim = ds.Tables[1].Rows[0]["MonthlyLimit"].ToString()!;
            }

            var settings = new Settings();
            if (ds.Tables.Count > 2)
            {
                var sr = ds.Tables[2].Rows[0];
                settings = new Settings
                {
                    EnableDiscrepancy   = Convert.ToBoolean(sr["EnableDiscrepancy"]),
                    DedBussinessCharges = Convert.ToBoolean(sr["DedBussinessCharges"]),
                    HideAllowanceLimit  = Convert.ToBoolean(sr["HideAllowanceLimit"]),
                    HidePersonalLimit   = Convert.ToBoolean(sr["HidePersonalLimit"])
                };
            }

            return Json(new { bill_details = details, blim, mlim, setting = settings });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetBillDetailsApproval failed");
            return Json(new { Fail = true });
        }
    }

    // ── Archives ──────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetArchivedBills([FromQuery] string uid)
    {
        if (!long.TryParse(uid, out long parsedUid) || parsedUid <= 0)
            return Json(new { Error = "Invalid UID" });

        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetArchived",
                [new SqlParameter("@Uid", SqlDbType.Int) { Value = (int)parsedUid }]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new ArchiveBill
            {
                BillId       = Convert.ToInt32(r["BILL_ID"]),
                BillDate     = r["BILLDATE"].ToString(),
                Status       = r["STATUS"].ToString(),
                TotalAmount  = r["TOTALAMOUNT"].ToString(),
                Provider     = r["PROVIDER"].ToString(),
                EmployeeName = r["EMPNAME"].ToString(),
                DeductibleAmount = r["DEDUCTIBLEAMOUNT"].ToString(),
                MobileNo     = r["SUB_NO"].ToString(),
                LastUpdatedOn= r["LASTUPDATEDON"].ToString(),
                Currency     = r["Currency"].ToString()
            }).ToList();

            return Json(new { dtBills = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetArchivedBills failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult GetDepartmentBills([FromQuery] string uid)
    {
        if (!long.TryParse(uid, out long parsedUid) || parsedUid <= 0)
            return Json(new { Error = "Invalid UID" });

        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetDepartmentBills",
                [new SqlParameter("@Uid", SqlDbType.Int) { Value = (int)parsedUid }]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new ArchiveBill
            {
                BillId       = Convert.ToInt32(r["BILL_ID"]),
                BillDate     = r["BILLDATE"].ToString(),
                Status       = r["STATUS"].ToString(),
                TotalAmount  = r["TOTALAMOUNT"].ToString(),
                Provider     = r["PROVIDER"].ToString(),
                EmployeeName = r["EMPNAME"].ToString(),
                DeductibleAmount = r["DEDUCTIBLEAMOUNT"].ToString(),
                MobileNo     = r["SUB_NO"].ToString(),
                LastUpdatedOn= r["LASTUPDATEDON"].ToString()
            }).ToList();

            return Json(new { dtBills = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetDepartmentBills failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult GetReportBillArchive([FromQuery] int billId)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetReportBillArchive",
                [new SqlParameter("@bid", SqlDbType.Int) { Value = billId }]);

            var archiveBill = new ArchiveBill();
            if (ds.Tables[0].Rows.Count > 0)
            {
                var r = ds.Tables[0].Rows[0];
                archiveBill = new ArchiveBill
                {
                    EmployeeName      = r["EMPLOYEENAME"].ToString(),
                    Provider          = r["PROVIDER"].ToString(),
                    MobileNo          = r["MOBILENO"].ToString(),
                    BusinessLimit     = r["BUSSINESSLIMIT"].ToString(),
                    MonthlyLimit      = r["MONTHLYLIMIT"].ToString(),
                    TotalAmount       = r["TOTALAMOUNT"].ToString(),
                    BusinessCharges   = r["BUSINESSCHARGES"].ToString(),
                    PersonalCharges   = r["PERSONALCHARGES"].ToString(),
                    PersonalLimitCharges = r["PERSONALLIMITCHARGES"].ToString(),
                    WaiverAmount      = r["WAIVERAMOUNT"].ToString(),
                    DeductibleAmount  = r["DEDUCTIBLEAMOUNT"].ToString(),
                    Comments          = r["COMMENTS"].ToString(),
                    LastUpdatedOn     = r["LASTUPDATEDON"].ToString(),
                    BillDate          = r["BILLDATE"].ToString(),
                    BillId            = Convert.ToInt32(r["BILL_ID"]),
                    Status            = r["STATUS"].ToString()
                };
            }

            var details = ds.Tables.Count > 1 ? MapBillDetails(ds.Tables[1]) : new List<BillDetails>();
            var trans   = ds.Tables.Count > 2
                ? ds.Tables[2].Rows.Cast<DataRow>().Select(r => new TransType { StrTrans = r["TRANS_TYPE"].ToString()! }).ToList()
                : new List<TransType>();

            return Json(new { RptBill = details, Trans = trans, ArchiveBill = archiveBill });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetReportBillArchive failed");
            return Json(new { Fail = true });
        }
    }

    // ── Delegation ────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetDelegate([FromQuery] string uid)
    {
        if (!long.TryParse(uid, out long parsedUid) || parsedUid <= 0)
            return Json(new { Error = "Invalid UID" });

        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetDel",
                [new SqlParameter("@UID", SqlDbType.Int) { Value = (int)parsedUid }]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new Delg
            {
                Id          = Convert.ToInt32(r["ID"]),
                ManagerId   = Convert.ToInt32(r["ManagerID"]),
                ManName     = r["ManagerName"].ToString(),
                SecId       = Convert.ToInt32(r["SecrateryID"]),
                SecName     = r["SecrateryName"].ToString(),
                CanIdentify = Convert.ToBoolean(r["CanIdentify"]),
                CanApprove  = Convert.ToBoolean(r["CanApprove"]),
                StartDate   = Convert.ToDateTime(r["StartDate"]),
                EndDate     = Convert.ToDateTime(r["EndDate"])
            }).ToList();

            return Json(new { dtSec = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetDelegate failed");
            return Json(new { Fail = true });
        }
    }

    [HttpPost]
    public IActionResult SaveDelegate([FromBody] Delg dlg)
    {
        if (dlg is null)                    return Json(new { Error = "Invalid data" });
        if (dlg.SecId <= 0 || dlg.ManagerId <= 0) return Json(new { Error = "Invalid IDs" });
        if (dlg.StartDate > dlg.EndDate)    return Json(new { Error = "Start date must be before end date" });

        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command",   SqlDbType.Int)  { Value = 1 },
                new SqlParameter("@secid",     SqlDbType.Int)  { Value = dlg.SecId },
                new SqlParameter("@managerid", SqlDbType.Int)  { Value = dlg.ManagerId },
                new SqlParameter("@app",       SqlDbType.Bit)  { Value = dlg.CanApprove },
                new SqlParameter("@idt",       SqlDbType.Bit)  { Value = dlg.CanIdentify },
                new SqlParameter("@sdate",     SqlDbType.Date) { Value = dlg.StartDate },
                new SqlParameter("@edate",     SqlDbType.Date) { Value = dlg.EndDate }
            ];
            _db.ExecuteStoredProc("sp_delegate", p);
            return Json(new { Message = "Successfully Added" });
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
        if (dlg is null)                    return Json(new { Error = "Invalid data" });
        if (dlg.SecId <= 0 || dlg.ManagerId <= 0) return Json(new { Error = "Invalid IDs" });
        if (dlg.StartDate > dlg.EndDate)    return Json(new { Error = "Start date must be before end date" });

        try
        {
            SqlParameter[] p =
            [
                new SqlParameter("@Command",   SqlDbType.Int)  { Value = 2 },
                new SqlParameter("@id",        SqlDbType.Int)  { Value = dlg.Id },
                new SqlParameter("@secid",     SqlDbType.Int)  { Value = dlg.SecId },
                new SqlParameter("@managerid", SqlDbType.Int)  { Value = dlg.ManagerId },
                new SqlParameter("@app",       SqlDbType.Bit)  { Value = dlg.CanApprove },
                new SqlParameter("@idt",       SqlDbType.Bit)  { Value = dlg.CanIdentify },
                new SqlParameter("@sdate",     SqlDbType.Date) { Value = dlg.StartDate },
                new SqlParameter("@edate",     SqlDbType.Date) { Value = dlg.EndDate }
            ];
            _db.ExecuteStoredProc("sp_delegate", p);
            return Json(new { Message = "Successfully Updated" });
        }
        catch
        {
            return Json(new { Message = "Update failed. Please insert valid data." });
        }
    }

    [HttpPost]
    public IActionResult DeleteDelegate([FromBody] Delg dlg)
    {
        try
        {
            _db.ExecuteStoredProc("sp_delegate",
            [
                new SqlParameter("@Command", SqlDbType.Int) { Value = 3 },
                new SqlParameter("@id",      SqlDbType.Int) { Value = dlg.Id }
            ]);
            return Json(new { Message = "Successfully Deleted" });
        }
        catch (Exception ex)
        {
            LogAuditFail("DeleteDelegate", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    // ── Email sending ─────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult SendEmailById([FromQuery] string bid)
    {
        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetEmail",
                [new SqlParameter("@bid", SqlDbType.Int) { Value = Convert.ToInt32(bid) }]);
            var host = ds.Tables[2].Rows[0]["smtpsettings"].ToString()!;

            if (ds.Tables[0].Rows.Count > 0)
            {
                foreach (DataRow row in ds.Tables[0].Rows)
                {
                    try
                    {
                        DispatchEmail(row, host);
                        _db.ExecuteStoredProc("sp_MarkAsSent",
                            [new SqlParameter("@id", SqlDbType.Int) { Value = row["Id"].ToString() }]);
                    }
                    catch (Exception ex)
                    {
                        LogAuditFail("SendEmailById-inner", ex, formId: 4);
                    }
                }
            }

            return Json(new { Message = "Email Sent" });
        }
        catch (Exception ex)
        {
            LogAuditFail("SendEmailById", ex);
            return Json(new { myMessage = $"Error: {ex.Message}" });
        }
    }

    private void SendEmailApprove()
    {
        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetEmailApprove");
            var host = ds.Tables[2].Rows[0]["smtpsettings"].ToString()!;

            if (ds.Tables[0].Rows.Count > 0)
            {
                foreach (DataRow row in ds.Tables[0].Rows)
                {
                    try
                    {
                        DispatchEmail(row, host);
                        _db.ExecuteStoredProc("sp_MarkAsSent",
                            [new SqlParameter("@id", SqlDbType.Int) { Value = row["Id"].ToString() }]);
                    }
                    catch (Exception ex)
                    {
                        LogAuditFail("SendEmailApprove-inner", ex, formId: 4);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            LogAuditFail("SendEmailApprove", ex);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static string BuildCallLogXml(IEnumerable<BillDetails> logs)
        => new XElement("newCallLog",
            logs.Select(p => new XElement("CallLogRecords",
                new XAttribute("ID",        p.Id),
                new XAttribute("CALL_TYPE", p.CallType ?? "0"),
                new XAttribute("Comment",   p.Comment  ?? string.Empty)))).ToString();

    private static void DispatchEmail(DataRow row, string host)
    {
        using var message = new MailMessage();
        message.To.Add(row["EmailTo"].ToString()!);
        if (!string.IsNullOrEmpty(row["CC"].ToString()))
            message.CC.Add(row["CC"].ToString()!);
        message.From      = new MailAddress(row["EmailFrom"].ToString()!);
        message.Sender    = new MailAddress(row["EmailFrom"].ToString()!);
        message.Subject   = row["Subject"].ToString()!;
        message.Body      = row["EmailText"].ToString();
        message.IsBodyHtml= true;
        new SmtpClient(host) { UseDefaultCredentials = true }.Send(message);
    }

    private static List<Bill> MapBills(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Bill
        {
            Id           = Convert.ToInt32(r["BILL_ID"]),
            BillDate     = Convert.ToDateTime(r["BILLDATE"]),
            Uid          = Convert.ToInt32(r["UID"]),
            EmpName      = r["NAME"].ToString(),
            BillNumber   = r["BILLNUMBER"].ToString(),
            Mobile       = r["SUB_NO"].ToString(),
            TotalAmount  = Convert.ToDouble(r["TOTALAMOUNT"]),
            LastUpdatedOn= r["LASTUPDATEDON"].ToString(),
            ProviderName = r.Table.Columns.Contains("Provider") ? r["Provider"].ToString() : null,
            Comments     = r.Table.Columns.Contains("COMMENTS") ? r["COMMENTS"].ToString() : null,
            SubsId       = r.Table.Columns.Contains("SUB_NO_ID") ? r["SUB_NO_ID"].ToString() : null,
            ManagerName  = r.Table.Columns.Contains("ManagerName") ? r["ManagerName"].ToString() : null,
            Currency     = r.Table.Columns.Contains("CURRENCY") ? r["CURRENCY"].ToString() : null
        }).ToList();

    private static List<BillDetails> MapBillDetails(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new BillDetails
        {
            Id          = Convert.ToInt32(r["ID"]),
            CallDate    = r["CALLDATE"].ToString()!.Contains(' ')
                          ? r["CALLDATE"].ToString()![..r["CALLDATE"].ToString()!.IndexOf(' ')]
                          : r["CALLDATE"].ToString(),
            CallTime    = r.Table.Columns.Contains("CALLTIME") ? r["CALLTIME"].ToString() : r["SUB_NO"].ToString(),
            TransType   = r["TRANS_TYPE"].ToString(),
            Description = r["DESCRIPTION"].ToString(),
            Name        = r.Table.Columns.Contains("NAME") ? r["NAME"].ToString() : null,
            Duration    = r["DURATION"].ToString(),
            Amount      = Convert.ToDouble(r["AMOUNT"]),
            Comment     = r["COMMENT"].ToString(),
            CallType    = r["CALL_TYPE"]?.ToString() ?? "0",
            Locked      = Convert.ToBoolean(r["ISLOCKED"]),
            Auid        = r.Table.Columns.Contains("AUID") ? Convert.ToInt32(r["AUID"]) : 0,
            DialledNo   = r.Table.Columns.Contains("DIALLEDNO") ? r["DIALLEDNO"].ToString() : null
        }).ToList();

    private static List<Template> MapTemplates(DataTable t) =>
        t.Rows.Cast<DataRow>().Select(r => new Template
        {
            TemplateId   = Convert.ToInt32(r["TemplateId"]),
            TemplateText = r["TText"].ToString()!,
            EmailBcc     = r["EmailBCC"].ToString(),
            EmailFrom    = r["EmailFrom"].ToString(),
            CountryId    = Convert.ToInt32(r["CountryId"]),
            CountryName  = r["COUNTRYNAME"].ToString(),
            Id           = Convert.ToInt32(r["Id"]),
            TemplateName = r["Template"].ToString()!
        }).ToList();

    private string CurrentUid() => HttpContext.Session.GetString("EmpUID") ?? "0";

    private void LogAuditFail(string action, Exception ex, int formId = 1)
    {
        _logger.LogError(ex, "Action={Action} failed", action);
        try
        {
            _db.ExecuteStoredProc("sp_InsertAuditLog",
            [
                new SqlParameter("@FormId",     SqlDbType.Int)      { Value = formId },
                new SqlParameter("@ActionName", SqlDbType.VarChar)  { Value = action },
                new SqlParameter("@Result",     SqlDbType.VarChar)  { Value = "Fail" },
                new SqlParameter("@UserId",     SqlDbType.VarChar)  { Value = CurrentUid() },
                new SqlParameter("@ErrorMsg",   SqlDbType.NVarChar) { Value = ex.ToString().Replace("'", " ") }
            ]);
        }
        catch { /* swallow secondary failures */ }
    }

    // ── Request body records ──────────────────────────────────────────────────

    public record SaveCallLogsRequest(List<BillDetails> CallLogs, Closing Close);
    public record ApproveBillsRequest(List<AppBills> CallLogs, int Opt, int Uid);
}
