using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents the filter criteria submitted from the bill search / list screen via Ajax.
/// </summary>
public class Search
{
    [Display(Name = "Month")]
    [Range(0, 12)]
    public int Month { get; init; }

    [Display(Name = "Year")]
    [Range(2000, 2100)]
    public int Year { get; init; }

    [Display(Name = "Provider")]
    public int Provider { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Status")]
    public int Status { get; init; }

    [Display(Name = "Company ID")]
    public int CompanyId { get; init; }
}
