using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents minimal bill data used for email notification lookups.
/// </summary>
public class BillData
{
    [Display(Name = "Bill ID")]
    public int BillId { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmployeeName { get; init; }

    [Display(Name = "Subscription No")]
    public string? SubNo { get; init; }

    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }

    [Display(Name = "Total Amount")]
    public string? TotalAmount { get; init; }

    [Display(Name = "Line Manager Email")]
    [EmailAddress]
    public string? LmEmail { get; init; }
}
