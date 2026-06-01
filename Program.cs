using Microsoft.AspNetCore.Authentication.Negotiate;
using TIS.Filters;
using TIS.Helpers;
using TIS.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Windows Authentication (mirrors legacy Web.config <authentication mode="Windows" />) ──
// Negotiate = NTLM / Kerberos — the browser sends the current Windows identity automatically.
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

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