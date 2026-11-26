import { useState } from 'react';
import { AlertCircle, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { AccountRole, UserAccount } from '../../types/rydio';
import {
  ASSIGNABLE_ROLES,
  isPrimarySuperAdminEmail,
  SUPERADMIN_EMAIL,
} from '../../utils/rbac';
import type { PendingConfirm } from './types';

interface AdminUsersSectionProps {
  currentUser: UserAccount;
  users: UserAccount[];
  onShowError: (message: string) => void;
  onRequestConfirm: (confirm: PendingConfirm) => void;
  onCreateUser: (user: Omit<UserAccount, 'id' | 'createdAt'>) => Promise<boolean>;
  onUpdateUserRole: (userId: string, role: AccountRole) => Promise<void>;
  onToggleUserActive: (userId: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export function AdminUsersSection({
  currentUser,
  users,
  onShowError,
  onRequestConfirm,
  onCreateUser,
  onUpdateUserRole,
  onToggleUserActive,
  onDeleteUser,
}: AdminUsersSectionProps) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AccountRole>('Customer');
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setUserFormError(null);
    if (!newUserName.trim() || !newUserEmail.trim()) {
      const msg = 'Full name and email address are required.';
      setUserFormError(msg);
      onShowError(msg);
      return;
    }
    if (newUserPassword.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setUserFormError(msg);
      onShowError(msg);
      return;
    }
    setCreating(true);
    try {
      const ok = await onCreateUser({
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        password: newUserPassword,
        role: newUserRole,
        active: true,
      });
      if (ok) {
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('Customer');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    if (busyUserId) return;
    setBusyUserId(userId);
    try {
      await onToggleUserActive(userId);
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
      <div className="rounded-lg border border-mist bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-depth" />
          <h2 className="font-display text-lg font-medium text-indigo-depth">
            Role-Based Access Control (RBAC) Policy
          </h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-dilute-ink">
          Only <strong className="text-indigo-depth">{SUPERADMIN_EMAIL}</strong> holds the locked{' '}
          <strong className="text-indigo-depth">SuperAdmin</strong> role with unrestricted control.
          Every newly registered user starts as a <strong className="text-indigo-depth">Customer</strong>{' '}
          with zero website modification rights.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          <div className="rounded border border-mist bg-paper-white p-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-dilute-ink">GUEST</p>
            <p className="mt-1 text-xs text-indigo-depth">
              Browse catalog, station map, and live window availability only.
            </p>
          </div>
          <div className="rounded border border-mist bg-paper-white p-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-depth">
              CUSTOMER (DEFAULT)
            </p>
            <p className="mt-1 text-xs text-indigo-depth">
              All new sign-ups start here. Book, pick up, return, and cancel own rides only —
              cannot modify the website.
            </p>
          </div>
          <div className="rounded border border-mist bg-paper-white p-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-depth">
              ADMIN (DELEGATED)
            </p>
            <p className="mt-1 text-xs text-indigo-depth">
              Granted only by SuperAdmin. Manages fleet, stations, types, and booking statuses;
              cannot manage users or delete records.
            </p>
          </div>
          <div className="rounded border border-indigo-depth/30 bg-white p-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-depth">
              SUPERADMIN (SINGLETON)
            </p>
            <p className="mt-1 text-xs text-indigo-depth">
              Exclusive to {SUPERADMIN_EMAIL}. Full permission over fleet, stations, types,
              reservations, reports, and user roles.
            </p>
          </div>
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => void handleCreateUser(e)}
        className="space-y-3 rounded-lg border border-mist bg-white p-4 sm:p-5"
      >
        {userFormError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded border border-status-danger-text/30 bg-status-danger-bg px-3 py-2 text-xs text-status-danger-deep"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{userFormError}</span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="add-user-name"
              className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
            >
              FULL NAME
            </label>
            <input
              id="add-user-name"
              type="text"
              placeholder="Full name"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              required
              className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
            />
          </div>
          <div>
            <label
              htmlFor="add-user-email"
              className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
            >
              EMAIL ADDRESS
            </label>
            <input
              id="add-user-email"
              type="email"
              placeholder="name@example.mk"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              required
              className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
            />
          </div>
          <div>
            <label
              htmlFor="add-user-password"
              className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
            >
              INITIAL PASSWORD
            </label>
            <input
              id="add-user-password"
              type="password"
              placeholder="Min 6 characters"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              required
              className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
            />
          </div>
          <div>
            <label
              htmlFor="add-user-role"
              className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
            >
              ASSIGNED ROLE
            </label>
            <select
              id="add-user-role"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as AccountRole)}
              className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded bg-indigo-depth px-4 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-ink-current disabled:opacity-45"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? 'CREATING...' : 'CREATE USER'}
            </button>
          </div>
        </div>
      </form>

      {/* Mobile Stacked User Cards (< md) */}
      <div className="space-y-3 md:hidden">
        {users.map((u) => {
          const isSelf = u.id === currentUser.id;
          const isLockedSuperAdmin = isPrimarySuperAdminEmail(u.email);
          const isBusy = busyUserId === u.id;

          return (
            <div key={u.id} className="rounded-lg border border-mist bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-indigo-depth">
                    {u.name} {isSelf && <span className="text-xs text-dilute-ink">(You)</span>}
                  </p>
                  <p className="truncate text-xs text-dilute-ink">{u.email}</p>
                </div>
                {u.active ? (
                  <span className="shrink-0 rounded border border-status-ok-border bg-status-ok-bg px-2 py-0.5 text-[11px] font-medium text-status-ok-text">
                    Active
                  </span>
                ) : (
                  <span className="shrink-0 rounded border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[11px] font-medium text-status-danger-text">
                    Suspended
                  </span>
                )}
              </div>

              <div className="mt-3 border-t border-mist pt-3">
                {isLockedSuperAdmin ? (
                  <span className="inline-flex items-center gap-1.5 rounded border border-indigo-depth bg-indigo-depth px-2.5 py-1 text-[11px] font-medium tracking-[0.1em] text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    SUPERADMIN (LOCKED)
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Role for ${u.name}`}
                      disabled={isSelf || isBusy}
                      value={u.role === 'Admin' ? 'Admin' : 'Customer'}
                      onChange={(e) => {
                        const nextRole = e.target.value as AccountRole;
                        onRequestConfirm({
                          title: `Change ${u.name}'s role to ${nextRole}?`,
                          description:
                            nextRole === 'Admin'
                              ? `Granting Admin allows ${u.email} to manage fleet vehicles, stations, types, and reservations.`
                              : `Setting ${u.email} to Customer revokes all website and fleet modification permissions.`,
                          confirmLabel: `Set ${nextRole}`,
                          action: () => onUpdateUserRole(u.id, nextRole),
                        });
                      }}
                      className="min-h-[38px] flex-1 rounded border border-mist bg-paper-white px-2.5 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-50"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isSelf || isBusy}
                      onClick={() => void handleToggleActive(u.id)}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded border border-mist bg-white px-3 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-40"
                    >
                      {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                      {u.active ? 'Suspend' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      disabled={isSelf || isBusy}
                      aria-label={`Delete ${u.name}`}
                      onClick={() =>
                        onRequestConfirm({
                          title: `Delete user ${u.name}?`,
                          description: `Account ${u.email} will be permanently deleted and cannot sign in again.`,
                          confirmLabel: 'Delete User',
                          action: () => onDeleteUser(u.id),
                        })
                      }
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded border border-mist p-2 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table (md+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-mist bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-paper-white text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
            <tr>
              <th className="px-4 py-3">USER</th>
              <th className="px-4 py-3">ROLE</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              const isLockedSuperAdmin = isPrimarySuperAdminEmail(u.email);
              const isBusy = busyUserId === u.id;

              return (
                <tr key={u.id} className="hover:bg-paper-white/60">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-indigo-depth">
                      {u.name}{' '}
                      {isSelf && <span className="ml-1 text-[11px] text-dilute-ink">(You)</span>}
                    </p>
                    <p className="text-xs text-dilute-ink">{u.email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    {isLockedSuperAdmin ? (
                      <span className="inline-flex items-center gap-1.5 rounded border border-indigo-depth bg-indigo-depth px-2.5 py-1 text-[11px] font-medium tracking-[0.1em] text-white">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        SUPERADMIN (LOCKED)
                      </span>
                    ) : (
                      <select
                        aria-label={`Role for ${u.name}`}
                        disabled={isSelf || isBusy}
                        value={u.role === 'Admin' ? 'Admin' : 'Customer'}
                        onChange={(e) => {
                          const nextRole = e.target.value as AccountRole;
                          onRequestConfirm({
                            title: `Change ${u.name}'s role to ${nextRole}?`,
                            description:
                              nextRole === 'Admin'
                                ? `Granting Admin allows ${u.email} to manage fleet vehicles, stations, types, and reservations.`
                                : `Setting ${u.email} to Customer revokes all website and fleet modification permissions.`,
                            confirmLabel: `Set ${nextRole}`,
                            action: () => onUpdateUserRole(u.id, nextRole),
                          });
                        }}
                        className="rounded border border-mist bg-paper-white px-2.5 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {u.active ? (
                      <span className="rounded border border-status-ok-border bg-status-ok-bg px-2.5 py-1 text-[11px] font-medium text-status-ok-text">
                        Active
                      </span>
                    ) : (
                      <span className="rounded border border-status-danger-border bg-status-danger-bg px-2.5 py-1 text-[11px] font-medium text-status-danger-text">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSelf || isLockedSuperAdmin || isBusy}
                        onClick={() => void handleToggleActive(u.id)}
                        className="inline-flex items-center gap-1 rounded border border-mist bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-depth hover:border-indigo-depth disabled:opacity-40"
                      >
                        {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                        {u.active ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        disabled={isSelf || isLockedSuperAdmin || isBusy}
                        aria-label={`Delete ${u.name}`}
                        onClick={() =>
                          onRequestConfirm({
                            title: `Delete user ${u.name}?`,
                            description: `Account ${u.email} will be permanently deleted and cannot sign in again.`,
                            confirmLabel: 'Delete User',
                            action: () => onDeleteUser(u.id),
                          })
                        }
                        className="rounded border border-mist p-1.5 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
