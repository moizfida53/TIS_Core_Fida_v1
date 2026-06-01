using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace TIS.Filters;

/// <summary>
/// ASP.NET Core authorisation filter that checks the session-stored EmpRoleID
/// against a list of permitted <see cref="Roles"/> values.
/// SuperAdmin (role 8) bypasses all role checks automatically.
/// Replaces the legacy MVC 5 <c>AuthorizeAttribute</c> implementation.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RoleAuthorizeAttribute : Attribute, IAuthorizationFilter
{
    private readonly Roles[] _allowedRoles;

    /// <param name="roles">One or more roles permitted to access the decorated target.</param>
    public RoleAuthorizeAttribute(params Roles[] roles)
    {
        _allowedRoles = roles ?? [];
    }

    /// <inheritdoc />
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var session = context.HttpContext.Session;

        // ── Session guard ────────────────────────────────────────────────────
        var empRoleRaw = session.GetString("EmpRoleID");

        if (string.IsNullOrEmpty(empRoleRaw) || !int.TryParse(empRoleRaw, out int empRoleId))
        {
            Deny(context);
            return;
        }

        // ── SuperAdmin bypasses all role restrictions ─────────────────────────
        if (empRoleId == (int)Roles.SuperAdmin)
            return;

        // ── Role check ────────────────────────────────────────────────────────
        if (_allowedRoles.Length == 0 || !_allowedRoles.Any(r => (int)r == empRoleId))
        {
            Deny(context);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static void Deny(AuthorizationFilterContext context)
    {
        bool isAjax = context.HttpContext.Request.Headers.XRequestedWith == "XMLHttpRequest";

        context.Result = isAjax
            ? new StatusCodeResult(403)
            : new ViewResult { ViewName = "AccessDenied" };
    }
}
