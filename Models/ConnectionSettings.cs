using System;
using System.Data;
using Microsoft.Extensions.Configuration;
using TIS.Helpers;

namespace TIS.Models;

/// <summary>
/// Static configuration provider that hydrates from tblConfiguration and appsettings.json.
/// All connection-string properties are lazy-loaded on first access via <see cref="FillSettings"/>.
/// </summary>
public static class ConnectionSettings
{
    // ── Backing fields ───────────────────────────────────────────────────────
    private static string _adminId               = string.Empty;
    private static string _adminPwd              = string.Empty;
    private static string _dbConnectionString    = string.Empty;
    private static string _bapiConnectionString  = string.Empty;
    private static string _epabxConnectionString = string.Empty;
    private static string _oracleConnectionString    = string.Empty;
    private static string _contractorConnectionString = string.Empty;
    private static string _ldapPath             = string.Empty;
    private static string _mocConnectionString  = string.Empty;
    private static int    _mocDirect            = -1;
    private static DataRow? _drConfig;

    // ── IConfiguration injected at startup (call SetConfiguration on startup) ─
    private static IConfiguration? _configuration;

    public static void SetConfiguration(IConfiguration configuration)
        => _configuration = configuration;

    // ── Config-table properties ──────────────────────────────────────────────
    public static string AdminEmail
        => _drConfig?["AdminEmail"]?.ToString() ?? string.Empty;

    public static string SupervGrade
        => _drConfig?["SuperGrade"]?.ToString() ?? string.Empty;

    public static bool AllowWaiver
        => _drConfig is not null && Convert.ToBoolean(_drConfig["AllowWaiver"]);

    public static bool AllowTrainForceBill
        => _drConfig is not null && Convert.ToBoolean(_drConfig["AllowTrainForceBill"]);

    public static int EmpReminder
        => _drConfig is not null ? Convert.ToInt32(_drConfig["EmpReminder"]) : -1;

    public static int ForceBillReminder
        => _drConfig is not null ? Convert.ToInt32(_drConfig["ForceBillReminder"]) : -1;

    public static int ManagerComplaintReminder
        => _drConfig is not null ? Convert.ToInt32(_drConfig["MgrComplaintReminder"]) : -1;

    public static int GsmReminder
        => _drConfig is not null ? Convert.ToInt32(_drConfig["GSMReminder"]) : -1;

    public static int HrReminder
        => _drConfig is not null ? Convert.ToInt32(_drConfig["HrReminder"]) : -1;

    public static int LmReminder
        => _drConfig is not null ? Convert.ToInt32(_drConfig["LMReminder"]) : -1;

    public static string HostUrl
        => _drConfig?["HostUrl"]?.ToString() ?? string.Empty;

    public static string SmtpSettings
        => _drConfig?["SMTPSettings"]?.ToString() ?? string.Empty;

    public static bool HidePersonalCalls
        => _drConfig is not null && Convert.ToBoolean(_drConfig["HidePersonalCalls"]);

    public static bool NotSendMail
        => _drConfig is not null && Convert.ToBoolean(_drConfig["NotSendMail"]);

    public static bool NotSendSms
        => _drConfig is not null && Convert.ToBoolean(_drConfig["NotSendSMS"]);

    public static bool EnableGrade
        => _drConfig is not null && Convert.ToBoolean(_drConfig["EnableGrade"]);

    public static bool SkipGmApproval
        => _drConfig is not null && Convert.ToBoolean(_drConfig["SkipGMApproval"]);

    public static bool EnableDiscrepancy
        => _drConfig is not null && Convert.ToBoolean(_drConfig["EnableDiscrepancy"]);

    public static bool DedBussCharges
        => _drConfig is not null && Convert.ToBoolean(_drConfig["DedBussinessCharges"]);

    public static bool DeleteBut
        => _drConfig is not null && Convert.ToBoolean(_drConfig["DeleteBut"]);

    public static bool ReRoute
        => _drConfig is not null && Convert.ToBoolean(_drConfig["ReRoute"]);

    public static bool ZeroAsUnlimited
        => _drConfig is not null && Convert.ToBoolean(_drConfig["BusinessZeroAsUnlimited"]);

    public static bool SkipApprovalOnBussChargesZero
        => _drConfig is not null && Convert.ToBoolean(_drConfig["SkipApprovalBuss"]);

    // ── Lazy-loaded connection strings ───────────────────────────────────────
    public static string AdminId
    {
        get { if (_adminId == string.Empty) FillSettings(); return _adminId; }
    }

    public static string AdminPwd
    {
        get { if (_adminPwd == string.Empty) FillSettings(); return _adminPwd; }
    }

    public static string DbConnectionString
    {
        get { if (_dbConnectionString == string.Empty) FillSettings(); return _dbConnectionString; }
    }

    public static string BapiConnectionString
    {
        get { if (_bapiConnectionString == string.Empty) FillSettings(); return _bapiConnectionString; }
    }

    public static string ContractorConnectionString
    {
        get { if (_contractorConnectionString == string.Empty) FillSettings(); return _contractorConnectionString; }
    }

    public static string OracleConnectionString
    {
        get { if (_oracleConnectionString == string.Empty) FillSettings(); return _oracleConnectionString; }
    }

    public static string EpabxConnectionString
    {
        get { if (_epabxConnectionString == string.Empty) FillSettings(); return _epabxConnectionString; }
    }

    public static string LdapPath
    {
        get { if (_ldapPath == string.Empty) FillSettings(); return _ldapPath; }
    }

    public static string MocConnectionString
    {
        get { if (_mocConnectionString == string.Empty) FillSettings(); return _mocConnectionString; }
    }

    public static int MocDirect
    {
        get { if (_mocDirect == -1) FillSettings(); return _mocDirect; }
    }

    // ── Loader ───────────────────────────────────────────────────────────────
    public static void FillSettings()
    {
        if (_configuration is null)
            throw new InvalidOperationException(
                "ConnectionSettings not initialised. Call ConnectionSettings.SetConfiguration(IConfiguration) in Program.cs.");

        _bapiConnectionString = _configuration.GetConnectionString("BAPIConnectionString") ?? string.Empty;

        _mocDirect = int.TryParse(_configuration["MOCDirect"], out var moc) ? moc : 0;

        DB db = new DB(_configuration, null);

        DataSet? data = db.GetData("SELECT TOP 1 * FROM tblConfiguration");
        if (data is not null && data.Tables.Count > 0 && data.Tables[0].Rows.Count > 0)
            _drConfig = data.Tables[0].Rows[0];
    }
}
