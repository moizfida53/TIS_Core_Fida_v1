using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Merged model for system financial and display settings.
/// Replaces the original Settings class and the empty Setting placeholder.
/// Persisted to / loaded from tblConfiguration via the admin settings screen.
/// </summary>
public class Settings
{
    [Display(Name = "Enable Discrepancy")]
    public bool EnableDiscrepancy { get; init; }

    [Display(Name = "Deduct Business Charges")]
    public bool DedBussinessCharges { get; init; }

    [Display(Name = "Deduct Personal Charges")]
    public bool DedPersonalCharges { get; init; }

    [Display(Name = "Allow Waiver")]
    public bool IsAllowWaiver { get; init; }

    /// <summary>
    /// When true, a business limit of zero is treated as unlimited (no cap enforced).
    /// </summary>
    [Display(Name = "Zero Business Limit = Unlimited")]
    public bool IsZeroUnlimited { get; init; }

    /// <summary>
    /// Secondary zero-unlimited flag for personal limit (formerly IsZeroUnlimited2).
    /// </summary>
    [Display(Name = "Zero Personal Limit = Unlimited")]
    public bool IsZeroUnlimitedPersonal { get; init; }

    [Display(Name = "Hide Allowance Limit")]
    public bool HideAllowanceLimit { get; init; }

    [Display(Name = "Hide Personal Limit")]
    public bool HidePersonalLimit { get; init; }
}
