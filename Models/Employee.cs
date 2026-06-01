using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a lightweight employee lookup record used in dropdowns and search results.
/// For full employee profile data see <see cref="EmployeeDetails"/>.
/// </summary>
public class Employee
{
    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Employee ID")]
    public int EmpId { get; init; }

    [Display(Name = "Employee Name")]
    public string? EmpName { get; init; }

    [Display(Name = "Employee No")]
    public string? EmpNo { get; init; }

    [Display(Name = "Username")]
    public string? UserName { get; init; }
}
