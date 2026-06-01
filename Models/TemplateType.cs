using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a template category / type lookup (e.g. Employee Reminder, Manager Notification).
/// </summary>
public class TemplateType
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Template Name")]
    [Required]
    public string TemplateName { get; init; } = string.Empty;
}
