using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Payload model for the Force Bill action, allowing admins to push bills through
/// the approval workflow with specific waiver and training flags.
/// Submitted via Ajax.
/// </summary>
public class ForceBill
{
    [Display(Name = "Bill IDs")]
    public int[] BillId { get; init; } = [];

    [Display(Name = "Status")]
    public int Status { get; init; }

    [Display(Name = "Call Type")]
    public int CallType { get; init; }

    [Display(Name = "Waive Rental")]
    public bool WavRental { get; init; }

    [Display(Name = "Waive Business")]
    public bool WavBusiness { get; init; }

    [Display(Name = "Training")]
    public bool Train { get; init; }

    [Display(Name = "User ID")]
    public int Uid { get; init; }
}
