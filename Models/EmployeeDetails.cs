using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a full employee profile including organisational, role, and location data.
/// Used in employee management screens and admin configuration.
/// </summary>
public class EmployeeDetails
{
    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Name")]
    [Required]
    public string Name { get; init; } = string.Empty;

    [Display(Name = "Employee No")]
    public string? EmployeeNo { get; init; }

    [Display(Name = "Email")]
    [EmailAddress]
    public string? Email { get; init; }

    [Display(Name = "Username")]
    public string? UserName { get; init; }

    [Display(Name = "Organisation")]
    public string? Org { get; init; }

    [Display(Name = "Description")]
    public string? Description { get; init; }

    [Display(Name = "Manager ID")]
    public int ManagerId { get; init; }

    [Display(Name = "Manager Name")]
    public string? ManagerName { get; init; }

    [Display(Name = "Grade")]
    public string? Grade { get; init; }

    [Display(Name = "Extension")]
    public string? Extension { get; init; }

    [Display(Name = "Payroll")]
    public string? Payroll { get; init; }

    [Display(Name = "Cost Centre No")]
    public string? CcNo { get; init; }

    [Display(Name = "Role ID")]
    public int RoleId { get; init; }

    [Display(Name = "Role Name")]
    public string? RoleName { get; init; }

    [Display(Name = "Country ID")]
    public int CountryId { get; init; }

    [Display(Name = "Country Name")]
    public string? CountryName { get; init; }

    [Display(Name = "Is Cost Center")]
    public string? IsCostCenter { get; init; }

    [Display(Name = "Company")]
    public string? Company { get; init; }

    [Display(Name = "Company ID")]
    public string? CompanyId { get; init; }

    [Display(Name = "Is Active")]
    public bool IsActive { get; init; }
}
