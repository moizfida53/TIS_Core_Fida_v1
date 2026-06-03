using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Net.Mail;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

/// <summary>
/// Send Email — view pending/queued emails, edit recipient details, send and
/// delete. Replaces the legacy jqxGrid WebForms page (TIS_MVC/SendEmail).
/// All DB calls use stored procedures via the DB helper — zero inline SQL.
/// Audit failures are logged through sp_LogAuditAction (FORM_ID 4).
/// </summary>
[RoleAuthorize(Roles.Administrator, Roles.SuperAdmin)]
public class SendEmailController : Controller
{
    private const int AuditFormId = 4;   // matches legacy FORM_ID for Send Email

    private readonly DB _db;
    private readonly ILogger<SendEmailController> _logger;

    public SendEmailController(DB db, ILogger<SendEmailController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int SessionInt(string key) =>
        int.TryParse(HttpContext.Session.GetString(key), out var v) ? v : 0;

    private void LogFailure(string action, string error)
    {
        try
        {
            _db.ExecuteStoredProc("sp_LogAuditAction", new[]
            {
                new SqlParameter("@FormId",     SqlDbType.Int)           { Value = AuditFormId               },
                new SqlParameter("@ActionName", SqlDbType.NVarChar, 100) { Value = action                    },
                new SqlParameter("@Result",     SqlDbType.NVarChar, 20)  { Value = "Fail"                    },
                new SqlParameter("@UserId",     SqlDbType.Int)           { Value = SessionInt("EmpUID")      },
                new SqlParameter("@ErrorText",  SqlDbType.NVarChar, -1)  { Value = (error ?? "").Replace("'", " ") }
            });
        }
        catch { /* audit failure must never mask the original error */ }
    }

    /// <summary>Minimal email validation — contains '@' with text on both sides of the last dot.</summary>
    private static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        int at  = email.IndexOf('@');
        int dot = email.LastIndexOf('.');
        return at > 0 && dot > at + 1 && dot < email.Length - 1;
    }

    // ── View ──────────────────────────────────────────────────────────────────

    public IActionResult SendEmail() => View();

    // ── Grid data ───────────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetEmail()
    {
        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetSendEmail");
            var list = new List<Models.SendEmail>();

            if (ds.Tables.Count > 0)
            {
                foreach (DataRow row in ds.Tables[0].Rows)
                {
                    list.Add(new Models.SendEmail
                    {
                        Id         = Convert.ToInt32(row["Id"]),
                        TemplateId = Convert.ToInt32(row["TemplateId"]),
                        BillId     = Convert.ToInt32(row["Bill_Id"]),
                        BillDate   = Convert.ToDateTime(row["BillDate"]).ToString("MMM-yyyy"),
                        Subject    = row["Subject"].ToString(),
                        EmailText  = row["EmailText"].ToString(),
                        EmailFrom  = row["EmailFrom"].ToString(),
                        EmailTo    = row["EmailTo"].ToString(),
                        Cc         = row["CC"].ToString(),
                        Sent       = Convert.ToBoolean(row["sent"]),
                        SentOn     = row["senton"].ToString()
                    });
                }
            }

            return Json(new { dtSendEmail = list });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetEmail failed");
            return Json(new { Fail = true, Message = "Failed to load emails" });
        }
    }

    // ── Send selected emails ────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult Send([FromBody] Models.SendEmail value)
    {
        if (value?.Bid == null || value.Bid.Length == 0)
            return Json(new { Message = "Fail", Detail = "No bills selected" });

        try
        {
            foreach (var billId in value.Bid)
            {
                var ds = _db.ExecuteStoredProcDataSet("sp_GetEmail", new[]
                {
                    new SqlParameter("@bid", SqlDbType.Int) { Value = billId }
                });

                if (ds == null || ds.Tables[0].Rows.Count == 0)
                    continue;

                string host = ds.Tables[2].Rows[0]["smtpsettings"].ToString() ?? string.Empty;

                foreach (DataRow row in ds.Tables[0].Rows)
                {
                    string to = row["EmailTo"].ToString() ?? string.Empty;
                    string cc = row["CC"].ToString() ?? string.Empty;

                    bool ok;
                    using var msg = new MailMessage();

                    if (string.IsNullOrEmpty(cc))
                    {
                        ok = IsValidEmail(to);
                        if (ok) msg.To.Add(to);
                    }
                    else
                    {
                        ok = IsValidEmail(to) && IsValidEmail(cc);
                        if (ok) { msg.To.Add(to); msg.CC.Add(cc); }
                    }

                    if (!ok) continue;

                    msg.From       = new MailAddress(row["EmailFrom"].ToString()!);
                    msg.Sender     = new MailAddress(row["EmailFrom"].ToString()!);
                    msg.Subject    = row["Subject"].ToString();
                    msg.Body       = row["EmailText"].ToString();
                    msg.IsBodyHtml = true;

                    using var smtp = new SmtpClient(host) { UseDefaultCredentials = true };
                    smtp.Send(msg);

                    _db.ExecuteStoredProcDataSet("sp_MarkAsSent", new[]
                    {
                        new SqlParameter("@id", SqlDbType.Int) { Value = Convert.ToInt32(row["Id"]) }
                    });
                }
            }

            return Json(new { Message = "Email Sent" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Send failed");
            LogFailure("Send Email", ex.ToString());
            return Json(new { Message = "Fail" });
        }
    }

    // ── Save (inline/modal edit) ────────────────────────────────────────────────

    [HttpPost]
    public IActionResult Save([FromBody] Models.SendEmail value)
    {
        try
        {
            _db.ExecuteStoredProcDataSet("sp_Save", new[]
            {
                new SqlParameter("@Bill_Id",   SqlDbType.Int)          { Value = value.BillId               },
                new SqlParameter("@EmailText", SqlDbType.NVarChar, -1) { Value = (object?)value.EmailText ?? DBNull.Value },
                new SqlParameter("@EmailTo",   SqlDbType.NVarChar, -1) { Value = (object?)value.EmailTo   ?? DBNull.Value },
                new SqlParameter("@CC",        SqlDbType.NVarChar, -1) { Value = (object?)value.Cc        ?? DBNull.Value }
            });

            return Json(new { Message = "Success" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Save failed");
            return Json(new { Message = "Fail" });
        }
    }

    // ── Delete selected emails ──────────────────────────────────────────────────

    [HttpPost]
    public IActionResult DeleteEmail([FromBody] Models.SendEmail value)
    {
        if (value?.EmailId == null || value.EmailId.Length == 0)
            return Json(new { Message = "Fail", Detail = "No emails selected" });

        try
        {
            foreach (var id in value.EmailId)
            {
                _db.ExecuteStoredProcDataSet("sp_DeleteEmail", new[]
                {
                    new SqlParameter("@Id", SqlDbType.Int) { Value = id }
                });
            }

            return Json(new { Message = "Deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DeleteEmail failed");
            return Json(new { Message = "Fail" });
        }
    }

    // ── Mark selected emails as sent ────────────────────────────────────────────
    // Flags the selected rows as Sent = 1 in tbl_Emails by Id via sp_MarkEmailAsSent.
    // This is a plain status update that succeeds even when EmailTo / CC are
    // NULL or blank (unlike the legacy sp_MarkAsSent pipeline proc). No rows are
    // deleted. Each row is updated independently so one bad row cannot fail the batch.

    [HttpPost]
    public IActionResult MarkAsSent([FromBody] Models.SendEmail value)
    {
        if (value?.EmailId == null || value.EmailId.Length == 0)
            return Json(new { Message = "Fail", Detail = "No emails selected" });

        int marked = 0;
        foreach (var id in value.EmailId)
        {
            try
            {
                _db.ExecuteStoredProc("sp_MarkEmailAsSent", new[]
                {
                    new SqlParameter("@Id", SqlDbType.Int) { Value = id }
                });
                marked++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MarkAsSent failed for Id {Id}", id);
            }
        }

        return marked > 0
            ? Json(new { Message = "Marked", Count = marked })
            : Json(new { Message = "Fail" });
    }

    // ── Reminder / scheduler endpoints ──────────────────────────────────────────
    // Preserved from the legacy controller for external schedulers. Each seeds a
    // reminder queue via its SP, then dispatches any pending emails.

    [HttpPost]
    public IActionResult SetReminder()
    {
        _db.ExecuteStoredProcDataSet("sp_BillIdentification_Reminder");
        return GetAndSendPendingEmail();
    }

    [HttpPost]
    public IActionResult SetForceBillReminder()
    {
        _db.ExecuteStoredProcDataSet("sp_ForceBill_Reminder");
        return GetAndSendPendingEmail();
    }

    [HttpPost]
    public IActionResult SetForceBillReminderNew()
    {
        _db.ExecuteStoredProcDataSet("sp_SetForceBill_ReminderNew");
        return GetAndSendPendingEmail();
    }

    [HttpPost]
    public IActionResult SetBillReminderNew()
    {
        _db.ExecuteStoredProcDataSet("sp_SetBill_ReminderNew");
        return GetAndSendPendingEmail();
    }

    [HttpPost]
    public IActionResult SetBillApprovalReminderNew()
    {
        _db.ExecuteStoredProcDataSet("SP_BillApprovalReminder_New");
        return GetAndSendPendingEmail();
    }

    [HttpPost]
    public IActionResult GetAndSendPendingEmail()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetPendingEmail");

            if (ds == null || ds.Tables[0].Rows.Count == 0)
                return Json(new { Message = "Email Sent" });

            string host = ds.Tables[2].Rows[0]["smtpsettings"].ToString() ?? string.Empty;

            foreach (DataRow row in ds.Tables[0].Rows)
            {
                string cc = row["CC"].ToString() ?? string.Empty;

                using var msg = new MailMessage();
                msg.To.Add(row["EmailTo"].ToString()!);
                if (!string.IsNullOrEmpty(cc)) msg.CC.Add(cc);

                msg.From       = new MailAddress(row["EmailFrom"].ToString()!);
                msg.Sender     = new MailAddress(row["EmailFrom"].ToString()!);
                msg.Subject    = row["Subject"].ToString();
                msg.Body       = row["EmailText"].ToString();
                msg.IsBodyHtml = true;

                using var smtp = new SmtpClient(host) { UseDefaultCredentials = true };
                smtp.Send(msg);

                _db.ExecuteStoredProcDataSet("sp_MarkAsSent", new[]
                {
                    new SqlParameter("@id", SqlDbType.Int) { Value = Convert.ToInt32(row["Id"]) }
                });
            }

            return Json(new { Message = "Email Sent" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetAndSendPendingEmail failed");
            LogFailure("Send Email", ex.ToString());
            return Json(new { Message = "Fail" });
        }
    }
}
