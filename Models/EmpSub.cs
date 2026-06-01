using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents the relationship between an employee and their assigned subscription number,
/// used in subscription assignment lookups and reports.
/// </summary>
public class EmpSub
{
    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmployeeName { get; init; }

    [Display(Name = "Sub No ID")]
    public int SubNoId { get; init; }

    [Display(Name = "Subscription No")]
    public string? SubNo { get; init; }

    [Display(Name = "Organisation")]
    public string? Org { get; init; }
}
