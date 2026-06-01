using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a provider bill file upload record, tracking the file name,
/// sheet, billing period, amount totals, and provider association.
/// </summary>
public class Upload
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "File Name")]
    [Required]
    public string FileName { get; init; } = string.Empty;

    [Display(Name = "Sheet Name")]
    public string? SheetName { get; init; }

    [Display(Name = "Upload Date")]
    [DataType(DataType.Date)]
    public DateTime UploadDate { get; init; }

    [Display(Name = "Bill Date")]
    [DataType(DataType.Date)]
    public DateTime BillDate { get; init; }

    [Display(Name = "Bill Amount")]
    public string? BillAmount { get; init; }

    [Display(Name = "Provider Name")]
    public string? ProviderName { get; init; }

    [Display(Name = "Provider ID")]
    public int ProviderId { get; init; }

    [Display(Name = "Month")]
    [Range(1, 12)]
    public int Month { get; init; }

    [Display(Name = "Year")]
    [Range(2000, 2100)]
    public int Year { get; init; }

    [Display(Name = "DB Based")]
    public string? DbBased { get; init; }
}
