using System.DirectoryServices;
using System.DirectoryServices.AccountManagement;
using System.Runtime.Versioning;
using Microsoft.Extensions.Options;
using TIS.Models;

namespace TIS.Helpers;

/// <summary>
/// Looks up a single user in Active Directory by SAM account name and maps the
/// configured attributes into an <see cref="AdUser"/>.
///
/// Uses the application/app-pool Windows identity (no stored credentials), the
/// same way the legacy ADTestController did. All attribute names + the domain
/// come from appsettings.json (ActiveDirectory section), so the directory can be
/// re-pointed or re-mapped without a redeploy.
///
/// AD APIs are Windows-only; the project targets win-x64 so this is fine.
/// </summary>
[SupportedOSPlatform("windows")]
public class AdLookupService
{
    private readonly ActiveDirectoryOptions _opt;
    private readonly ILogger<AdLookupService> _logger;

    public AdLookupService(IOptions<ActiveDirectoryOptions> opt, ILogger<AdLookupService> logger)
    {
        _opt    = opt.Value;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_opt.Domain);

    /// <summary>
    /// Tests connectivity to a domain controller using the app-pool identity.
    /// Returns (success, message).
    /// </summary>
    public (bool Success, string Message) TestConnection()
    {
        if (!IsConfigured)
            return (false, "FAIL — 'ActiveDirectory:Domain' is not set in appsettings.json.");

        try
        {
            using var context = new PrincipalContext(ContextType.Domain, _opt.Domain);
            var server = context.ConnectedServer;
            return server != null
                ? (true,  "SUCCESS — Connected to: " + server)
                : (false, "FAIL — Could not reach a domain controller.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AD TestConnection failed");
            return (false, "FAIL — " + ex.Message);
        }
    }

    /// <summary>
    /// Updates the user's mobile attribute (requires the app account to have
    /// write permission to AD). Returns (success, message).
    /// </summary>
    public (bool Success, string Message) UpdateMobile(string username, string mobileNumber)
    {
        if (string.IsNullOrWhiteSpace(username))     return (false, "Please enter a username.");
        if (string.IsNullOrWhiteSpace(mobileNumber)) return (false, "Please enter a mobile number.");
        if (!IsConfigured)                           return (false, "FAIL — 'ActiveDirectory:Domain' is not set in appsettings.json.");

        try
        {
            using var context = new PrincipalContext(ContextType.Domain, _opt.Domain);
            using var user    = UserPrincipal.FindByIdentity(context, IdentityType.SamAccountName, username.Trim());
            if (user == null)
                return (false, $"No user found for '{username}'.");

            if (user.GetUnderlyingObject() is not DirectoryEntry entry)
                return (false, "FAIL — Could not retrieve directory entry for user.");

            entry.Properties[_opt.Attributes.Mobile].Value = mobileNumber.Trim();
            entry.CommitChanges();
            return (true, $"SUCCESS — Mobile number updated for '{username}'.");
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogError(ex, "AD UpdateMobile unauthorized");
            return (false, "FAIL — The application account does not have write permission to Active Directory.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AD UpdateMobile failed");
            return (false, "FAIL — " + ex.Message);
        }
    }

    /// <summary>
    /// Returns the AD user for the given username, or null if not found.
    /// Throws on connection/permission errors so the caller can surface them.
    /// </summary>
    public AdUser? FindByUsername(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return null;

        using var context = new PrincipalContext(ContextType.Domain, _opt.Domain);
        using var user    = UserPrincipal.FindByIdentity(context, IdentityType.SamAccountName, username.Trim());
        if (user == null)
            return null;

        var entry = user.GetUnderlyingObject() as DirectoryEntry;
        var a     = _opt.Attributes;

        return new AdUser
        {
            SamAccount     = user.SamAccountName ?? string.Empty,
            DisplayName    = GetProperty(entry, a.DisplayName),
            Department     = GetProperty(entry, a.Department),
            Title          = GetProperty(entry, a.Title),
            EmployeeNumber = GetProperty(entry, a.EmployeeNumber),
            Email          = GetProperty(entry, a.Email),
            Mobile         = GetProperty(entry, a.Mobile)
        };
    }

    /// <summary>
    /// Returns the AD account status for a SAM account name.
    ///   Found    — true if the username exists in AD.
    ///   Disabled — true only when AD reports the account as explicitly disabled.
    /// Throws on connection/permission errors so the caller can log them.
    /// </summary>
    public (bool Found, bool Disabled) GetAccountStatus(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return (false, false);

        using var context = new PrincipalContext(ContextType.Domain, _opt.Domain);
        using var user    = UserPrincipal.FindByIdentity(context, IdentityType.SamAccountName, username.Trim());
        if (user == null)
            return (false, false);

        // UserPrincipal.Enabled is bool?; an explicit "false" means the AD account is disabled.
        bool disabled = user.Enabled == false;
        return (true, disabled);
    }

    /// <summary>Safely reads a named attribute from a DirectoryEntry.</summary>
    private static string GetProperty(DirectoryEntry? entry, string attributeName)
    {
        if (entry == null || string.IsNullOrWhiteSpace(attributeName))
            return string.Empty;
        try
        {
            if (entry.Properties.Contains(attributeName))
            {
                var val = entry.Properties[attributeName].Value;
                return val?.ToString() ?? string.Empty;
            }
        }
        catch { /* attribute may not exist in this AD schema */ }
        return string.Empty;
    }
}
