using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an SMS template used for bulk SMS dispatch,
/// including the message body, target recipients, and language preference.
/// </summary>
public class SmsTemplate
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "SMS Template ID")]
    public int SmsTemplateId { get; init; }

    [Display(Name = "SMS Template Name")]
    [Required]
    [StringLength(200)]
    public string SmsTemplateName { get; init; } = string.Empty;

    [Display(Name = "Message")]
    [Required]
    public string Message { get; init; } = string.Empty;

    [Display(Name = "Send To")]
    public string? SmsTo { get; init; }

    [Display(Name = "SMS IDs (Batch)")]
    public int[]? SmsId { get; init; }

    [Display(Name = "Language")]
    public int Language { get; init; }
}
