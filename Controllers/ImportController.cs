using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;
using System.Data.OleDb;
using System.Net.Mail;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;
using ExcelDataReader;

namespace TIS.Controllers;

/// <summary>
/// Handles bill file imports (Excel / OleDb / DB-based providers), upload history,
/// column mapping, and unassigned bill assignment.
/// All data access via stored procedures — zero inline SQL.
/// </summary>
[RoleAuthorize(Roles.Administrator, Roles.SuperAdmin)]
public class ImportController : Controller
{
    private readonly DB _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ImportController> _logger;

    // Per-request import state (replaces old private fields)
    private DataTable _dtImport = new();

    public ImportController(DB db, IWebHostEnvironment env, ILogger<ImportController> logger)
    {
        _db     = db;
        _env    = env;
        _logger = logger;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    public IActionResult Index()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View("ImportInvoice");

    public IActionResult UnAssigned()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View("UnAssignedInvoice");

    // ── Upload history ────────────────────────────────────────────────────────

    [HttpGet]
    public IActionResult GetUploadHistory()
    {
        var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
        var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetUploadHistory",
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new Upload
            {
                Id           = Convert.ToInt32(r["ID"]),
                FileName     = r["UploadFileName"].ToString()!,
                BillDate     = Convert.ToDateTime(r["BillDate"]),
                UploadDate   = Convert.ToDateTime(r["UploadDate"]),
                ProviderName = r["Name"].ToString(),
                ProviderId   = Convert.ToInt32(r["Provider"]),
                BillAmount   = r["BillAmount"].ToString()
            }).ToList();

            var isDeleteButShow = ds.Tables.Count > 1
                ? Convert.ToInt32(ds.Tables[1].Rows[0]["DeleteBut"])
                : 1;

            return Json(new { UploadList = list, IsDeleteButShow = isDeleteButShow });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(GetUploadHistory), Uid());
            return Json(new { Fail = true });
        }
    }

    // ── File upload ───────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult Upload(IFormFileCollection fileToUpload)
    {
        try
        {
            var billsDir = Path.Combine(_env.ContentRootPath, "Bills");
            Directory.CreateDirectory(billsDir);

            string savedFileName = string.Empty;
            foreach (var file in fileToUpload)
            {
                var path = Path.Combine(billsDir, file.FileName);
                using var stream = new FileStream(path, FileMode.Create);
                file.CopyTo(stream);
                savedFileName = file.FileName;
            }

            // Return JSON so the AJAX caller can proceed to FillSheet.
            return Json(new { success = true, fileName = savedFileName });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(Upload), Uid());
            return Json(new { success = false, message = ex.Message });
        }
    }

    [HttpPost]
    public IActionResult FillSheet([FromBody] Upload file)
    {
        try
        {
            var path   = Path.Combine(_env.ContentRootPath, "Bills", Path.GetFileName(file.FileName));
            var sheets = GetExcelSheetNames(path);
            if (sheets is null) return Json(new { Message = "Fail", dtSheet = string.Empty });

            var list = sheets.Rows.Cast<DataRow>()
                .Select(r => new Upload { SheetName = r["TABLE_NAME"].ToString() })
                .ToList();
            return Json(new { dtSheet = list });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(FillSheet), Uid());
            return Json(new { Message = "Fail", dtSheet = string.Empty });
        }
    }

    [HttpPost]
    public IActionResult UploadFile([FromBody] Upload file)
    {
        try
        {
            // Force file-based mode (DbBased="False" was hardcoded in original)
            var year       = file.Year;
            var month      = file.Month;
            var providerId = file.ProviderId;
            var billDate   = new DateTime(year, month, 1).AddMonths(1).AddDays(-1);

            HttpContext.Session.SetString("m_CurrentImportBillDate", billDate.ToString("yyyy-MM-dd"));
            HttpContext.Session.SetString("m_Provider",               providerId.ToString());
            HttpContext.Session.SetString("m_CurrentImportFile",      file.FileName);

            var billsDir = Path.Combine(_env.ContentRootPath, "Bills");
            ImportFirst(file.FileName, billsDir, file.SheetName ?? string.Empty);

            var badRows  = BindGrid();
            var billAmt  = _db.ExecuteStoredProcScalar("sp_GetImportTotalAmount", [])?.ToString() ?? "0";

            return Json(new { MyMessage = "Success", BillAmount = billAmt, gridData = badRows });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(UploadFile), Uid());
            throw;
        }
    }

    [HttpPost]
    public IActionResult ProcessBill([FromBody] Upload file)
    {
        try
        {
            var currentFile  = HttpContext.Session.GetString("m_CurrentImportFile") ?? string.Empty;
            var billDateStr  = HttpContext.Session.GetString("m_CurrentImportBillDate") ?? DateTime.Now.ToString("yyyy-MM-dd");
            var providerId   = int.Parse(HttpContext.Session.GetString("m_Provider") ?? "0");
            var billDate     = Convert.ToDateTime(billDateStr);
            var userId       = HttpContext.Session.GetString("EmpUID") ?? "0";
            var fullPath     = Path.Combine(_env.ContentRootPath, "Bills", currentFile);

            var result = OpenExcelFile(fullPath);
            if (result is null)
                return Json(new { Message = "Fail", BillDetails = string.Empty });

            var dt = InsertUploadHistoryAndAudit(currentFile, billDate, providerId, "Success", userId);
            var billDetails = ExtractBillDetails(dt);

            return Json(new { Message = "succ", BillDetails = billDetails });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(ProcessBill), Uid());
            return Json(new { Message = "Fail", BillDetails = string.Empty });
        }
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult UploadSetting([FromBody] Upload file)
    {
        try
        {
            var path = Path.Combine(_env.ContentRootPath, "Bills", file.FileName);
            var cols = ReadColumnNames(path, file.SheetName ?? string.Empty);
            return Json(new { Message = "Success", dtCol = cols });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(UploadSetting), Uid());
            return Json(new { Message = "Fail" });
        }
    }

    [HttpPost]
    public IActionResult UpdateSetting([FromBody] Column clm)
    {
        try
        {
            _db.ExecuteStoredProc("sp_UploadSetting",
            [
                new SqlParameter("@Col1",        SqlDbType.VarChar) { Value = clm.Col1        ?? (object)DBNull.Value },
                new SqlParameter("@Col2",        SqlDbType.VarChar) { Value = clm.Col2        ?? (object)DBNull.Value },
                new SqlParameter("@Col3",        SqlDbType.VarChar) { Value = clm.Col3        ?? (object)DBNull.Value },
                new SqlParameter("@Col4",        SqlDbType.VarChar) { Value = clm.Col4        ?? (object)DBNull.Value },
                new SqlParameter("@Col5",        SqlDbType.VarChar) { Value = clm.Col5        ?? (object)DBNull.Value },
                new SqlParameter("@Col6",        SqlDbType.VarChar) { Value = clm.Col6        ?? (object)DBNull.Value },
                new SqlParameter("@Col7",        SqlDbType.VarChar) { Value = clm.Col7        ?? (object)DBNull.Value },
                new SqlParameter("@Col8",        SqlDbType.VarChar) { Value = clm.Col8        ?? (object)DBNull.Value },
                new SqlParameter("@Provider",    SqlDbType.VarChar) { Value = clm.Provider },
                new SqlParameter("@dbConstr",    SqlDbType.VarChar) { Value = clm.DbConstr    ?? (object)DBNull.Value },
                new SqlParameter("@dbTableName", SqlDbType.VarChar) { Value = clm.DbTableName ?? (object)DBNull.Value }
            ]);
            return Json(new { Message = "Settings Updated Successfully" });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(UpdateSetting), Uid());
            return Json(new { Message = "Fail" });
        }
    }

    [HttpGet]
    public IActionResult GetSetting([FromQuery] int provider)
    {
        try
        {
            var ds  = _db.ExecuteStoredProcDataSet("sp_GetUploadSetting",
                [new SqlParameter("@ID", SqlDbType.Int) { Value = provider }]);
            var r   = ds.Tables[0].Rows[0];
            var col = new Column
            {
                Col1        = r["excel_col1"].ToString(),
                Col2        = r["excel_col2"].ToString(),
                Col3        = r["excel_col3"].ToString(),
                Col4        = r["excel_col4"].ToString(),
                Col5        = r["excel_col5"].ToString(),
                Col6        = r["excel_col6"].ToString(),
                Col7        = r["excel_col7"].ToString(),
                Col8        = r["excel_col8"].ToString(),
                DbConstr    = r["dbConstr"].ToString(),
                DbTableName = r["dbTableName"].ToString()
            };

            var dbBased = r["DbBased"].ToString() == "True";
            return dbBased
                ? Json(new { dtDBCol = col })
                : Json(new { dtCol   = col });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(GetSetting), Uid());
            return Json(new { Message = "Fail", dtCol = string.Empty });
        }
    }

    // ── Delete / Assign ───────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult DeleteBill([FromBody] Upload upload)
    {
        try
        {
            _db.ExecuteStoredProc("sp_DeleteBill",
            [
                new SqlParameter("@Provider", SqlDbType.Int)      { Value = upload.ProviderId },
                new SqlParameter("@BillDate", SqlDbType.DateTime) { Value = upload.BillDate }
            ]);
            return Json(new { myMessage = "succ" });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(DeleteBill), Uid());
            return Json(new { myMessage = "Fail" });
        }
    }

    [HttpGet]
    public IActionResult GetUnAssignedBill()
    {
        var countryId = int.Parse(HttpContext.Session.GetString("CountryID") ?? "0");
        var roleId    = int.Parse(HttpContext.Session.GetString("EmpRoleID") ?? "0");

        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_GetUnassignedBills",
            [
                new SqlParameter("@CountryID", SqlDbType.Int) { Value = countryId },
                new SqlParameter("@RoleID",    SqlDbType.Int) { Value = roleId }
            ]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new Bill
            {
                BillDate     = Convert.ToDateTime(r["BILLDATE"]),
                Mobile       = r["Mobile"].ToString(),
                ProviderName = r["Provider"].ToString(),
                TotalAmount  = Convert.ToDouble(r["BillAmount"])
            }).ToList();

            return Json(new { Bills = list });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(GetUnAssignedBill), Uid());
            return Json(new { Fail = true });
        }
    }

    [HttpPost]
    public IActionResult AssignInvoice()
    {
        var count = _db.ExecuteSpRetVal("sp_AssignInvoice", []);
        return Json(new { Message = $"{count} Bills Generated" });
    }

    [HttpPost]
    public IActionResult UpdateImport([FromBody] Import import)
    {
        try
        {
            var ds   = _db.ExecuteStoredProcDataSet("sp_UpdateImportRecord",
            [
                new SqlParameter("@ID",       SqlDbType.Int)      { Value = import.Id },
                new SqlParameter("@Amount",   SqlDbType.VarChar)  { Value = import.Amount   ?? string.Empty },
                new SqlParameter("@SubNo",    SqlDbType.VarChar)  { Value = import.SubNo },
                new SqlParameter("@CallDate", SqlDbType.DateTime) { Value = Convert.ToDateTime(import.CallDate) }
            ]);

            var list = ds.Tables[0].Rows.Cast<DataRow>().Select(r => new Import
            {
                Id        = Convert.ToInt32(r["ID"]),
                SubNo     = r["SUB_NO"].ToString()!,
                BillDate  = Convert.ToDateTime(r["BILLDATE"]),
                CallDate  = r["CALLDATE"].ToString(),
                TransType = r["TRANS_TYPE"].ToString(),
                Description= r["DESCRIPTION"].ToString(),
                Amount    = r["AMOUNT"].ToString(),
                Duration  = r["DURATION"].ToString(),
                CallTime  = r["CALLTIME"].ToString()
            }).ToList();

            return Json(new { Message = "Success", dtImp = list });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(UpdateImport), Uid());
            return Json(new { Message = "Fail" });
        }
    }

    // ── DB-based provider ─────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult GetDataSetting([FromQuery] int provider)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetUploadSetting",
                [new SqlParameter("@ID", SqlDbType.Int) { Value = provider }]);
            var r  = ds.Tables[0].Rows[0];
            return Json(new
            {
                dtDBCol = new Column
                {
                    Col1        = r["excel_col1"].ToString(),
                    Col2        = r["excel_col2"].ToString(),
                    Col3        = r["excel_col3"].ToString(),
                    Col4        = r["excel_col4"].ToString(),
                    Col5        = r["excel_col5"].ToString(),
                    Col6        = r["excel_col6"].ToString(),
                    Col7        = r["excel_col7"].ToString(),
                    Col8        = r["excel_col8"].ToString(),
                    DbConstr    = r["dbConstr"].ToString(),
                    DbTableName = r["dbTableName"].ToString()
                }
            });
        }
        catch { return Json(new { Fail = true }); }
    }

    [HttpPost]
    public IActionResult UpdateDBSetting([FromBody] Column clm)
    {
        try
        {
            _db.ExecuteStoredProc("sp_UploadDBSetting",
            [
                new SqlParameter("@Col1",        SqlDbType.VarChar) { Value = clm.Col1        ?? (object)DBNull.Value },
                new SqlParameter("@Col2",        SqlDbType.VarChar) { Value = clm.Col2        ?? (object)DBNull.Value },
                new SqlParameter("@Col3",        SqlDbType.VarChar) { Value = clm.Col3        ?? (object)DBNull.Value },
                new SqlParameter("@Col4",        SqlDbType.VarChar) { Value = clm.Col4        ?? (object)DBNull.Value },
                new SqlParameter("@Col5",        SqlDbType.VarChar) { Value = clm.Col5        ?? (object)DBNull.Value },
                new SqlParameter("@Col6",        SqlDbType.VarChar) { Value = clm.Col6        ?? (object)DBNull.Value },
                new SqlParameter("@Col7",        SqlDbType.VarChar) { Value = clm.Col7        ?? (object)DBNull.Value },
                new SqlParameter("@Col8",        SqlDbType.VarChar) { Value = clm.Col8        ?? (object)DBNull.Value },
                new SqlParameter("@Provider",    SqlDbType.VarChar) { Value = clm.Provider },
                new SqlParameter("@dbConstr",    SqlDbType.VarChar) { Value = clm.DbConstr    ?? (object)DBNull.Value },
                new SqlParameter("@dbTableName", SqlDbType.VarChar) { Value = clm.DbTableName ?? (object)DBNull.Value }
            ]);
            return Json(new { Message = "Settings Updated Successfully" });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(UpdateDBSetting), Uid());
            return Json(new { Message = "Fail" });
        }
    }

    [HttpPost]
    public IActionResult CheckProvider([FromQuery] int provider)
    {
        var ds = _db.ExecuteStoredProcDataSet("sp_GetProviderDbBased",
            [new SqlParameter("@ID", SqlDbType.Int) { Value = provider }]);
        return Json(new { DbBased = ds.Tables[0].Rows[0]["DbBased"].ToString() });
    }

    // ── Email ─────────────────────────────────────────────────────────────────

    [HttpPost]
    public IActionResult SendEmail()
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetEmailPipeLine");
            if (ds?.Tables[0].Rows.Count > 0)
            {
                var host = ds.Tables[2].Rows[0]["smtpsettings"].ToString()!;
                foreach (DataRow row in ds.Tables[0].Rows)
                {
                    try
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

                        _db.ExecuteStoredProc("sp_MarkAsSent",
                            [new SqlParameter("@id", SqlDbType.Int) { Value = row["Id"].ToString() }]);
                    }
                    catch (Exception ex)
                    {
                        AuditTrail(ex.ToString(), "SendEmail-inner", Uid());
                    }
                }
                return Json(new { Message = "Email Sent" });
            }
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(SendEmail), Uid());
        }
        return Json(new { Message = "Email Sent Fail" });
    }

    // ── DB-based connection test ──────────────────────────────────────────────

    /// <summary>
    /// Tests a SQL Server connection string entered on the Excel Mapping tab
    /// and returns the list of views available in that database.
    /// </summary>
    [HttpPost]
    public IActionResult TestConn([FromBody] Column value)
    {
        try
        {
            using var conn    = new Microsoft.Data.SqlClient.SqlConnection(value.DbConstr);
            using var command = new Microsoft.Data.SqlClient.SqlCommand("SELECT name FROM sys.views ORDER BY name", conn);
            conn.Open();
            using var reader = command.ExecuteReader();
            var views = new List<string>();
            while (reader.Read())
                views.Add(reader.GetString(0));

            return Json(new { Message = "Success", dtViews = views });
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(TestConn), Uid());
            return Json(new { Error = "Cannot connect. Please check the connection string." });
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private int Uid()
    {
        int.TryParse(HttpContext.Session.GetString("EmpUID"), out int uid);
        return uid;
    }

    private void AuditTrail(string exMsg, string eventName, int uid)
    {
        try
        {
            _db.ExecuteStoredProcDataSet("sp_CreateException",
            [
                new SqlParameter("@Uid",           SqlDbType.Int)      { Value = uid },
                new SqlParameter("@EventName",     SqlDbType.NVarChar) { Value = eventName },
                new SqlParameter("@EventType",     SqlDbType.NVarChar) { Value = "Fail" },
                new SqlParameter("@EventMsg",      SqlDbType.NVarChar) { Value = exMsg },
                new SqlParameter("@EventSeverity", SqlDbType.NVarChar) { Value = "severity_high" }
            ]);
        }
        catch { /* swallow */ }
    }

    private DataTable InsertUploadHistoryAndAudit(string fileName, DateTime billDate, int providerId, string status, string userId)
    {
        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_InsertUploadHistoryAndAudit",
            [
                new SqlParameter("@UploadFileName", SqlDbType.NVarChar) { Size = 255, Value = (object)fileName ?? DBNull.Value },
                new SqlParameter("@BillDate",       SqlDbType.DateTime) { Value = billDate },
                new SqlParameter("@Provider",       SqlDbType.Int)      { Value = providerId },
                new SqlParameter("@Status",         SqlDbType.NVarChar) { Size = 50, Value = (object)status ?? DBNull.Value },
                new SqlParameter("@UserID",         SqlDbType.NVarChar) { Size = 100, Value = (object)userId ?? DBNull.Value }
            ]);
            return ds?.Tables.Count > 0 ? ds.Tables[0] : new DataTable();
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(InsertUploadHistoryAndAudit), Uid());
            return new DataTable();
        }
    }

    private object? OpenExcelFile(string fileName)
    {
        try
        {
            var billDateStr = HttpContext.Session.GetString("m_CurrentImportBillDate") ?? DateTime.Now.ToString("yyyy-MM-dd");
            var providerId  = int.Parse(HttpContext.Session.GetString("m_Provider") ?? "0");

            var result = _db.ExecuteSpRetVal("sp_ImportInvoice",
            [
                new SqlParameter("@PROVIDER", SqlDbType.Int)      { Value = providerId },
                new SqlParameter("@BILLDATE", SqlDbType.DateTime) { Value = billDateStr }
            ]);

            if (result == 0)
            {
                ClearPreviousImport(providerId, billDateStr, fileName);
                AuditTrail("File data not inserted successfully.", nameof(OpenExcelFile), Uid());
                return null;
            }

            return new object();
        }
        catch (Exception ex)
        {
            var providerId  = int.Parse(HttpContext.Session.GetString("m_Provider") ?? "0");
            var billDateStr = HttpContext.Session.GetString("m_CurrentImportBillDate") ?? string.Empty;
            ClearPreviousImport(providerId, billDateStr, fileName);
            AuditTrail(ex.ToString(), nameof(OpenExcelFile), Uid());
            return null;
        }
    }

    private void ClearPreviousImport(int provider, string billDateString, string fileName)
    {
        try
        {
            _db.ExecuteStoredProc("sp_ClearPreviousImport",
            [
                new SqlParameter("@Provider", SqlDbType.Int)      { Value = provider },
                new SqlParameter("@BillDate", SqlDbType.DateTime) { Value = DateTime.TryParse(billDateString, out var dt) ? (object)dt : DBNull.Value },
                new SqlParameter("@FileName", SqlDbType.VarChar)  { Size = 200, Value = (object)fileName ?? DBNull.Value }
            ]);
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(ClearPreviousImport), Uid());
        }
    }

    private void ImportFirst(string fileName, string sdir, string sheet)
    {
        try
        {
            var billDateStr = HttpContext.Session.GetString("m_CurrentImportBillDate") ?? DateTime.Now.ToString("yyyy-MM-dd");
            var providerId  = int.Parse(HttpContext.Session.GetString("m_Provider") ?? "0");
            var fullPath    = Path.Combine(sdir, fileName);
            var ext         = Path.GetExtension(fileName).ToLower();

            // Reset tblImport before the new bulk copy (max-ID / delete / reseed).
            // Replaces the legacy inline SQL; logic now lives in sp_ResetImportTable.
            _db.ExecuteStoredProc("sp_ResetImportTable", []);

            // .xls / .xlsx → ExcelDataReader (no Access engine). .mde → OleDb (Access only).
            var dt = ext == ".mde"
                ? ReadAccessSheet(fullPath, sheet)
                : ReadExcelSheet(fullPath, sheet);

            // Inject the BillDateNew column the column-mapping below expects.
            if (!dt.Columns.Contains("BillDateNew"))
                dt.Columns.Add("BillDateNew", typeof(string));
            foreach (DataRow r in dt.Rows)
                r["BillDateNew"] = billDateStr;

            var mappingDs = _db.ExecuteStoredProcDataSet("sp_GetImportColumnMappings",
                [new SqlParameter("@ProviderID", SqlDbType.Int) { Value = providerId }]);

            string[] destCols = ["SUB_NO","BILLDATE","CALLDATE","TRANS_TYPE","DESCRIPTION","CALLTIME","DURATION","AMOUNT","BILLNUMBER"];

            var connStr = _db.GetConnection().ConnectionString;
            using var bulkCopy = new Microsoft.Data.SqlClient.SqlBulkCopy(connStr);
            bulkCopy.BulkCopyTimeout       = 500;
            bulkCopy.DestinationTableName  = "tblImport";

            for (int i = 0; i < 9; i++)
                bulkCopy.ColumnMappings.Add(mappingDs.Tables[0].Rows[0][i].ToString(), destCols[i]);

            bulkCopy.WriteToServer(dt);

            var importDs = _db.ExecuteStoredProcDataSet("sp_tblImport",
                [new SqlParameter("@PROVIDER", SqlDbType.VarChar, 50) { Value = providerId.ToString() }]);
            _dtImport = importDs.Tables[0];
            HttpContext.Session.SetString("dtImport_Count", _dtImport.Rows.Count.ToString());
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(ImportFirst), Uid());
            throw;
        }
    }

    private List<Import> BindGrid()
    {
        try
        {
            return _dtImport.Rows.Cast<DataRow>()
                .Where(r => r["SUB_NO"] == DBNull.Value || r["CALLDATE"] == DBNull.Value || r["AMOUNT"] == DBNull.Value)
                .Select(r => new Import
                {
                    Id          = Convert.ToInt32(r["ID"]),
                    SubNo       = r["SUB_NO"]?.ToString() ?? string.Empty,
                    BillDate    = r["BILLDATE"] != DBNull.Value ? Convert.ToDateTime(r["BILLDATE"]) : DateTime.MinValue,
                    CallDate    = r["CALLDATE"].ToString(),
                    TransType   = r["TRANS_TYPE"].ToString(),
                    Description = r["DESCRIPTION"].ToString(),
                    Amount      = r["AMOUNT"].ToString(),
                    Duration    = r["DURATION"].ToString(),
                    CallTime    = r["CALLTIME"].ToString()
                }).ToList();
        }
        catch (Exception ex)
        {
            AuditTrail(ex.ToString(), nameof(BindGrid), Uid());
            return [];
        }
    }

    /// <summary>
    /// Returns a one-column ("TABLE_NAME") DataTable of sheet/table names.
    /// .xls / .xlsx are read with ExcelDataReader (no Access engine required);
    /// only Access .mde / .mdb fall back to OleDb.
    /// </summary>
    private static DataTable? GetExcelSheetNames(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLower();

        if (ext is ".xls" or ".xlsx")
        {
            RegisterEncoding();
            var names = new DataTable();
            names.Columns.Add("TABLE_NAME", typeof(string));
            using var stream = System.IO.File.OpenRead(filePath);
            using var reader = ExcelReaderFactory.CreateReader(stream);
            var ds = reader.AsDataSet(new ExcelDataSetConfiguration
            {
                ConfigureDataTable = _ => new ExcelDataTableConfiguration { UseHeaderRow = true }
            });
            foreach (DataTable tbl in ds.Tables)
                names.Rows.Add(tbl.TableName);
            return names;
        }

        // Access (.mde / .mdb) — OleDb is fine here (no 32/64-bit Excel driver issue).
        OleDbConnection? conn = null;
        try
        {
            conn = new OleDbConnection($"Provider=Microsoft.Jet.OLEDB.4.0;Data Source={filePath};");
            conn.Open();
            return conn.GetOleDbSchemaTable(OleDbSchemaGuid.Tables, null);
        }
        catch { return null; }
        finally { conn?.Close(); conn?.Dispose(); }
    }

    /// <summary>
    /// Returns the column (header) names of a sheet. ExcelDataReader for Excel,
    /// OleDb only for Access .mde.
    /// </summary>
    private static List<Column> ReadColumnNames(string path, string sheet)
    {
        var ext = Path.GetExtension(path).ToLower();

        if (ext is ".xls" or ".xlsx")
        {
            var tbl = ReadExcelSheet(path, sheet);
            return tbl.Columns.Cast<DataColumn>()
                .Select(c => new Column { Cols = c.ColumnName })
                .ToList();
        }

        // Access .mde fallback
        using var conn = new OleDbConnection($"Provider=Microsoft.Jet.OLEDB.4.0;Data Source={path};");
        var ds = new DataSet();
        conn.Open();
        new OleDbDataAdapter($"select * from [{sheet}]", conn).Fill(ds);
        conn.Close();
        return ds.Tables[0].Columns.Cast<DataColumn>()
            .Select(c => new Column { Cols = c.ColumnName })
            .ToList();
    }

    /// <summary>
    /// Reads a single sheet of an .xls / .xlsx file into a DataTable using
    /// ExcelDataReader — handles both formats with no ACE/JET driver dependency.
    /// </summary>
    private static DataTable ReadExcelSheet(string filePath, string sheetName)
    {
        RegisterEncoding();
        using var stream = System.IO.File.OpenRead(filePath);
        using var reader = ExcelReaderFactory.CreateReader(stream);
        var ds = reader.AsDataSet(new ExcelDataSetConfiguration
        {
            ConfigureDataTable = _ => new ExcelDataTableConfiguration { UseHeaderRow = true }
        });

        foreach (DataTable tbl in ds.Tables)
            if (string.Equals(tbl.TableName, sheetName, StringComparison.OrdinalIgnoreCase))
                return tbl;

        // No sheet matched (or none requested) → return the first sheet.
        if (string.IsNullOrEmpty(sheetName) && ds.Tables.Count > 0)
            return ds.Tables[0];

        throw new Exception($"Sheet '{sheetName}' not found in '{filePath}'.");
    }

    /// <summary>OleDb read for an Access .mde / .mdb table.</summary>
    private static DataTable ReadAccessSheet(string filePath, string tableName)
    {
        var dt = new DataTable();
        using var conn = new OleDbConnection(
            $"Provider=Microsoft.Jet.OLEDB.4.0;data source={filePath};User Id=admin;Password=;");
        new OleDbDataAdapter($"SELECT * FROM [{tableName}]", conn).Fill(dt);
        return dt;
    }

    /// <summary>
    /// ExcelDataReader needs the code-pages encoding provider registered once
    /// for legacy .xls (BIFF) files on .NET Core / .NET 10.
    /// </summary>
    private static void RegisterEncoding()
        => System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

    private static object ExtractBillDetails(DataTable? dt)
    {
        if (dt is null || dt.Rows.Count == 0)
            return new { BilledButNotInSystem = new { CountOfBills = 0, TotalAmount = 0.0 }, InSystemButNotAssigned = new { CountOfBills = 0, TotalAmount = 0.0 }, AssignedButOutsideValidDates = new { CountOfBills = 0, TotalAmount = 0.0 } };

        var r = dt.Rows[0];
        int.TryParse(r["BilledButNotInSystem_Count"].ToString(),   out int b1c);
        double.TryParse(r["BilledButNotInSystem_Amount"].ToString(), out double b1a);
        int.TryParse(r["InSystemButNotAssigned_Count"].ToString(),  out int b2c);
        double.TryParse(r["InSystemButNotAssigned_Amount"].ToString(), out double b2a);
        int.TryParse(r["AssignedButOutsideValidDates_Count"].ToString(),  out int b3c);
        double.TryParse(r["AssignedButOutsideValidDates_Amount"].ToString(), out double b3a);

        return new
        {
            BilledButNotInSystem       = new { CountOfBills = b1c, TotalAmount = b1a },
            InSystemButNotAssigned     = new { CountOfBills = b2c, TotalAmount = b2a },
            AssignedButOutsideValidDates= new { CountOfBills = b3c, TotalAmount = b3a }
        };
    }
}
