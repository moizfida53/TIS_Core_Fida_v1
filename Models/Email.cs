using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Lightweight model for passing a semicolon-delimited email address string
/// (e.g. for bulk recipient lists submitted via Ajax).
/// </summary>
public class Email
{
    [Display(Name = "Email Addresses")]
    [Required]
    public string Emails { get; init; } = string.Empty;
}
