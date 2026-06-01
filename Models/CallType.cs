using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a call type lookup entry (e.g. Local, International, Data, SMS).
/// </summary>
public class CallType
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Name")]
    [Required]
    public string Name { get; init; } = string.Empty;
}
