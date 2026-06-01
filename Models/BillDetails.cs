using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a single line-item within a bill (individual call / data / SMS record).
/// </summary>
public class BillDetails
{
    [Display(Name = "ID")]
    public int Id { get; init; }

    [Display(Name = "Call Date")]
    public string? CallDate { get; init; }

    [Display(Name = "Call Time")]
    public string? CallTime { get; init; }

    [Display(Name = "Transaction Type")]
    public string? TransType { get; init; }

    [Display(Name = "Description")]
    public string? Description { get; init; }

    [Display(Name = "Duration")]
    public string? Duration { get; init; }

    [Display(Name = "Amount")]
    public double Amount { get; init; }

    [Display(Name = "Comment")]
    public string? Comment { get; set; }

    [Display(Name = "Call Type")]
    public string? CallType { get; init; }

    [Display(Name = "Locked")]
    public bool Locked { get; init; }

    [Display(Name = "Assigned User ID")]
    public int Auid { get; init; }

    [Display(Name = "Dialled No")]
    public string? DialledNo { get; init; }

    [Display(Name = "Name")]
    public string? Name { get; init; }
}
