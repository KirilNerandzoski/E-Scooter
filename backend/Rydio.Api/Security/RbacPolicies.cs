using Microsoft.AspNetCore.Authorization;

namespace Rydio.Api.Security;

public static class RbacPolicies
{
    public const string SuperAdminEmail = "superadmin@rydio.mk";
    public const string PermissionClaimType = "permission";

    // Roles
    public const string RoleSuperAdmin = "SuperAdmin";
    public const string RoleAdmin = "Admin";
    public const string RoleCustomer = "Customer";

    // Fine-grained permissions
    public const string PermCatalogRead = "catalog:read";
    public const string PermReservationsOwn = "reservations:own";
    public const string PermReportsView = "reports:view";
    public const string PermFleetManage = "fleet:manage";
    public const string PermTypesManage = "types:manage";
    public const string PermStationsManage = "stations:manage";
    public const string PermReservationsManage = "reservations:manage";
    public const string PermReservationsDelete = "reservations:delete";
    public const string PermUsersManage = "users:manage";
    public const string PermRolesAssign = "roles:assign";

    // Named ASP.NET Core Authorization Policies
    public const string PolicyOwnReservations = "Rbac.OwnReservations";
    public const string PolicyViewReports = "Rbac.ViewReports";
    public const string PolicyManageFleet = "Rbac.ManageFleet";
    public const string PolicyManageTypes = "Rbac.ManageTypes";
    public const string PolicyManageStations = "Rbac.ManageStations";
    public const string PolicyManageReservations = "Rbac.ManageReservations";
    public const string PolicyDeleteReservations = "Rbac.DeleteReservations";
    public const string PolicyManageUsers = "Rbac.ManageUsers";

    public static bool IsPrimarySuperAdminEmail(string? email) =>
        !string.IsNullOrWhiteSpace(email) &&
        string.Equals(email.Trim(), SuperAdminEmail, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Enforces the single-SuperAdmin invariant: ONLY superadmin@rydio.mk can hold SuperAdmin.
    /// Any other account with SuperAdmin is normalized to Customer.
    /// </summary>
    public static string NormalizeRole(string? email, string? rawRole)
    {
        if (IsPrimarySuperAdminEmail(email))
            return RoleSuperAdmin;

        if (string.Equals(rawRole, RoleAdmin, StringComparison.OrdinalIgnoreCase))
            return RoleAdmin;

        return RoleCustomer;
    }

    public static IReadOnlyList<string> GetPermissionsForRole(string role) => role switch
    {
        RoleSuperAdmin =>
        [
            PermCatalogRead,
            PermReservationsOwn,
            PermReportsView,
            PermFleetManage,
            PermTypesManage,
            PermStationsManage,
            PermReservationsManage,
            PermReservationsDelete,
            PermUsersManage,
            PermRolesAssign,
        ],
        RoleAdmin =>
        [
            PermCatalogRead,
            PermReservationsOwn,
            PermReportsView,
            PermFleetManage,
            PermTypesManage,
            PermStationsManage,
            PermReservationsManage,
        ],
        RoleCustomer =>
        [
            PermCatalogRead,
            PermReservationsOwn,
        ],
        _ =>
        [
            PermCatalogRead,
        ],
    };

    public static bool HasPermission(string? role, string permission) =>
        role is not null && GetPermissionsForRole(role).Contains(permission);

    public static void RegisterPolicies(AuthorizationOptions options)
    {
        options.AddPolicy(PolicyOwnReservations, p => p.RequireClaim(PermissionClaimType, PermReservationsOwn));
        options.AddPolicy(PolicyViewReports, p => p.RequireClaim(PermissionClaimType, PermReportsView));
        options.AddPolicy(PolicyManageFleet, p => p.RequireClaim(PermissionClaimType, PermFleetManage));
        options.AddPolicy(PolicyManageTypes, p => p.RequireClaim(PermissionClaimType, PermTypesManage));
        options.AddPolicy(PolicyManageStations, p => p.RequireClaim(PermissionClaimType, PermStationsManage));
        options.AddPolicy(PolicyManageReservations, p => p.RequireClaim(PermissionClaimType, PermReservationsManage));
        options.AddPolicy(PolicyDeleteReservations, p => p.RequireClaim(PermissionClaimType, PermReservationsDelete));
        options.AddPolicy(PolicyManageUsers, p => p.RequireClaim(PermissionClaimType, PermUsersManage));
    }
}
