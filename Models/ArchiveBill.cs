using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Merged model representing an archived bill record.
/// Covers both summary list view (formerly ArchiveBills) and full detail view (formerly ArchiveBill).
/// </summary>
public class ArchiveBill
{
    [Display(Name = "Bill ID")]
    public int BillId { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmployeeName { get; init; }

    [Display(Name = "Provider")]
    public string? Provider { get; init; }

    [Display(Name = "Mobile No")]
    public string? MobileNo { get; init; }

    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }

    [Display(Name = "Status")]
    public string? Status { get; init; }

    [Display(Name = "Last Updated On")]
    public string? LastUpdatedOn { get; init; }

    [Display(Name = "Total Amount")]
    public string? TotalAmount { get; init; }

    [Display(Name = "Currency")]
    public string? Currency { get; init; }

    [Display(Name = "Deductible Amount")]
    public string? DeductibleAmount { get; init; }

    // ── Detail-level fields (populated on drill-down) ────────────────────────

    [Display(Name = "Business Limit")]
    public string? BusinessLimit { get; init; }

    [Display(Name = "Monthly Limit")]
    public string? MonthlyLimit { get; init; }

    [Display(Name = "Business Charges")]
    public string? BusinessCharges { get; init; }

    [Display(Name = "Personal Charges")]
    public string? PersonalCharges { get; init; }

    [Display(Name = "Personal Limit Charges")]
    public string? PersonalLimitCharges { get; init; }

    [Display(Name = "Waiver Amount")]
    public string? WaiverAmount { get; init; }

    [Display(Name = "Comments")]
    public string? Comments { get; init; }
}
