using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a telephone subscription line managed within the system,
/// including provider, line type, assignment status, and contract details.
/// </summary>
public class Telephone
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Subscription No")]
    [Required]
    public string SubNo { get; init; } = string.Empty;

    [Display(Name = "Provider ID")]
    public int Provider { get; init; }

    [Display(Name = "Provider Name")]
    public string? ProviderName { get; init; }

    [Display(Name = "Description")]
    public string? Description { get; init; }

    [Display(Name = "Account No")]
    public string? AccountNo { get; init; }

    [Display(Name = "Is Assigned")]
    public bool IsAssigned { get; init; }

    [Display(Name = "General Phone")]
    public bool GeneralPhone { get; init; }

    [Display(Name = "Type")]
    public string? Type { get; init; }

    [Display(Name = "Line Type ID")]
    public int LineType { get; init; }

    [Display(Name = "Line Type Name")]
    public string? LineTypeName { get; init; }

    [Display(Name = "Contract Expiry")]
    [DataType(DataType.Date)]
    public DateTime? ContractExpiry { get; init; }
}
