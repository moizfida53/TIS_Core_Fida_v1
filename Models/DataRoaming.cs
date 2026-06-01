using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a data roaming entry mapping a country to its mobile operator,
/// used to identify and classify international roaming charges on bills.
/// </summary>
public class DataRoaming
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Country")]
    [Required]
    public string Country { get; init; } = string.Empty;

    [Display(Name = "Operator")]
    public string? Operator { get; init; }
}
