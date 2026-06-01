using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents login credentials submitted via the sign-in form.
/// </summary>
public class Login
{
    [Display(Name = "Username")]
    [Required(ErrorMessage = "Username is required.")]
    public string Username { get; init; } = string.Empty;

    [Display(Name = "Password")]
    [Required(ErrorMessage = "Password is required.")]
    [DataType(DataType.Password)]
    public string Password { get; init; } = string.Empty;
}
