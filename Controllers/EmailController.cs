using Microsoft.AspNetCore.Mvc;
using TIS.Filters;
using TIS.Helpers;

namespace TIS.Controllers;

/// <summary>
/// Email — admin management of notification email templates.
/// The view (Email/Templates) is a Bootstrap 5 + DataTables page; its data is
/// served by AjaxController.LoadTemplates / UpdateTemplates (sp_GetTemplates /
/// sp_SaveTemplates). Replaces the legacy jqxGrid WebForms page.
/// </summary>
[RoleAuthorize(Roles.SuperAdmin)]
public class EmailController : Controller
{
    public IActionResult Index() => RedirectToAction(nameof(Templates));

    public IActionResult Templates()
        => HttpContext.Session.GetString("EmpLoginName") is null
            ? View("AccessDenied")
            : View(nameof(Templates));
}
