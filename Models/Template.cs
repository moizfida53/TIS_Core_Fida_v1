using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an email template definition, optionally scoped to a specific country.
/// Used in the template management screen to compose system notification emails.
/// </summary>
public class Template
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Country ID")]
    public int CountryId { get; init; }

    [Display(Name = "Template ID")]
    public int TemplateId { get; init; }

    [Display(Name = "Template Name")]
    [Required]
    [StringLength(200)]
    public string TemplateName { get; init; } = string.Empty;

    [Display(Name = "Country Name")]
    public string? CountryName { get; init; }

    [Display(Name = "Template Text")]
    [Required]
    public string TemplateText { get; init; } = string.Empty;

    [Display(Name = "From")]
    [EmailAddress]
    public string? EmailFrom { get; init; }

    [Display(Name = "BCC")]
    public string? EmailBcc { get; init; }

    [Display(Name = "Subject")]
    [Required]
    [StringLength(500)]
    public string Subject { get; init; } = string.Empty;
}
