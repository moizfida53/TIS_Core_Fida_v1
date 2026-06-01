using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a telephone bill header record.
/// </summary>
public class Bill
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Bill Date")]
    [DataType(DataType.Date)]
    public DateTime BillDate { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmpName { get; init; }

    [Display(Name = "Bill Number")]
    public string? BillNumber { get; init; }

    [Display(Name = "Mobile")]
    public string? Mobile { get; init; }

    [Display(Name = "Total Amount")]
    public double TotalAmount { get; init; }

    [Display(Name = "Last Updated On")]
    public string? LastUpdatedOn { get; init; }

    [Display(Name = "Comments")]
    public string? Comments { get; init; }

    [Display(Name = "Subscription ID")]
    public string? SubsId { get; init; }

    [Display(Name = "Provider ID")]
    public int ProviderId { get; init; }

    [Display(Name = "Provider Name")]
    public string? ProviderName { get; init; }

    [Display(Name = "Manager Name")]
    public string? ManagerName { get; init; }

    [Display(Name = "Status Name")]
    public string? StatusName { get; init; }

    [Display(Name = "Status ID")]
    public int StatusId { get; init; }

    [Display(Name = "Currency")]
    public string? Currency { get; init; }

    [Display(Name = "Department")]
    public string? Department { get; init; }
}
