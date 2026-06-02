using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Net.Mail;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

/// <summary>
/// Bill Management — Force Bill, Change Status, Re-Assign, Re-Imburse.
/// All DB calls use stored procedures via DB helper — zero inline SQL.
/// Session access via HttpContext (ASP.NET Core pattern).
/// </summary>
[RoleAuthorize(Roles.SuperAdmin)]
public class BillController : Controller
{
    private readonly DB _db;
    private readonly ILogger<BillController> _logger;

    public BillController(DB db, ILogger<BillController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int SessionInt(string key) =>
        int.TryParse(HttpContext.Session.GetString(key), out var v) ? v : 0;

    private string SessionStr(string key) =>
        HttpContext.Session.GetString(key) ?? string.Empty;

    private bool IsLoggedIn => !string.IsNullOrEmpty(SessionStr("EmpLoginName"));

    // ── Views ─────────────────────────────────────────────────────────────────

    public IActionResult Index()        => IsLoggedIn ? View("ForceBill")     : View("AccessDenied");
    public IActionResult ChangeStatus() => IsLoggedIn ? View(nameof(ChangeStatus)) : View("AccessDenied");
    public IActionResult ReAssignBill() => IsLoggedIn ? View(nameof(ReAssignBill)) : View("AccessDenied");
    public IActionResult ReImburseBill()=> IsLoggedIn ? View(nameof(ReImburseBill)): View("AccessDenied");

    // ── Force Bill — GET grid data ────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetForceBill()
    {
        int countryId = SessionInt("CountryID");
        int roleId    = SessionInt("EmpRoleID");

        if (countryId == 0 || roleId == 0)
            return Json(new { Fail = true, Message = "Session expired or missing CountryID / EmpRoleID" });

        try
        {
            var param = new[]
            {
                new SqlParameter("@RoleId",    SqlDbType.Int) { Value = roleId    },
                new SqlParameter("@CountryId", SqlDbType.Int) { Value = countryId }
            };

            var ds    = _db.ExecuteStoredProcDataSet("[sp_GetForceBills]", param);
            var bills = new List<Bill>();

            foreach (DataRow row in ds.Tables[0].Rows)
            {
                bills.Add(new Bill
                {
                    Id           = Convert.ToInt32(row["BILL_ID"]),
                    BillDate     = Convert.ToDateTime(row["BILLDATE"]),
                    Mobile       = row["Mobile"].ToString(),
                    ProviderName = row["ProviderName"].ToString(),
                    TotalAmount  = Convert.ToDouble(row["Amount"]),
                    EmpName      = row["EmployeeName"].ToString(),
                    ManagerName  = row["ManagerName"].ToString(),
                    Department   = row["ORG"].ToString()
                });
            }

            return Json(new { Bills = bills });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetForceBill failed");
            return Json(new { Fail = true, Message = "Failed to load bills" });
        }
    }

    // ── Force Bill — POST ─────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult ForceBill([FromBody] ForceBillRequest req)
    {
        try
        {
            if (req?.BillIds == null || req.BillIds.Length == 0)
                return Json(new { Success = false, Message = "No bills selected for processing" });

            // Stage bill IDs via stored procedures (replaces inline DELETE/INSERT)
            _db.ExecuteStoredProc("sp_ClearTmpBillIds");

            foreach (var billId in req.BillIds)
            {
                _db.ExecuteStoredProc("sp_InsertTmpBillId", new[]
                {
                    new SqlParameter("@BillId", SqlDbType.Int) { Value = billId }
                });
            }

            // Execute the main Force Bill procedure
            var param = new[]
            {
                new SqlParameter("@Status",     SqlDbType.Int) { Value = req.Status     },
                new SqlParameter("@CallType",   SqlDbType.Int) { Value = req.CallType   },
                new SqlParameter("@chkWavRtl",  SqlDbType.Bit) { Value = req.WavRental  },
                new SqlParameter("@chkWavBus",  SqlDbType.Bit) { Value = req.WavBusiness},
                new SqlParameter("@chkTrain",   SqlDbType.Bit) { Value = req.Train      },
                new SqlParameter("@UID",        SqlDbType.Int) { Value = req.Uid        }
            };

            _db.ExecuteStoredProc("sp_ForceBill", param);

            try
            {
                SendEmailInternal();
                return Json(new { Success = true, Message = "Bills Successfully Processed" });
            }
            catch
            {
                return Json(new { Success = true, Message = "Bill Forced without Sending Email" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ForceBill failed");
            return Json(new { Success = false, Message = "Failed to process bills" });
        }
    }

    // ── Change Status — search ────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetSearchData(bool isStatus)
    {
        int countryId = SessionInt("CountryID");
        int roleId    = SessionInt("EmpRoleID");

        try
        {
            var param = new[]
            {
                new SqlParameter("@IsStatus",  SqlDbType.Bit) { Value = isStatus  },
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId    }
            };

            var ds        = _db.ExecuteStoredProcDataSet("sp_SearchBill", param);
            var employees = new List<Employee>();
            var providers = new List<Provider>();
            var statuses  = new List<BillStatus>();

            foreach (DataRow row in ds.Tables[0].Rows)
                employees.Add(new Employee { EmpId = Convert.ToInt32(row["UID"]), EmpNo = row["EMPLOYEENO"].ToString(), EmpName = row["NAME"].ToString() });

            foreach (DataRow row in ds.Tables[1].Rows)
                providers.Add(new Provider { Id = Convert.ToInt32(row["ID"]), Name = row["Name"].ToString() });

            if (ds.Tables.Count > 2)
                foreach (DataRow row in ds.Tables[2].Rows)
                    statuses.Add(new BillStatus { Id = Convert.ToInt32(row["ID"]), Name = row["Name"].ToString() });

            return Json(new { EmpList = employees, ProviderList = providers, dtStatus = statuses });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetSearchData failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult GetStatus()
    {
        try
        {
            var ds       = _db.ExecuteStoredProcDataSet("sp_GetAllStatuses");
            var statuses = new List<BillStatus>();

            foreach (DataRow row in ds.Tables[0].Rows)
                statuses.Add(new BillStatus { Id = Convert.ToInt32(row["ID"]), Name = row["Name"].ToString() });

            return Json(new { dtStatus = statuses });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetStatus failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult Search([FromQuery] Search search)
    {
        try
        {
            var param = new[]
            {
                new SqlParameter("@Month",    SqlDbType.Int) { Value = search.Month    },
                new SqlParameter("@Year",     SqlDbType.Int) { Value = search.Year     },
                new SqlParameter("@UID",      SqlDbType.Int) { Value = search.Uid      },
                new SqlParameter("@Status",   SqlDbType.Int) { Value = search.Status   },
                new SqlParameter("@Provider", SqlDbType.Int) { Value = search.Provider }
            };

            var ds = _db.ExecuteStoredProcDataSet("SP_ChangeBillStatus_Search", param);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return Json(new { success = false, message = "No data found." });

            var bills = new List<Bill>();
            foreach (DataRow row in ds.Tables[0].Rows)
            {
                bills.Add(new Bill
                {
                    Id          = Convert.ToInt32(row["BILL_ID"]),
                    BillDate    = Convert.ToDateTime(row["BILLDATE"]),
                    Mobile      = row["SUB_NO"].ToString(),
                    EmpName     = row["EMPLOYEENAME"].ToString(),
                    ManagerName = row["Appr_Manager"].ToString(),
                    TotalAmount = Convert.ToDouble(row["TOTALAMOUNT"]),
                    StatusName  = row["STATUSNAME"].ToString(),
                    StatusId    = Convert.ToInt32(row["STATUS"])
                });
            }

            return Json(new { dtData = bills });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Search failed");
            return Json(new { success = false, message = ex.Message });
        }
    }

    [HttpPost]
    public IActionResult ChangeStatusSave(int billId)
    {
        try
        {
            _db.ExecuteStoredProc("SP_ChangeBillStatus_Update", new[]
            {
                new SqlParameter("@Bill_ID", SqlDbType.Int) { Value = billId }
            });

            try
            {
                SendEmailInternal();
                return Json(new { success = true, message = "Status changed to Open successfully and email sent!" });
            }
            catch
            {
                return Json(new { success = true, emailFailed = true, message = "Bill Status Changed BUT email sending failed!" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ChangeStatusSave failed");
            return Json(new { success = false, message = ex.Message });
        }
    }

    // ── Search Open / Close bills ─────────────────────────────────────────────

    [HttpGet]
    public IActionResult SearchOpenBill([FromQuery] Search search)
    {
        try
        {
            var param = new[]
            {
                new SqlParameter("@Month",    SqlDbType.Int) { Value = search.Month    },
                new SqlParameter("@Year",     SqlDbType.Int) { Value = search.Year     },
                new SqlParameter("@UID",      SqlDbType.Int) { Value = search.Uid      },
                new SqlParameter("@Status",   SqlDbType.Int) { Value = search.Status   },
                new SqlParameter("@Provider", SqlDbType.Int) { Value = search.Provider }
            };

            var ds = _db.ExecuteStoredProcDataSet("sp_ReAssignBill_Search", param);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return Json(new { success = false, message = "No data found." });

            var bills = new List<Bill>();
            foreach (DataRow row in ds.Tables[0].Rows)
            {
                bills.Add(new Bill
                {
                    Id          = Convert.ToInt32(row["BILL_ID"]),
                    BillDate    = Convert.ToDateTime(row["BILLDATE"]),
                    Mobile      = row["SUB_NO"].ToString(),
                    EmpName     = row["EMPLOYEENAME"].ToString(),
                    ManagerName = row["Appr_Manager"].ToString(),
                    TotalAmount = Convert.ToDouble(row["TOTALAMOUNT"]),
                    StatusName  = row["STATUSNAME"].ToString(),
                    Uid         = Convert.ToInt32(row["UID"])
                });
            }

            return Json(new { dtData = bills });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SearchOpenBill failed");
            return Json(new { Fail = true });
        }
    }

    [HttpGet]
    public IActionResult SearchCloseBill([FromQuery] Search search)
    {
        try
        {
            // Replaced inline SQL with sp_SearchCloseBill
            var param = new[]
            {
                new SqlParameter("@Month",    SqlDbType.Int) { Value = search.Month    },
                new SqlParameter("@Year",     SqlDbType.Int) { Value = search.Year     },
                new SqlParameter("@UID",      SqlDbType.Int) { Value = search.Uid      },
                new SqlParameter("@Provider", SqlDbType.Int) { Value = search.Provider }
            };

            var ds = _db.ExecuteStoredProcDataSet("sp_SearchCloseBill", param);

            if (ds == null || ds.Tables.Count == 0)
                return Json(new { dtData = new List<Bill>() });

            var bills = new List<Bill>();
            foreach (DataRow row in ds.Tables[0].Rows)
            {
                bills.Add(new Bill
                {
                    Id          = Convert.ToInt32(row["BILL_ID"]),
                    BillDate    = Convert.ToDateTime(row["BILLDATE"]),
                    Mobile      = row["SUB_NO"].ToString(),
                    EmpName     = row["EMPLOYEENAME"].ToString(),
                    ManagerName = row["Appr_Manager"].ToString(),
                    TotalAmount = Convert.ToDouble(row["TOTALAMOUNT"]),
                    StatusName  = row["STATUSNAME"].ToString()
                });
            }

            return Json(new { dtData = bills });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SearchCloseBill failed");
            return Json(new { Fail = true });
        }
    }

    // ── Re-Imburse Bill ───────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult ReimbursingBill([FromBody] ForceBill bill)
    {
        int userId = SessionInt("EmpUID");

        try
        {
            foreach (var billId in bill.BillId)
            {
                // Replaced inline SQL with sp_ReimbursingBill_Item
                _db.ExecuteStoredProc("sp_ReimbursingBill_Item", new[]
                {
                    new SqlParameter("@BillId", SqlDbType.Int) { Value = billId },
                    new SqlParameter("@UserId", SqlDbType.Int) { Value = userId }
                });
            }

            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReimbursingBill failed");

            // Log failure via SP (replaces inline audit log SQL)
            try
            {
                _db.ExecuteStoredProc("sp_LogAuditAction", new[]
                {
                    new SqlParameter("@FormId",     SqlDbType.Int)          { Value = 13                   },
                    new SqlParameter("@ActionName", SqlDbType.NVarChar, 100){ Value = "Re-ImbursementBill" },
                    new SqlParameter("@Result",     SqlDbType.NVarChar, 20) { Value = "Fail"               },
                    new SqlParameter("@UserId",     SqlDbType.Int)          { Value = userId               },
                    new SqlParameter("@ErrorText",  SqlDbType.NVarChar, -1) { Value = ex.Message.Replace("'", " ") }
                });
            }
            catch { /* audit failure must not mask original error */ }

            return Json(new { Fail = true });
        }
    }

    // ── Change Bill Status (batch) ────────────────────────────────────────────

    [HttpPost]
    public IActionResult ChangeBillStatus([FromBody] ChangeBill cs)
    {
        int userId = SessionInt("EmpUID");

        try
        {
            for (int i = 0; i < cs.BillId.Length; i++)
            {
                // Replaced inline SQL with sp_ChangeBillStatus_Item
                _db.ExecuteStoredProc("sp_ChangeBillStatus_Item", new[]
                {
                    new SqlParameter("@BillId", SqlDbType.Int) { Value = cs.BillId[i] },
                    new SqlParameter("@Status", SqlDbType.Int) { Value = cs.Status[i] },
                    new SqlParameter("@UserId", SqlDbType.Int) { Value = userId       }
                });
            }

            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ChangeBillStatus failed");

            try
            {
                _db.ExecuteStoredProc("sp_LogAuditAction", new[]
                {
                    new SqlParameter("@FormId",     SqlDbType.Int)          { Value = 14                  },
                    new SqlParameter("@ActionName", SqlDbType.NVarChar, 100){ Value = "Change Bill Status" },
                    new SqlParameter("@Result",     SqlDbType.NVarChar, 20) { Value = "Fail"              },
                    new SqlParameter("@UserId",     SqlDbType.Int)          { Value = userId              },
                    new SqlParameter("@ErrorText",  SqlDbType.NVarChar, -1) { Value = ex.Message.Replace("'", " ") }
                });
            }
            catch { }

            return Json(new { Fail = true });
        }
    }

    // ── Re-Assign Bill (batch) ────────────────────────────────────────────────

    [HttpPost]
    public IActionResult ReAssigningBill([FromBody] ChangeBill rb)
    {
        int userId = SessionInt("EmpUID");

        try
        {
            for (int i = 0; i < rb.BillId.Length; i++)
            {
                // Replaced inline SQL with sp_ReAssigningBill_Item
                _db.ExecuteStoredProc("sp_ReAssigningBill_Item", new[]
                {
                    new SqlParameter("@BillId",    SqlDbType.Int) { Value = rb.BillId[i] },
                    new SqlParameter("@NewUid",    SqlDbType.Int) { Value = rb.Uid[i]    },
                    new SqlParameter("@LogUserId", SqlDbType.Int) { Value = userId       }
                });
            }

            return Json(new { success = true, message = "Re-Assigned Successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReAssigningBill failed");

            try
            {
                _db.ExecuteStoredProc("sp_LogAuditAction", new[]
                {
                    new SqlParameter("@FormId",     SqlDbType.Int)          { Value = 15              },
                    new SqlParameter("@ActionName", SqlDbType.NVarChar, 100){ Value = "Re-AssingBill" },
                    new SqlParameter("@Result",     SqlDbType.NVarChar, 20) { Value = "Fail"          },
                    new SqlParameter("@UserId",     SqlDbType.Int)          { Value = userId          },
                    new SqlParameter("@ErrorText",  SqlDbType.NVarChar, -1) { Value = ex.Message.Replace("'", " ") }
                });
            }
            catch { }

            return Json(new { success = false, message = "Fail" });
        }
    }

    [HttpPost]
    public IActionResult ReAssignBill_Save(int billId, int uid)
    {
        try
        {
            _db.ExecuteStoredProc("sp_ReAssignBill_Save", new[]
            {
                new SqlParameter("@Bill_ID", SqlDbType.Int) { Value = billId },
                new SqlParameter("@Uid",     SqlDbType.Int) { Value = uid    }
            });

            return Json(new { success = true, message = "Bill Re-Assigned successfully!" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ReAssignBill_Save failed");
            return Json(new { success = false, message = ex.Message });
        }
    }

    // ── Email helper ──────────────────────────────────────────────────────────

    private void SendEmailInternal()
    {
        var ds = _db.ExecuteStoredProcDataSet("sp_GetEmailPipeLine");

        if (ds == null || ds.Tables[0].Rows.Count == 0)
            return;

        string smtpHost = ds.Tables[2].Rows[0]["smtpsettings"].ToString() ?? string.Empty;

        foreach (DataRow row in ds.Tables[0].Rows)
        {
            using var msg = new MailMessage();
            msg.To.Add(row["EmailTo"].ToString()!);
            msg.From   = new MailAddress(row["EmailFrom"].ToString()!);
            msg.Sender = new MailAddress(row["EmailFrom"].ToString()!);
            msg.Subject     = row["Subject"].ToString();
            msg.Body        = row["EmailText"].ToString();
            msg.IsBodyHtml  = true;

            using var smtp = new SmtpClient(smtpHost) { UseDefaultCredentials = true };
            smtp.Send(msg);
        }

        int pipelineId = Convert.ToInt32(ds.Tables[1].Rows[0][0]);
        _db.ExecuteStoredProcDataSet("sp_MarkAsSent", new[]
        {
            new SqlParameter("@id", SqlDbType.Int) { Value = pipelineId }
        });
    }
}

// ── Request DTO (ForceBill POST body) ─────────────────────────────────────────
// Separate from the ForceBill model to allow [FromBody] binding without
// conflicting with the existing ForceBill model used elsewhere.

public class ForceBillRequest
{
    public int[]  BillIds     { get; set; } = [];
    public int    Status      { get; set; }
    public int    CallType    { get; set; }
    public bool   WavRental   { get; set; }
    public bool   WavBusiness { get; set; }
    public bool   Train       { get; set; }
    public int    Uid         { get; set; }
}
