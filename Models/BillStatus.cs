using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Merged lookup model for bill/general statuses.
/// Replaces the original BillStatus, Status, and Status1 models — all were identical ID+Name pairs.
/// </summary>
public class BillStatus
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Name")]
    [Required]
    public string Name { get; init; } = string.Empty;
}
