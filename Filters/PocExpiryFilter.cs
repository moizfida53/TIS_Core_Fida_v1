using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace TIS.Filters;

/// <summary>
/// Global action filter that blocks access after the proof-of-concept expiry
/// date. Once the date is past, every controller action short-circuits to the
/// AccessDenied view with a "POC period has Expired" message in TempData.
/// Ported from the legacy TIS_MVC PocExpiryFilter.
/// Registered globally in Program.cs:
///     services.AddControllersWithViews(o => o.Filters.Add&lt;PocExpiryFilter&gt;())
/// </summary>
public sealed class PocExpiryFilter : IActionFilter
{
    // Strict greater-than: the cutoff day itself is still allowed.
    private static readonly DateTime PocExpiryDate = new DateTime(2030, 12, 31);

    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (DateTime.Today <= PocExpiryDate) return;

        if (context.Controller is Controller controller)
        {
            controller.TempData["ErrorMessage"] = "POC period has Expired";
        }

        context.Result = new ViewResult { ViewName = "AccessDenied" };
    }

    public void OnActionExecuted(ActionExecutedContext context) { /* nothing */ }
}
