using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a country with currency and exchange rate information,
/// used for international call pricing and data roaming.
/// </summary>
public class Country
{
    [Display(Name = "Country ID")]
    public int CountryId { get; init; }

    [Display(Name = "Country Name")]
    [Required]
    public string CountryName { get; init; } = string.Empty;

    [Display(Name = "Currency")]
    public string? Currency { get; init; }

    [Display(Name = "Country Code")]
    [StringLength(10)]
    public string? CountryCode { get; init; }

    [Display(Name = "Exchange Rate")]
    public decimal ExchangeRate { get; init; }

    [Display(Name = "Shaya Code")]
    public string? ShayaCode { get; init; }

    [Display(Name = "Selected Values")]
    public string[]? SelectedValues { get; set; }
}
