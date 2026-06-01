using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a pivoted data row used in dashboard charge-summary charts,
/// grouping amounts by subscription number, transaction type, and bill date.
/// </summary>
public class Pivot
{
    [Display(Name = "Subscription No")]
    public int SubNo { get; init; }

    [Display(Name = "Transaction Type")]
    public string? TransType { get; init; }

    [Display(Name = "Amount")]
    public decimal Amount { get; init; }

    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }
}

/// <summary>
/// Represents a pivot state snapshot record storing which pivot object
/// a user last viewed, for session/preference persistence.
/// </summary>
public class PivotData
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Object")]
    public string? Object { get; init; }

    [Display(Name = "Date")]
    [DataType(DataType.Date)]
    public DateTime Date { get; init; }
}
