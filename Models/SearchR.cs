using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents the filter criteria for the audit report / event log search screen.
/// </summary>
public class SearchR
{
    [Display(Name = "Start Date")]
    [DataType(DataType.Date)]
    public DateTime StartDate { get; init; }

    [Display(Name = "End Date")]
    [DataType(DataType.Date)]
    public DateTime EndDate { get; init; }

    [Display(Name = "Event")]
    public int Event { get; init; }

    [Display(Name = "Employee No")]
    public int EmpNo { get; init; }

    [Display(Name = "Status")]
    public string? Status { get; init; }

    [Display(Name = "User ID")]
    public string? Uid { get; init; }
}
