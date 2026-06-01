using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a bill pending approval in the approval workflow grid.
/// </summary>
public class ArrovalBills
{
    [Display(Name = "Bill ID")]
    public int BillId { get; init; }

    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }

    [Display(Name = "Subscription No")]
    public string? SubNo { get; init; }

    [Display(Name = "Name")]
    public string? Name { get; init; }

    [Display(Name = "Organisation")]
    public string? Org { get; init; }

    [Display(Name = "Total")]
    public string? Total { get; init; }

    [Display(Name = "Business Limit")]
    public string? BusinessLimit { get; init; }

    [Display(Name = "Personal Limit")]
    public string? PLimit { get; init; }

    [Display(Name = "Business Charges")]
    public string? BusinessCharges { get; init; }

    [Display(Name = "Deductable Amount")]
    public string? DeductableAmount { get; init; }

    [Display(Name = "Waiver Amount")]
    public string? WaiverAmount { get; init; }

    [Display(Name = "Comments")]
    public string? Comments { get; init; }

    [Display(Name = "Selected")]
    public bool IsSelected { get; set; }

    [Display(Name = "Approver Comments")]
    public string? AComments { get; set; }
}
