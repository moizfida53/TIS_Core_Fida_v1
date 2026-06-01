using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using SAPMobile;
using System.Data;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

// =============================================================================
// BapiBIController
// =============================================================================
/// <summary>
/// Handles SAP BAPI integration: employee sync from SAP and bill export to SAP.
/// All audit/DB calls go through stored procedures — zero inline SQL.
/// </summary>
[RoleAuthorize(Roles.Administrator, Roles.SuperAdmin)]
public class BapiBiController : Controller
{
    private readonly DB _db;
    private readonly ILogger<BapiBiController> _logger;

    public BapiBiController(DB db, ILogger<BapiBiController> logger)
    {
        _db     = db;
        _logger = logger;
    }

    public IActionResult Index() => View();

    // ── Employee sync from SAP ────────────────────────────────────────────────

    /// <summary>
    /// Pulls employee data from the SAP BAPI and upserts into tblUser via stored procedures.
    /// Replaces all original inline INSERT / UPDATE SQL.
    /// </summary>
    public static bool UpdateEmployee(DB db)
    {
        try
        {
            var sap = new SAPProxyMobile(ConnectionSettings.BapiConnectionString);
            var empTable = new ZHR_EMP_INFOTable();
            sap.Zbapi_Get_Employee_Details(ref empTable);

            var dt = empTable.ToADODataTable();
            var p  = new SqlParameter("@dtBAPIData", SqlDbType.Structured) { Value = dt };
            db.ExecuteStoredProc("BAPI_ImportData", [p]);

            UpdateContractor(db);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void UpdateContractor(DB db)
    {
        try
        {
            // Contractor data comes from a separate connection string — still routed through
            // the BAPI_ImportContractor SP which handles its own upsert logic.
            db.ExecuteStoredProc("sp_SyncContractorData", []);
        }
        catch (Exception ex)
        {
            throw new Exception(ex.Message);
        }
    }

    // ── Bill export to SAP ────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult ExportToBapi()
    {
        int total = 0, success = 0, failed = 0;

        try
        {
            var sap = new SAPProxyMobile(ConnectionSettings.BapiConnectionString);
            var ds  = _db.ExecuteStoredProcDataSet("SAP_PostZeroAmountBill");

            if (ds?.Tables[0] is DataTable table)
            {
                total = table.Rows.Count;
                foreach (DataRow row in table.Rows)
                {
                    var posted = "false";
                    try
                    {
                        var amount   = Convert.ToDecimal(row["DeductibleAmount"]);
                        var billId   = row["Bill_ID"].ToString();
                        var billDate = Convert.ToDateTime(row["BillDate"]);
                        var assignNo = $"[{billId}]{row["BillNumber"]}-{billDate:MMM-yy}";

                        sap.Zbapi_Mobile_Bill(amount, assignNo, row["UID"].ToString(),
                            out BAPIRETURN eRet, out BAPIRETURN1 _, out HRHRMM_MSG _);

                        // Spin until message is populated (original pattern preserved)
                        while (eRet.Message == "") ;

                        if (eRet.Message.StartsWith("Successfully"))
                        {
                            _db.ExecuteStoredProc("sp_SapMarkBillPosted",
                            [
                                new SqlParameter("@BillId", SqlDbType.Int) { Value = Convert.ToInt32(billId) }
                            ]);
                            posted = "true";
                            success++;
                        }

                        _db.ExecuteStoredProc("sp_SapInsertMsg",
                        [
                            new SqlParameter("@BillId",  SqlDbType.VarChar) { Value = billId },
                            new SqlParameter("@Message", SqlDbType.VarChar) { Value = eRet.Message.Replace("'", "''") },
                            new SqlParameter("@SentOn",  SqlDbType.VarChar) { Value = DateTime.Now.ToString() },
                            new SqlParameter("@Posted",  SqlDbType.VarChar) { Value = posted },
                            new SqlParameter("@Uid",     SqlDbType.VarChar) { Value = row["UID"].ToString() },
                            new SqlParameter("@Amount",  SqlDbType.Decimal) { Value = amount }
                        ]);
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        AuditTrail(nameof(ExportToBapi), ex.ToString());

                        _db.ExecuteStoredProc("sp_SapInsertMsg",
                        [
                            new SqlParameter("@BillId",  SqlDbType.VarChar) { Value = row["Bill_ID"].ToString() },
                            new SqlParameter("@Message", SqlDbType.VarChar) { Value = ex.ToString().Replace("'", "{") },
                            new SqlParameter("@SentOn",  SqlDbType.VarChar) { Value = DateTime.Now.ToString() },
                            new SqlParameter("@Posted",  SqlDbType.VarChar) { Value = posted },
                            new SqlParameter("@Uid",     SqlDbType.VarChar) { Value = row["UID"].ToString() },
                            new SqlParameter("@Amount",  SqlDbType.Decimal) { Value = row["DeductibleAmount"] }
                        ]);
                    }
                }
            }

            return Json(new { Message = $"{total} Records selected, {success} posted, {failed} failed" });
        }
        catch (Exception ex)
        {
            AuditTrail(nameof(ExportToBapi), ex.ToString());
            return Json(new { Message = "Export failed" });
        }
    }

    private void AuditTrail(string function, string error)
    {
        try
        {
            _db.ExecuteStoredProc("sp_Exception",
            [
                new SqlParameter("@Exception",    SqlDbType.NVarChar) { Value = error },
                new SqlParameter("@FunctionName", SqlDbType.NVarChar) { Value = function }
            ]);
        }
        catch { /* swallow */ }
    }
}

// =============================================================================
// SyncBapiController
// =============================================================================
/// <summary>
/// Provides manual SAP BAPI sync endpoints (test and production).
/// All bulk upsert logic delegated to stored procedures — zero inline SQL.
/// </summary>
[RoleAuthorize(Roles.Administrator, Roles.SuperAdmin)]
public class SyncBapiController : Controller
{
    private readonly DB _db;

    public SyncBapiController(DB db) => _db = db;

    public IActionResult Index() => View();

    // ── Test sync (uses tblUser_BAPI shadow table) ────────────────────────────

    [HttpPost]
    public IActionResult TestSyncBapi()
    {
        try
        {
            var table = new DataView(
                _db.ExecuteStoredProcDataSet("sp_GetBapiShadowTable").Tables[0])
                .ToTable(false, "EMPLOYEENO","NAME","USERNAME","ORG","ORGID","MANAGERID","COSTCENTER");

            _db.ExecuteStoredProc("BAPI_ImportData_test",
            [
                new SqlParameter("@dtBAPIData") { Value = table }
            ]);

            return Json(new { Message = "Data Synced Successfully" });
        }
        catch (Exception ex)
        {
            return Json(new { Message = ex.ToString() });
        }
    }

    // ── Production sync (calls live SAP BAPI) ─────────────────────────────────

    [HttpPost]
    public IActionResult SyncBapiProd()
    {
        try
        {
            var sap      = new SAPProxyMobile(ConnectionSettings.BapiConnectionString);
            var empTable = new ZHR_EMP_INFOTable();
            sap.Zbapi_Get_Employee_Details(ref empTable);

            var table = new DataView(empTable.ToADODataTable())
                .ToTable(false, "Pernr","Ename","Usrid","Orgid","Dept_Name","Manager_No","Costcenter");

            _db.ExecuteStoredProc("BAPI_ImportData",
            [
                new SqlParameter("@dtBAPIData") { Value = table }
            ]);

            return Json(new { Message = "Data Synced Successfully" });
        }
        catch (Exception ex)
        {
            return Json(new { Message = ex.ToString() });
        }
    }
}
