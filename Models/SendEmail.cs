using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an email dispatch record, used both for composing outbound emails
/// and for querying the sent email log. Submitted via Ajax.
/// </summary>
public class SendEmail
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Template ID")]
    public int TemplateId { get; init; }

    [Display(Name = "Bill ID")]
    public int BillId { get; init; }

    [Display(Name = "Bill Date")]
    public string? BillDate { get; init; }

    [Display(Name = "Bill IDs (Batch)")]
    public int[]? Bid { get; init; }

    [Display(Name = "Subject")]
    public string? Subject { get; init; }

    [Display(Name = "Email Body")]
    public string? EmailText { get; init; }

    [Display(Name = "From")]
    [EmailAddress]
    public string? EmailFrom { get; init; }

    [Display(Name = "To")]
    [EmailAddress]
    public string? EmailTo { get; init; }

    [Display(Name = "CC")]
    public string? Cc { get; init; }

    [Display(Name = "Sent")]
    public bool Sent { get; init; }

    [Display(Name = "Sent On")]
    public string? SentOn { get; init; }

    [Display(Name = "Email IDs")]
    public int[]? EmailId { get; init; }

    [Display(Name = "Template Name")]
    public string? TemplateName { get; init; }

    [Display(Name = "Is Sent")]
    public int IsSent { get; init; }
}
