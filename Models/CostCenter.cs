using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a cost centre used for charge allocation and reporting.
/// </summary>
public class CostCenter
{
    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Cost Centre Name")]
    [Required]
    public string CcName { get; init; } = string.Empty;

    [Display(Name = "Cost Centre Number")]
    public string? CcNum { get; init; }
}
