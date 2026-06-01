using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a bill record projected for SAP / payroll export,
/// including personal and business charge breakdowns per employee.
/// </summary>
public class SapReport
{
    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }

    [Display(Name = "Telephone Number")]
    public string? TelephoneNumber { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmployeeName { get; init; }

    [Display(Name = "Manager Name")]
    public string? ManagerName { get; init; }

    [Display(Name = "Total Amount")]
    public string? TotalAmount { get; init; }

    [Display(Name = "Business Charges")]
    public string? BusinessCharges { get; init; }

    [Display(Name = "Personal Charges")]
    public string? PersonalCharges { get; init; }

    [Display(Name = "Deductible Amount")]
    public string? DeductibleAmount { get; init; }

    [Display(Name = "Reimbursement Amount")]
    public string? ReimbursementAmount { get; init; }

    [Display(Name = "Employee No")]
    public string? EmployeeNo { get; init; }

    [Display(Name = "Bill ID")]
    public string? BillId { get; init; }
}
