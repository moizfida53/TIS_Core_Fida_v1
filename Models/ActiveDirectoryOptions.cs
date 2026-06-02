namespace TIS.Models;

/// <summary>
/// Strongly-typed binding for the "ActiveDirectory" section in appsettings.json.
/// Everything (domain, LDAP path, and the AD attribute names) is configurable so
/// the deployment can be re-pointed without recompiling/redeploying the app.
/// </summary>
public class ActiveDirectoryOptions
{
    public const string SectionName = "ActiveDirectory";

    /// <summary>AD domain, e.g. "kddc.local".</summary>
    public string Domain { get; set; } = string.Empty;

    /// <summary>LDAP path, e.g. "LDAP://kddc,DC=local".</summary>
    public string LdapPath { get; set; } = string.Empty;

    /// <summary>Names of the AD attributes to read (overridable per environment).</summary>
    public AdAttributeMap Attributes { get; set; } = new();
}

/// <summary>
/// The AD schema attribute names. Defaults match a standard AD schema, but each
/// can be overridden in appsettings.json if your directory names them differently.
/// </summary>
public class AdAttributeMap
{
    public string DisplayName    { get; set; } = "displayName";
    public string Department     { get; set; } = "department";
    public string Title          { get; set; } = "title";
    public string EmployeeNumber { get; set; } = "employeeNumber";
    public string Email          { get; set; } = "mail";
    public string Mobile         { get; set; } = "mobile";
}

/// <summary>Result of an AD user lookup, returned to the client as JSON.</summary>
public class AdUser
{
    public string SamAccount     { get; set; } = string.Empty;
    public string DisplayName    { get; set; } = string.Empty;
    public string Department     { get; set; } = string.Empty;
    public string Title          { get; set; } = string.Empty;
    public string EmployeeNumber { get; set; } = string.Empty;
    public string Email          { get; set; } = string.Empty;
    public string Mobile         { get; set; } = string.Empty;
}
