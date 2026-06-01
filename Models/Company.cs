using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a company / entity lookup used for multi-company support.
/// </summary>
public class Company
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Company Name")]
    [Required(ErrorMessage = "Company name is required.")]
    [StringLength(200)]
    public string CompanyName { get; init; } = string.Empty;
}
