using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Payload model for bill closing / finalisation with full charge breakdown.
/// Submitted via Ajax when a bill is approved and closed.
/// </summary>
public class Closing
{
    [Display(Name = "Business Charges")]
    public double BusinessCharges { get; init; }

    [Display(Name = "Personal Charges")]
    public double PersonalCharges { get; init; }

    [Display(Name = "Personal Limit Charges")]
    public double PersonalLimitCharges { get; init; }

    [Display(Name = "Deductible Amount")]
    public double DeductibleAmount { get; init; }

    [Display(Name = "Total Amount")]
    public double TotalAmount { get; init; }

    [Display(Name = "Bill ID")]
    public int Bid { get; init; }

    [Display(Name = "Comments")]
    public string? Comments { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Waiver Amount")]
    public double WaiverAmount { get; init; }
}
