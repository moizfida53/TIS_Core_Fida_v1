using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Represents a dynamic import column mapping configuration used during bill file uploads.
/// Col1–Col8 map spreadsheet columns to known database fields.
/// </summary>
public class Column
{
    [Display(Name = "Columns")]
    public string? Cols { get; init; }

    [Display(Name = "Column 1")] public string? Col1 { get; init; }
    [Display(Name = "Column 2")] public string? Col2 { get; init; }
    [Display(Name = "Column 3")] public string? Col3 { get; init; }
    [Display(Name = "Column 4")] public string? Col4 { get; init; }
    [Display(Name = "Column 5")] public string? Col5 { get; init; }
    [Display(Name = "Column 6")] public string? Col6 { get; init; }
    [Display(Name = "Column 7")] public string? Col7 { get; init; }
    [Display(Name = "Column 8")] public string? Col8 { get; init; }

    [Display(Name = "Provider")]
    public int Provider { get; init; }

    [Display(Name = "DB Connection String")]
    public string? DbConstr { get; init; }

    [Display(Name = "DB Table Name")]
    public string? DbTableName { get; init; }

    [Display(Name = "Views")]
    public string? Views { get; init; }
}
