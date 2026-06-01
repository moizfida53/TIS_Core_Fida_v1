using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a single raw call-detail record parsed from an imported provider bill file
/// (CSV / Excel) before it is processed into the main bill tables.
/// </summary>
public class Import
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Subscription No")]
    [Required]
    public string SubNo { get; init; } = string.Empty;

    [Display(Name = "Bill Date")]
    [DataType(DataType.Date)]
    public DateTime BillDate { get; init; }

    [Display(Name = "Call Date")]
    public string? CallDate { get; init; }

    [Display(Name = "Transaction Type")]
    public string? TransType { get; init; }

    [Display(Name = "Description")]
    public string? Description { get; init; }

    [Display(Name = "Amount")]
    public string? Amount { get; init; }

    [Display(Name = "Duration")]
    public string? Duration { get; init; }

    [Display(Name = "Call Time")]
    public string? CallTime { get; init; }
}
