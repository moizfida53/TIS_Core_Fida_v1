using System;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Container for all Email and SMS related models used in group messaging workflows.
/// Inner classes are kept as nested types to preserve controller compatibility.
/// </summary>
public static class EmailSms
{
    // ── Email ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Represents an email group used for bulk email dispatch.
    /// </summary>
    public class EmailGroup
    {
        [Display(Name = "Group ID")]
        public int GroupId { get; init; }

        [Display(Name = "Group Name")]
        public string? GroupName { get; init; }

        [Display(Name = "Checked Group List")]
        public string? CheckedGroupList { get; init; }

        [Display(Name = "Template ID")]
        public int TemplateId { get; init; }

        [Display(Name = "Subject")]
        public string? Subject { get; init; }

        [Display(Name = "Group IDs")]
        public string? GroupIds { get; init; }

        [Display(Name = "Emails")]
        public string? Emails { get; init; }
    }

    /// <summary>
    /// Represents an employee entry within an email/SMS group.
    /// </summary>
    public class Employees
    {
        [Display(Name = "User ID")]
        public int Uid { get; init; }

        [Display(Name = "Username")]
        public string? Username { get; init; }

        [Display(Name = "Email")]
        [EmailAddress]
        public string? Email { get; init; }

        [Display(Name = "Subscription No")]
        public string? SubNo { get; init; }

        [Display(Name = "Organisation")]
        public string? Org { get; init; }

        [Display(Name = "Employee IDs")]
        public int[]? Emp { get; init; }

        [Display(Name = "Group Name")]
        public string? GroupName { get; init; }

        [Display(Name = "Group ID")]
        public int GroupId { get; init; }

        [Display(Name = "Is Updated")]
        public int IsUpdated { get; set; }

        [Display(Name = "Subscription Numbers")]
        public long[]? SubNos { get; init; }
    }

    // ── SMS ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Represents an SMS group used for bulk SMS dispatch.
    /// </summary>
    public class SmsGroup
    {
        [Display(Name = "Group ID")]
        public int GroupId { get; init; }

        [Display(Name = "Group Name")]
        public string? GroupName { get; init; }

        [Display(Name = "Checked Group List")]
        public string? CheckedGroupList { get; init; }

        [Display(Name = "Template ID")]
        public int TemplateId { get; init; }

        [Display(Name = "Group IDs")]
        public string? GroupIds { get; init; }

        [Display(Name = "Mobile Numbers")]
        public string? MobileNos { get; init; }

        [Display(Name = "SMS Text")]
        public string? Sms { get; init; }

        [Display(Name = "Language")]
        public int Language { get; init; }
    }

    /// <summary>
    /// Represents a single mobile number entry within an SMS group.
    /// </summary>
    public class Mobile
    {
        [Display(Name = "Mobile No")]
        [Phone]
        public string? MobileNo { get; init; }
    }

    // ── Search ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Search / filter criteria for querying email and SMS history.
    /// </summary>
    public class EmailSmsSearch
    {
        [Display(Name = "Start Date")]
        [DataType(DataType.Date)]
        public DateTime StartDate { get; init; }

        [Display(Name = "End Date")]
        [DataType(DataType.Date)]
        public DateTime EndDate { get; init; }

        [Display(Name = "Status")]
        public int Status { get; init; }
    }
}
