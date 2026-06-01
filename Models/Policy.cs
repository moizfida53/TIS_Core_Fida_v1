using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a bill classification policy rule that maps provider / transaction type /
/// call type combinations to a business or personal charge category.
/// Arrays (Emp, Num, Des) hold multi-select values submitted from the policy form via Ajax.
/// </summary>
public class Policy
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Provider ID")]
    public int ProviderId { get; init; }

    [Display(Name = "Provider Name")]
    public string? ProviderName { get; init; }

    [Display(Name = "Transaction Type")]
    public string? TransType { get; init; }

    [Display(Name = "Description")]
    public string? Description { get; init; }

    [Display(Name = "Call Type ID")]
    public int CallTypeId { get; init; }

    [Display(Name = "Call Type")]
    public string? CallType { get; init; }

    [Display(Name = "Line Type ID")]
    public int LineTypeId { get; init; }

    [Display(Name = "Line Type")]
    public string? LineType { get; init; }

    [Display(Name = "Apply to All Employees")]
    public bool IsAll { get; init; }

    [Display(Name = "Apply to All Descriptions")]
    public bool IsAllDesc { get; init; }

    [Display(Name = "Is Supervisor Important")]
    public bool IsSupImp { get; init; }

    [Display(Name = "Employee IDs")]
    public int[]? Emp { get; init; }

    [Display(Name = "Number IDs")]
    public int[]? Num { get; init; }

    [Display(Name = "Description Values")]
    public string[]? Des { get; init; }
}
