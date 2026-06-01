using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a bill record projected for reporting, including approval and payroll data.
/// </summary>
public class BillReport
{
    [Display(Name = "Bill ID")]
    public int BillId { get; init; }

    [Display(Name = "Subscription No")]
    public string? SubNo { get; init; }

    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }

    [Display(Name = "Employee No")]
    public string? EmployeeNo { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmployeeName { get; init; }

    [Display(Name = "Total Amount")]
    public string? TotalAmount { get; init; }

    [Display(Name = "Manager Name")]
    public string? ManagerName { get; init; }

    [Display(Name = "Bill Status")]
    public string? BillStatus { get; init; }

    [Display(Name = "Date Identified")]
    public string? DateIdentified { get; init; }

    [Display(Name = "Last Updated On")]
    public string? LastUpdatedOn { get; init; }

    [Display(Name = "Approved Date")]
    public string? ApprovedDate { get; init; }

    [Display(Name = "Deductible Amount")]
    public string? DeductibleAmount { get; init; }

    [Display(Name = "Business Charges")]
    public string? BusinessCharges { get; init; }

    [Display(Name = "Subscription Description")]
    public string? SubDescription { get; init; }

    [Display(Name = "Company")]
    public string? Company { get; init; }

    [Display(Name = "Payroll Category")]
    public string? PayrollCategory { get; init; }
}
