using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a data row used to populate dashboard report charts,
/// combining call detail, organisational, and provider dimensions.
/// </summary>
public class ReportChart
{
    [Display(Name = "Subscription No")]
    public string? SubNo { get; init; }

    [Display(Name = "Bill Date")]
    [DataType(DataType.Date)]
    public DateTime BillDate { get; init; }

    [Display(Name = "Transaction Type")]
    public string? TransType { get; init; }

    [Display(Name = "Amount")]
    public string? Amount { get; init; }

    [Display(Name = "Assigned User ID")]
    public int Auid { get; init; }

    [Display(Name = "Call Type")]
    public string? CallTypeText { get; init; }

    [Display(Name = "Cost Centre Name")]
    public string? CcName { get; init; }

    [Display(Name = "Business Unit")]
    public string? BUnit { get; init; }

    [Display(Name = "Organisation")]
    public string? Org { get; init; }

    [Display(Name = "Provider ID")]
    public int Provider { get; init; }

    [Display(Name = "Provider Name")]
    public string? ProviderText { get; init; }

    [Display(Name = "Country ID")]
    public int CountryId { get; init; }
}
