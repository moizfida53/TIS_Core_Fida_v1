using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a system role lookup entry (e.g. Admin, Manager, Employee, HR).
/// </summary>
public class Role
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Role")]
    [Required]
    public string RoleName { get; init; } = string.Empty;
}
