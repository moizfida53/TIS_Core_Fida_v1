using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Lightweight payload model used when approving bills in batch via Ajax,
/// carrying a bill identifier and an optional approver comment.
/// </summary>
public class AppBills
{
    [Display(Name = "Bill ID")]
    [Required]
    public string Id { get; init; } = string.Empty;

    [Display(Name = "Comment")]
    public string? Comment { get; init; }
}
