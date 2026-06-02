using Microsoft.AspNetCore.Authentication.Negotiate;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Windows Authentication (opt-in) ───────────────────────────────────────────
// Negotiate = NTLM / Kerberos — the browser sends the current Windows identity.
//
// This is now gated by the "UseWindowsAuth" config flag (appsettings.json):
//   • true  → register Negotiate (requires Windows Auth ENABLED on IIS, otherwise
//             the Negotiate handler throws "…server that directly supports Windows
//             Authentication" at startup).
//   • false → skip Negotiate entirely. The app then has no Windows identity, and
//             UserController falls back to the configured "loginName" in
//             appsettings.json — exactly the disabled-Windows-Auth scenario.
var useWindowsAuth = builder.Configuration.GetValue<bool>("UseWindowsAuth");
if (useWindowsAuth)
{
    builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
        .AddNegotiate();
}
else
{
    // Register core authentication services (no scheme) so app.UseAuthentication()
    // remains valid; the request is treated as anonymous and the username comes
    // from the configured "loginName".
    builder.Services.AddAuthentication();
}

// Configure Session
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.Name = ".TIS.Session";
});
builder.Services
    .AddControllersWithViews(options =>
    {
        // Global POC expiry filter — short-circuits every action to
        // AccessDenied once the proof-of-concept cutoff date is past.
        // Ported from the legacy TIS_MVC PocExpiryFilter.
        options.Filters.Add<PocExpiryFilter>();
    })
    .AddRazorRuntimeCompilation();
// Register custom services
builder.Services.AddScoped<DB>();
builder.Services.AddScoped<CommonLogic>();

// Active Directory — bind configurable settings and register the lookup service
builder.Services.Configure<ActiveDirectoryOptions>(
    builder.Configuration.GetSection(ActiveDirectoryOptions.SectionName));
#pragma warning disable CA1416 // AD APIs are Windows-only; the app targets win-x64
builder.Services.AddScoped<AdLookupService>();
#pragma warning restore CA1416
// Add HttpContextAccessor for accessing HttpContext in services
builder.Services.AddHttpContextAccessor();

// Add distributed memory cache (required for session)
builder.Services.AddDistributedMemoryCache();

var app = builder.Build();

// Configure the HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthentication();   // ← must come before UseAuthorization
app.UseSession();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=User}/{action=Index}/{id?}");

app.Run();