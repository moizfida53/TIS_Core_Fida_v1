using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an authenticated user session context, carrying identity,
/// role, manager, and country data populated after login.
/// </summary>
public class Users
{
    [Display(Name = "User ID")]
    public string? Uid { get; init; }

    [Display(Name = "Name")]
    public string? Name { get; init; }

    [Display(Name = "Manager ID")]
    public string? ManagerId { get; init; }

    [Display(Name = "Manager Name")]
    public string? ManagerName { get; init; }

    [Display(Name = "Manager Email")]
    [EmailAddress]
    public string? ManagerEmail { get; init; }

    [Display(Name = "Role ID")]
    public string? RoleId { get; init; }

    [Display(Name = "Username")]
    public string? Username { get; init; }

    [Display(Name = "Admin Role ID")]
    public string? AdminRoleId { get; init; }

    [Display(Name = "Country ID")]
    public int CountryId { get; init; }

    /// <summary>
    /// Tracks the last UI action performed by this user session (default: "0" = none).
    /// </summary>
    [Display(Name = "Action")]
    public string Action { get; set; } = "0";

    [Display(Name = "Show Home Page")]
    public bool? IsShowHomePage { get; init; }

    [Display(Name = "Company ID")]
    public int? CompanyId { get; init; }
}
