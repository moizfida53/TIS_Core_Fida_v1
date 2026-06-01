using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a telephone subscription number that exists in the system
/// but has not yet been assigned to an employee.
/// </summary>
public class Unassigned
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Subscription No")]
    [Required]
    public string SubNo { get; init; } = string.Empty;

    [Display(Name = "Description")]
    public string? Description { get; init; }
}
