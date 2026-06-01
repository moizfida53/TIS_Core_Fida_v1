using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a user's personal phone book contact entry used when classifying dialled numbers.
/// </summary>
public class Contact
{
    [Display(Name = "User ID")]
    public int Uid { get; init; }

    [Display(Name = "Name")]
    public string? Name { get; init; }

    [Display(Name = "Dialled No")]
    public string? DialledNo { get; init; }

    [Display(Name = "Extension Name")]
    public string? ExName { get; init; }
}
