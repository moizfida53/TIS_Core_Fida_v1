using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents system-wide configuration settings surfaced from tblConfiguration.
/// Used to drive feature flags and reminder schedules throughout the application.
/// </summary>
public class Config
{
    // ── Reminder intervals ───────────────────────────────────────────────────

    [Display(Name = "Employee Reminder (days)")]
    public string? EmpReminder { get; init; }

    [Display(Name = "Manager Reminder (days)")]
    public string? MgrReminder { get; init; }

    [Display(Name = "Force Bill Reminder (days)")]
    public string? FbReminder { get; init; }

    [Display(Name = "Line Manager Reminder (days)")]
    public string? LmReminder { get; init; }

    // ── Mail / host settings ─────────────────────────────────────────────────

    [Display(Name = "SMTP Settings")]
    public string? Smtp { get; init; }

    [Display(Name = "Admin Email")]
    [EmailAddress]
    public string? AdminEmail { get; init; }

    [Display(Name = "Host URL")]
    [Url]
    public string? HostUrl { get; init; }

    // ── Grade / approval flags ───────────────────────────────────────────────

    [Display(Name = "Supervisor Grade")]
    public string? SupGrade { get; init; }

    [Display(Name = "Enable Grade")]
    public bool EnableGrade { get; init; }

    [Display(Name = "GM Approval")]
    public bool GmApp { get; init; }

    [Display(Name = "Skip Approval on Business Zero")]
    public bool SkipAppBusZero { get; init; }

    // ── Notification flags ───────────────────────────────────────────────────

    [Display(Name = "Do Not Send Email")]
    public bool DntSndEmail { get; init; }

    // ── Display / visibility flags ───────────────────────────────────────────

    [Display(Name = "Hide Personal Calls")]
    public bool HidePerCalls { get; init; }

    [Display(Name = "Hide Allowance Limit")]
    public bool HideAllowanceLimit { get; init; }

    [Display(Name = "Hide Personal Limit")]
    public bool HidePersonalLimit { get; init; }

    // ── Financial flags ──────────────────────────────────────────────────────

    [Display(Name = "Enable Discrepancy")]
    public bool EnableDiscrepancy { get; init; }

    [Display(Name = "Deduct Business Charges")]
    public bool DedBusCharges { get; init; }

    [Display(Name = "Zero as Unlimited")]
    public bool ZeroUnlimited { get; init; }

    [Display(Name = "Allow Waiver")]
    public bool AlwWav { get; init; }

    [Display(Name = "Allow Train Force Bill")]
    public bool AlwTrainFb { get; init; }

    [Display(Name = "Enable Delete")]
    public bool EnableDelete { get; init; }
}
