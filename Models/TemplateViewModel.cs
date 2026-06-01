using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace TIS.Models;

/// <summary>
/// Composite view-model that bundles all data required by the template management screen:
/// the list of templates, the available template types, and the country dropdown.
/// </summary>
public class TemplateViewModel
{
    [Display(Name = "Templates")]
    public List<Template> Templates { get; init; } = [];

    [Display(Name = "Template Types")]
    public List<TemplateType> TemplateTypes { get; init; } = [];

    [Display(Name = "Countries")]
    public List<Country> Countries { get; init; } = [];
}
