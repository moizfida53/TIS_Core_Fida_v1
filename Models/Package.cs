using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a telecom package / bundle definition linked to a provider,
/// transaction type, and optional expense description. Used to auto-classify
/// bill line items during import.
/// </summary>
public class Package
{
    [Display(Name = "Count")]
    public string? Count { get; init; }

    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Package Name")]
    [Required]
    [StringLength(200)]
    public string PkgName { get; init; } = string.Empty;

    [Display(Name = "Package Description")]
    public string? PkgDesc { get; init; }

    [Display(Name = "Provider ID")]
    public int ProviderId { get; init; }

    [Display(Name = "Provider Name")]
    public string? ProviderName { get; init; }

    [Display(Name = "Transaction ID")]
    public int TransId { get; init; }

    [Display(Name = "Transaction Name")]
    public string? TransName { get; init; }

    [Display(Name = "Apply to All")]
    public bool IsAll { get; init; }

    [Display(Name = "Description ID")]
    public int DescId { get; init; }

    [Display(Name = "Description Name")]
    public string? DescName { get; init; }

    [Display(Name = "Expense Type")]
    public int ExpType { get; init; }

    [Display(Name = "Amount")]
    public double Amount { get; init; }

    [Display(Name = "Start Date")]
    [DataType(DataType.Date)]
    public DateTime StartDate { get; init; }
}
