using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents an audit change-detail record capturing old and new field values
/// for a specific audit trail entry.
/// </summary>
public class Details
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Serial No")]
    public int Sno { get; init; }

    [Display(Name = "Audit Trail ID")]
    public int AtId { get; init; }

    [Display(Name = "Old Value")]
    public string? OldValue { get; init; }

    [Display(Name = "New Value")]
    public string? NewValue { get; init; }

    [Display(Name = "Field Name")]
    public string? FieldName { get; init; }
}
