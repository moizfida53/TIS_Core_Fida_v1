using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an audit trail entry recording user actions within the system.
/// </summary>
public class AuditReport
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Action Name")]
    public string? ActionName { get; init; }

    [Display(Name = "Result")]
    public string? Result { get; init; }

    [Display(Name = "User")]
    public string? User { get; init; }

    [Display(Name = "User ID")]
    public string? UserId { get; init; }

    [Display(Name = "Date")]
    public string? Date { get; init; }

    [Display(Name = "Form ID")]
    public int FormId { get; init; }
}
