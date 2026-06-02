using System.Runtime.Versioning;
using Microsoft.AspNetCore.Mvc;
using TIS.Helpers;

namespace TIS.Controllers;

/// <summary>
/// Diagnostic page to test the Active Directory connection, look up a user, and
/// update a mobile number. Mirrors the legacy MVC ADTestController but uses the
/// shared <see cref="AdLookupService"/> and the configurable ActiveDirectory
/// settings from appsettings.json. Uses the app-pool Windows identity (no stored
/// credentials).
/// </summary>
[SupportedOSPlatform("windows")]
public class ADTestController : Controller
{
    private readonly AdLookupService _ad;

    public ADTestController(AdLookupService ad) => _ad = ad;

    // GET: /ADTest
    public IActionResult Index() => View();

    // POST: /ADTest/TestConnection
    [HttpPost]
    public IActionResult TestConnection()
    {
        var (success, message) = _ad.TestConnection();
        return Json(new { success, message });
    }

    // POST: /ADTest/SearchUser
    [HttpPost]
    public IActionResult SearchUser(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return Json(new { success = false, message = "Please enter a username." });
        if (!_ad.IsConfigured)
            return Json(new { success = false, message = "FAIL — 'ActiveDirectory:Domain' is not set in appsettings.json." });

        try
        {
            var user = _ad.FindByUsername(username);
            if (user is null)
                return Json(new { success = false, message = $"No user found for '{username}'." });

            return Json(new
            {
                success = true,
                message = "User found successfully.",
                data = new
                {
                    displayName    = user.DisplayName,
                    email          = user.Email,
                    department     = user.Department,
                    title          = user.Title,
                    employeeNumber = user.EmployeeNumber,
                    mobile         = user.Mobile,
                    samAccount     = user.SamAccount
                }
            });
        }
        catch (Exception ex)
        {
            return Json(new { success = false, message = "FAIL — " + ex.Message, stackTrace = ex.StackTrace });
        }
    }

    // POST: /ADTest/UpdateMobile
    [HttpPost]
    public IActionResult UpdateMobile(string username, string mobileNumber)
    {
        var (success, message) = _ad.UpdateMobile(username, mobileNumber);
        return Json(new { success, message });
    }
}
