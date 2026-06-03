using System.Data;
using System.Runtime.Versioning;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using TIS.Helpers;

namespace TIS.Controllers;

/// <summary>
/// Active Directory "active status" sync.
///
/// Scans every candidate user in tbluser, checks whether their AD account is
/// disabled, and — for those that are — sets tbluser.IsActive = 0 and records
/// the change in tbl_Active_Sync_AD_Log (via sp_Active_Sync_AD_Log_Add).
///
/// Exposed as a plain GET so it can be triggered by the "Sync AD" button on
/// the Manage Employee page AND by Windows Task Scheduler on a schedule.
///
/// Endpoint:  GET /ActiveDirectorySync/SyncActiveStatus
///
/// Optional protection: if "ActiveSync:ApiKey" is set in appsettings.json, the
/// caller must pass ?key=&lt;that value&gt;. Leave the key unset to allow
/// unauthenticated calls (e.g. when the scheduled task runs as a trusted user
/// on the server itself).
/// </summary>
[SupportedOSPlatform("windows")]
public class ActiveDirectorySyncController : Controller
{
    private readonly DB _db;
    private readonly AdLookupService _ad;
    private readonly IConfiguration _config;
    private readonly ILogger<ActiveDirectorySyncController> _logger;

    public ActiveDirectorySyncController(
        DB db,
        AdLookupService ad,
        IConfiguration config,
        ILogger<ActiveDirectorySyncController> logger)
    {
        _db     = db;
        _ad     = ad;
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult SyncActiveStatus(string? key = null)
    {
        // ── Optional shared-key guard ──────────────────────────────────────────
        var configuredKey = _config["ActiveSync:ApiKey"];
        if (!string.IsNullOrWhiteSpace(configuredKey) &&
            !string.Equals(key, configuredKey, StringComparison.Ordinal))
        {
            return Unauthorized(new { success = false, message = "Invalid or missing API key." });
        }

        if (!_ad.IsConfigured)
        {
            LogAuditFail("ActiveDirectorySync", "Active Directory is not configured (ActiveDirectory:Domain).");
            return Json(new { success = false, message = "Active Directory is not configured. Set 'ActiveDirectory:Domain' in appsettings.json." });
        }

        int checkedCount = 0, disabledCount = 0, notFound = 0, errorCount = 0;
        var disabledUsers = new List<object>();

        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetUsersForActiveSync");
            if (ds == null || ds.Tables.Count == 0)
                return Json(new { success = true, message = "No users to evaluate.", checkedCount = 0, disabled = 0 });

            foreach (DataRow row in ds.Tables[0].Rows)
            {
                int uid       = Convert.ToInt32(row["UID"]);
                string user   = row["username"]?.ToString() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(user)) continue;

                checkedCount++;

                try
                {
                    var (found, disabled) = _ad.GetAccountStatus(user);

                    if (!found) { notFound++; continue; }

                    if (disabled)
                    {
                        // Set IsActive = 0 and log the change (single transaction in the SP).
                        _db.ExecuteStoredProc("sp_Active_Sync_AD_Log_Add",
                        [
                            new SqlParameter("@UID",      SqlDbType.Int) { Value = uid },
                            new SqlParameter("@IsActive", SqlDbType.Bit) { Value = false }
                        ]);

                        disabledCount++;
                        disabledUsers.Add(new { uid, username = user });
                    }
                }
                catch (Exception perUserEx)
                {
                    // Don't let one bad user abort the whole sync — log and continue.
                    errorCount++;
                    LogAuditFail("ActiveDirectorySync", new Exception($"User '{user}' (UID {uid}) failed: {perUserEx.Message}", perUserEx));
                }
            }

            return Json(new
            {
                success       = true,
                message       = $"AD sync complete. Checked {checkedCount}, disabled {disabledCount}, not found in AD {notFound}, errors {errorCount}.",
                checkedCount,
                disabled      = disabledCount,
                notFound,
                errors        = errorCount,
                disabledUsers
            });
        }
        catch (Exception ex)
        {
            // Record the failure in the audit trail (tblaudittrail via sp_InsertAuditLog).
            LogAuditFail("ActiveDirectorySync", ex);
            return Json(new { success = false, message = $"AD sync failed: {ex.Message}" });
        }
    }

    // ── Audit-trail logging (writes to the app audit tables via sp_InsertAuditLog) ──
    private void LogAuditFail(string action, string message) => LogAuditFail(action, new Exception(message));

    private void LogAuditFail(string action, Exception ex)
    {
        _logger.LogError(ex, "Action={Action} failed", action);

        SqlParameter[] p =
        [
            new SqlParameter("@FormId",     SqlDbType.Int)      { Value = 1 },
            new SqlParameter("@ActionName", SqlDbType.VarChar)  { Value = action },
            new SqlParameter("@Result",     SqlDbType.VarChar)  { Value = "Fail" },
            new SqlParameter("@UserId",     SqlDbType.VarChar)  { Value = "System" },
            new SqlParameter("@ErrorMsg",   SqlDbType.NVarChar) { Value = ex.ToString().Replace("'", " ") }
        ];

        try { _db.ExecuteStoredProc("sp_InsertAuditLog", p); }
        catch { /* never let audit logging break the sync */ }
    }
}
