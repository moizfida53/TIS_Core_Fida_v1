using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Data;
using System.Security.Principal;
using System.Text.Json;
using System.Text.RegularExpressions;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

namespace TIS.Controllers;

/// <summary>
/// Handles user authentication, session setup, landing page routing,
/// and login-as (impersonation) for admin users.
/// All data access via stored procedures — zero inline SQL.
/// </summary>
public class UserController : Controller
{
    private readonly DB _db;
    private readonly IConfiguration _config;
    private readonly ILogger<UserController> _logger;
    private readonly IHttpContextAccessor _httpCtx;
    private readonly string _loginName;

    public UserController(DB db, IConfiguration config, ILogger<UserController> logger, IHttpContextAccessor httpCtx)
    {
        _db      = db;
        _config  = config;
        _logger  = logger;
        _httpCtx = httpCtx;

        // Priority 1 — dev override in appsettings.json ("loginName": "FAjin").
        //              Clear this value in production so real Windows identity is used.
        var configured = config["loginName"]?.Trim();
        if (!string.IsNullOrEmpty(configured))
        {
            _loginName = configured;
            return;
        }

        // Priority 2 — Windows identity from the HTTP request.
        //   Legacy: WindowsIdentity.GetCurrent() worked because IIS ran with impersonation.
        //   ASP.NET Core: GetCurrent() returns the SERVICE ACCOUNT (app pool), NOT the caller.
        //   The correct source is HttpContext.User.Identity.Name → "DOMAIN\Username".
        var identityName = httpCtx.HttpContext?.User?.Identity?.Name;
        if (!string.IsNullOrEmpty(identityName))
        {
            // Strip domain prefix (e.g. "CORP\FAjin" → "FAjin")
            var parts  = identityName.Split('\\');
            _loginName = parts[^1];
        }
        else
        {
            // Fallback: Windows account running the process (last resort — same as legacy fallback)
            _logger.LogWarning("Windows identity not available on request; falling back to process identity.");
            var parts  = WindowsIdentity.GetCurrent().Name.Split('\\');
            _loginName = parts[^1];
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    public IActionResult NewPage() => View();

    public IActionResult Index(int selectedTabIndex = 1)
    {
        ViewBag.selectedTabId = selectedTabIndex;
        var data = BindDefaultData();
        if (data is null) return View("AccessDenied");

        ViewBag.UID        = data.Uid;
        ViewBag.AdminRoleId= data.AdminRoleId;
        ViewBag.Roleid     = data.RoleId;
        ViewBag.action     = data.Action;
        ViewBag.name       = data.Name;
        return View();
    }

    public IActionResult Landing()
    {
        var data = BindDefaultData();
        if (data is null) return View("AccessDenied");

        ViewBag.UID        = data.Uid;
        ViewBag.AdminRoleId= data.AdminRoleId;
        ViewBag.Roleid     = data.RoleId;
        ViewBag.action     = data.Action;
        ViewBag.name       = data.Name;

        return data.IsShowHomePage == true
            ? View(nameof(Landing), data)
            : View(nameof(Index),   data);
    }

    [RoleAuthorize(Roles.Administrator, Roles.SuperAdmin, Roles.Employee)]
    public IActionResult RedirectOnListView(int tabindex)
        => RedirectToAction("Index", new { SelectedTabIndex = tabindex });

    // ── Session helpers ───────────────────────────────────────────────────────

    private Users? BindDefaultData()
    {
        SqlParameter[] p = [new SqlParameter("@userName", SqlDbType.VarChar) { Value = _loginName }];
        var ds = _db.ExecuteStoredProcDataSet("sp_GetSettings", p);

        if (ds is null || ds.Tables.Count < 2 || ds.Tables[1].Rows.Count == 0)
            return null;

        if (Convert.ToInt32(ds.Tables[1].Rows[0]["UID"]) <= 0)
            return null;

        bool showHome = false;
        try { showHome = ds.Tables[0].Rows[0]["IsShowHomePage"].ToString() == "True"; } catch { }

        var uid      = ds.Tables[1].Rows[0]["UID"].ToString()!;
        var name     = ds.Tables[1].Rows[0]["NAME"].ToString();
        var managerId= ds.Tables[1].Rows[0]["MANAGERID"].ToString();
        var roleId   = ds.Tables.Count > 3 && ds.Tables[3].Rows.Count > 0 ? ds.Tables[3].Rows[0]["Role_ID"].ToString() : string.Empty;
        var username = ds.Tables.Count > 3 && ds.Tables[3].Rows.Count > 0 ? ds.Tables[3].Rows[0]["Username"].ToString()! : _loginName;
        var countryId= ds.Tables.Count > 3 && ds.Tables[3].Rows.Count > 0 ? Convert.ToInt32(ds.Tables[3].Rows[0]["COUNTRYID"]) : 0;
        var companyId= ds.Tables.Count > 3 && ds.Tables[3].Rows.Count > 0 ? Convert.ToInt32(ds.Tables[3].Rows[0]["CompanyID"]) : 0;

        // Persist session
        HttpContext.Session.SetString("EmpLoginName",    username);
        HttpContext.Session.SetString("EmpLoginAs",      username);
        HttpContext.Session.SetString("EmpDisplayName",  name ?? string.Empty);
        HttpContext.Session.SetString("EmpRoleID",       roleId ?? string.Empty);
        HttpContext.Session.SetString("EmpUsername",     username);
        HttpContext.Session.SetString("EmpUID",          uid);
        HttpContext.Session.SetString("CountryID",       countryId.ToString());
        HttpContext.Session.SetString("CompanyID",       companyId.ToString());

        string action = "0";
        var url = Request.Path.Value ?? string.Empty;
        if (Regex.IsMatch(url, "Approve") && url.Contains('='))
            action = url[(url.IndexOf('=') + 1)..];

        return new Users
        {
            Uid           = uid,
            Name          = name,
            ManagerId     = managerId,
            RoleId        = roleId,
            Username      = username,
            CountryId     = countryId,
            CompanyId     = companyId,
            Action        = action,
            IsShowHomePage= showHome
        };
    }

    // ── JSON endpoints ────────────────────────────────────────────────────────

    [RoleAuthorize(Roles.Administrator, Roles.SuperAdmin, Roles.Employee)]
    [HttpGet]
    public IActionResult GetLandingPageData([FromQuery] string uid)
    {
        if (!long.TryParse(uid, out long parsedUid) || parsedUid <= 0)
            return Json(new { Error = "Invalid UID" });

        try
        {
            var ds = _db.ExecuteStoredProcDataSet("sp_GetLandingPageData",
                [new SqlParameter("@Uid", SqlDbType.Int) { Value = (int)parsedUid }]);

            if (ds?.Tables[0].Rows.Count > 0)
                return Json(new { Message = "Success", Data = JsonSerializer.Serialize(ds.Tables[0]) });

            return Json(new { Message = "Fail" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetLandingPageData failed");
            return Json(new { Message = "Fail", Data = string.Empty });
        }
    }

    [HttpPost]
    public IActionResult Login([FromBody] Login login)
    {
        HttpContext.Session.Remove("EmpLoginName");

        SqlParameter[] p = [new SqlParameter("@username", SqlDbType.VarChar) { Value = login.Username }];
        var ds = _db.ExecuteStoredProcDataSet("sp_Login", p);

        if (ds.Tables[0].Rows.Count > 0)
        {
            var row = ds.Tables[0].Rows[0];
            HttpContext.Session.SetString("EmpLoginName",   row[0].ToString()!);
            HttpContext.Session.SetString("EmpLoginAs",     row[0].ToString()!);
            HttpContext.Session.SetString("EmpDisplayName", row[1].ToString()!);
            HttpContext.Session.SetString("EmpRoleID",      row[2].ToString()!);
            HttpContext.Session.SetString("EmpUsername",    row[0].ToString()!);
        }

        return Json(new { Message = "Success" });
    }

    [RoleAuthorize(Roles.Administrator, Roles.SuperAdmin)]
    [HttpPost]
    public IActionResult SetSession([FromQuery] string username)
    {
        HttpContext.Session.SetString("EmpLoginAs", username);

        SqlParameter[] p = [new SqlParameter("@username", SqlDbType.VarChar) { Value = username }];
        var ds = _db.ExecuteStoredProcDataSet("sp_Login", p);

        if (ds.Tables[0].Rows.Count > 0)
        {
            var row = ds.Tables[0].Rows[0];
            HttpContext.Session.SetString("EmpLoginName",   row[0].ToString()!);
            HttpContext.Session.SetString("EmpLoginAs",     row[0].ToString()!);
            HttpContext.Session.SetString("EmpDisplayName", row[1].ToString()!);
            HttpContext.Session.SetString("EmpRoleID",      row[2].ToString()!);
            HttpContext.Session.SetString("EmpUsername",    row[0].ToString()!);
        }

        return Json(new { Message = "Success" });
    }

    // ── Analyse / HomePage (admin impersonation views) ────────────────────────

    [RoleAuthorize(Roles.Administrator, Roles.SuperAdmin, Roles.Employee)]
    public IActionResult Analyse()
    {
        var sessionValue = HttpContext.Session.GetString("EmpLoginAs");
        if (string.IsNullOrWhiteSpace(sessionValue)) return View("AccessDenied");

        SqlParameter[] p =
        [
            new SqlParameter("@userName", SqlDbType.VarChar) { Value = sessionValue },
            new SqlParameter("@UserUid",  SqlDbType.Int)     { Value = int.Parse(HttpContext.Session.GetString("EmpUID") ?? "0") }
        ];

        var ds = _db.ExecuteStoredProcDataSet("sp_GetSettings", p);
        if (ds is null || ds.Tables.Count < 2 || ds.Tables[1].Rows.Count == 0) return View("AccessDenied");
        if (Convert.ToInt32(ds.Tables[1].Rows[0]["UID"]) <= 0) return View("AccessDenied");

        var empRoleId = HttpContext.Session.GetString("EmpRoleID");
        if (string.IsNullOrEmpty(empRoleId)) return View("AccessDenied");

        var model = BuildUsersModel(ds, empRoleId);
        ViewBag.UID         = model.Uid;
        ViewBag.AdminRoleId = model.AdminRoleId;
        ViewBag.Roleid      = model.RoleId;
        ViewBag.action      = 1;
        ViewBag.name        = model.Name;
        return View("Index");
    }

    [RoleAuthorize(Roles.Administrator, Roles.SuperAdmin, Roles.Employee)]
    public IActionResult HomePage()
    {
        var sessionValue = HttpContext.Session.GetString("EmpLoginAs");
        if (string.IsNullOrWhiteSpace(sessionValue)) return View("AccessDenied");

        SqlParameter[] p =
        [
            new SqlParameter("@userName", SqlDbType.VarChar) { Value = sessionValue },
            new SqlParameter("@UserUid",  SqlDbType.Int)     { Value = int.Parse(HttpContext.Session.GetString("EmpUID") ?? "0") }
        ];

        var ds = _db.ExecuteStoredProcDataSet("sp_GetSettings", p);
        if (ds is null || ds.Tables.Count < 2 || ds.Tables[1].Rows.Count == 0) return View("AccessDenied");
        if (Convert.ToInt32(ds.Tables[1].Rows[0]["UID"]) <= 0) return View("AccessDenied");

        var empRoleId = HttpContext.Session.GetString("EmpRoleID");
        if (string.IsNullOrEmpty(empRoleId)) return View("AccessDenied");

        var model = BuildUsersModel(ds, empRoleId);
        return View("Index", model);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static Users BuildUsersModel(DataSet ds, string adminRoleId)
    {
        var uid       = ds.Tables[1].Rows[0]["UID"].ToString();
        var name      = ds.Tables[1].Rows[0]["NAME"].ToString();
        var managerId = ds.Tables[1].Rows[0]["MANAGERID"].ToString();
        var roleId    = ds.Tables.Count > 3 && ds.Tables[3].Rows.Count > 0 ? ds.Tables[3].Rows[0]["Role_ID"].ToString() : string.Empty;

        return new Users
        {
            Uid         = uid,
            Name        = name,
            ManagerId   = managerId,
            RoleId      = roleId,
            AdminRoleId = adminRoleId
        };
    }
}
