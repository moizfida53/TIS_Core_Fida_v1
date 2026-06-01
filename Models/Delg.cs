using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a delegation record where a manager delegates approval or identification
/// authority to a secretary for a defined date range.
/// </summary>
public class Delg
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Secretary ID")]
    public int SecId { get; init; }

    [Display(Name = "Secretary Name")]
    public string? SecName { get; init; }

    [Display(Name = "Manager ID")]
    public int ManagerId { get; init; }

    [Display(Name = "Manager Name")]
    public string? ManName { get; init; }

    [Display(Name = "Can Approve")]
    public bool CanApprove { get; init; }

    [Display(Name = "Can Identify")]
    public bool CanIdentify { get; init; }

    [Display(Name = "Start Date")]
    [DataType(DataType.Date)]
    public DateTime StartDate { get; init; }

    [Display(Name = "End Date")]
    [DataType(DataType.Date)]
    public DateTime EndDate { get; init; }
}
