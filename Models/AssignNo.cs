using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an assigned telephone subscription number linked to an employee.
/// </summary>
public class AssignNo
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Sub No ID")]
    public int SubNoId { get; init; }

    [Display(Name = "Line Status")]
    public int LineStatus { get; init; }

    [Display(Name = "Line Status Name")]
    public string? LineStatusName { get; init; }

    [Display(Name = "Subscription No")]
    public string? SubNo { get; init; }

    [Display(Name = "Description")]
    public string? Description { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmployeeName { get; init; }

    [Display(Name = "Employee No")]
    public string? EmployeeNo { get; init; }

    [Display(Name = "Allowance Limit")]
    public decimal AllowanceLimit { get; init; }

    [Display(Name = "Business Limit")]
    public decimal BusinessLimit { get; init; }

    [Display(Name = "Start Date")]
    [DataType(DataType.Date)]
    public DateTime StartDate { get; init; }

    [Display(Name = "End Date")]
    [DataType(DataType.Date)]
    public DateTime EndDate { get; init; }

    [Display(Name = "Cost Center ID")]
    public int CostCenterId { get; init; }

    [Display(Name = "Cost Center Name")]
    public string? CostCenterName { get; init; }
}
