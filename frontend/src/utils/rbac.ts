import type { AccountRole, RbacPermission, UserAccount } from '../types/rydio';

export const SUPERADMIN_EMAIL = 'superadmin@rydio.mk';

/**
 * Only Customer and Admin can ever be assigned to non-primary accounts.
 * SuperAdmin is strictly locked to SUPERADMIN_EMAIL.
 */
export const ASSIGNABLE_ROLES: readonly ('Customer' | 'Admin')[] = ['Customer', 'Admin'];

export const ROLE_PERMISSIONS: Record<AccountRole, readonly RbacPermission[]> = {
  Customer: ['catalog:read', 'reservations:own'],
  Admin: [
    'catalog:read',
    'reservations:own',
    'reports:view',
    'fleet:manage',
    'types:manage',
    'stations:manage',
    'reservations:manage',
  ],
  SuperAdmin: [
    'catalog:read',
    'reservations:own',
    'reports:view',
    'fleet:manage',
    'types:manage',
    'stations:manage',
    'reservations:manage',
    'reservations:delete',
    'users:manage',
    'roles:assign',
  ],
};

export function isPrimarySuperAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === SUPERADMIN_EMAIL);
}

export function isPrimarySuperAdmin(user?: Pick<UserAccount, 'email' | 'role'> | null): boolean {
  return Boolean(user && isPrimarySuperAdminEmail(user.email) && user.role === 'SuperAdmin');
}

/**
 * Enforces the single-SuperAdmin invariant on any user object:
 * ONLY superadmin@rydio.mk can hold 'SuperAdmin'; any other account with 'SuperAdmin' becomes 'Customer'.
 */
export function normalizeUserRole(email: string, rawRole?: string | null): AccountRole {
  if (isPrimarySuperAdminEmail(email)) return 'SuperAdmin';
  if (rawRole === 'Admin') return 'Admin';
  return 'Customer';
}

export function sanitizeUsersRbac(users: UserAccount[]): UserAccount[] {
  return users.map((u) => {
    const normalizedRole = normalizeUserRole(u.email, u.role);
    const active = isPrimarySuperAdminEmail(u.email) ? true : u.active;
    return {
      ...u,
      role: normalizedRole,
      active,
      permissions: [...ROLE_PERMISSIONS[normalizedRole]],
    };
  });
}

export function hasPermission(
  user: UserAccount | null | undefined,
  permission: RbacPermission
): boolean {
  if (!user || !user.active) {
    return permission === 'catalog:read';
  }
  const effectiveRole = normalizeUserRole(user.email, user.role);
  if (user.permissions && user.permissions.length > 0 && effectiveRole === user.role) {
    return user.permissions.includes(permission);
  }
  return ROLE_PERMISSIONS[effectiveRole].includes(permission);
}

export function canAccessAdminPanel(user: UserAccount | null | undefined): boolean {
  return hasPermission(user, 'fleet:manage');
}
