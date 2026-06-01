using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Payload model for a batch bill status change request (submitted via Ajax).
/// </summary>
public class ChangeBill
{
    [Display(Name = "Bill IDs")]
    public int[] BillId { get; init; } = [];

    [Display(Name = "Statuses")]
    public int[] Status { get; init; } = [];

    [Display(Name = "User IDs")]
    public int[] Uid { get; init; } = [];
}
