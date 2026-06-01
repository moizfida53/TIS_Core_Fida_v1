using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Lightweight model carrying a single transaction type string value,
/// used in dropdowns and filter submissions.
/// </summary>
public class TransType
{
    [Display(Name = "Transaction Type")]
    [Required]
    public string StrTrans { get; init; } = string.Empty;
}
