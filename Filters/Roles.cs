namespace TIS.Filters;

/// <summary>
/// Defines the role identifiers used throughout the authorisation system.
/// Values must match the Role_ID column in tblUserRole.
/// </summary>
public enum Roles
{
    Employee      = 1,
    LineManager   = 2,
    Administrator = 3,
    AdminService  = 4,
    Finance       = 5,
    Secretary     = 6,
    SuperAdmin    = 8
}
