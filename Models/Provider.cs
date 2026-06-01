using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Merged model representing a telecom provider / carrier.
/// Replaces both the original Provider (with VoIP / country fields) and
/// Provider1 (lightweight ID + Name only) — controllers can use the same type
/// for both detailed and lightweight scenarios; unused properties will simply be null / default.
/// </summary>
public class Provider
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Name")]
    [Required(ErrorMessage = "Provider name is required.")]
    [StringLength(200)]
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Indicates whether this provider routes calls over VoIP infrastructure.
    /// Null when loaded from a lightweight (Provider1-style) query.
    /// </summary>
    [Display(Name = "Is VoIP")]
    public bool? IsVoip { get; init; }

    /// <summary>
    /// The country this provider operates in.
    /// Null when loaded from a lightweight (Provider1-style) query.
    /// </summary>
    [Display(Name = "Country ID")]
    public int? CountryId { get; init; }
}
