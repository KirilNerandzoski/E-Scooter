import { useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type {
  AccountRole,
  MonthlyRevenuePoint,
  Reservation,
  ReservationStatus,
  Station,
  UserAccount,
  Vehicle,
  VehicleType,
} from '../types/rydio';
import { hasPermission, isPrimarySuperAdmin } from '../utils/rbac';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminDashboardSection } from './admin/AdminDashboardSection';
import { AdminVehiclesSection, type VehicleStatusFilter } from './admin/AdminVehiclesSection';
import { AdminTypesSection } from './admin/AdminTypesSection';
import { AdminStationsSection } from './admin/AdminStationsSection';
import { AdminReservationsSection } from './admin/AdminReservationsSection';
import { AdminUsersSection } from './admin/AdminUsersSection';
import type { PendingConfirm } from './admin/types';

export interface AdminPageProps {
  apiLive: boolean;
  currentUser: UserAccount;
  users: UserAccount[];
  registeredUsersCount: number;
  vehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  stations: Station[];
  reservations: Reservation[];
  monthlyRevenue: MonthlyRevenuePoint[];
  onShowError: (message: string) => void;
  onToggleMaintenance: (vehicleId: string) => Promise<void>;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<boolean>;
  onUpdateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => Promise<boolean>;
  onDeleteVehicle: (vehicleId: string) => Promise<void>;
  onAddType: (vt: Omit<VehicleType, 'id'>) => Promise<boolean>;
  onUpdateType: (typeId: string, patch: Partial<VehicleType>) => Promise<boolean>;
  onDeleteType: (typeId: string) => Promise<void>;
  onAddStation: (station: Omit<Station, 'id'>) => Promise<boolean>;
  onUpdateStation: (stationId: string, patch: Partial<Station>) => Promise<boolean>;
  onDeleteStation: (stationId: string) => Promise<void>;
  onAdminSetReservationStatus: (reservationId: string, status: ReservationStatus) => Promise<void>;
  onDeleteReservation: (reservationId: string) => Promise<void>;
  onCreateUser: (user: Omit<UserAccount, 'id' | 'createdAt'>) => Promise<boolean>;
  onUpdateUserRole: (userId: string, role: AccountRole) => Promise<void>;
  onToggleUserActive: (userId: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onResetSystemData: () => Promise<void> | void;
}

type AdminSection = 'dashboard' | 'vehicles' | 'types' | 'stations' | 'reservations' | 'users';

export function AdminPage({
  apiLive,
  currentUser,
  users,
  registeredUsersCount,
  vehicles,
  vehicleTypes,
  stations,
  reservations,
  monthlyRevenue,
  onShowError,
  onToggleMaintenance,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onAddType,
  onUpdateType,
  onDeleteType,
  onAddStation,
  onUpdateStation,
  onDeleteStation,
  onAdminSetReservationStatus,
  onDeleteReservation,
  onCreateUser,
  onUpdateUserRole,
  onToggleUserActive,
  onDeleteUser,
  onResetSystemData,
}: AdminPageProps) {
  const isSuperAdmin =
    isPrimarySuperAdmin(currentUser) && hasPermission(currentUser, 'users:manage');
  const canDeleteReservations = hasPermission(currentUser, 'reservations:delete');
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [vehInitialFilter, setVehInitialFilter] = useState<VehicleStatusFilter>('ALL');
  const [resInitialFilter, setResInitialFilter] = useState<ReservationStatus | 'ALL'>('ALL');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const tabRefs = useRef<Partial<Record<AdminSection, HTMLButtonElement | null>>>({});

  const tabs: [AdminSection, string][] = [
    ['dashboard', 'Dashboard'],
    ['vehicles', `Vehicles (${vehicles.length})`],
    ['types', `Types (${vehicleTypes.length})`],
    ['stations', `Stations (${stations.length})`],
    ['reservations', `Reservations (${reservations.length})`],
    ...(isSuperAdmin
      ? ([['users', `Users & Roles (${users.length})`]] as [AdminSection, string][])
      : []),
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex(([id]) => id === section);
    if (idx === -1) return;

    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;

    if (nextIdx >= 0) {
      e.preventDefault();
      const nextId = tabs[nextIdx][0];
      setSection(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      <div className="flex flex-col gap-4 border-b border-mist pb-5 lg:flex-row lg:items-end lg:justify-between lg:pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[1.75rem] font-light tracking-[-0.02em] text-indigo-depth sm:text-4xl">
              {isSuperAdmin ? 'SuperAdmin Control Center' : 'Fleet Administration'}
            </h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-depth px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                FULL ACCESS
              </span>
            )}
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-dilute-ink">
            {isSuperAdmin
              ? 'Unrestricted control over fleet, stations, vehicle types, all reservations, user accounts, roles, and system state.'
              : 'Manage Skopje vehicles, types, stations, maintenance states, and revenue analytics.'}
          </p>
        </div>

        {/* Accessible Sub-navigation Tabs (2-up grid on mobile, horizontal pills on sm+) */}
        <div
          role="tablist"
          aria-label="Administration sections"
          onKeyDown={handleTabKeyDown}
          className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap"
        >
          {tabs.map(([id, label]) => {
            const isSelected = section === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                id={`admin-tab-${id}`}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={`admin-panel-${id}`}
                onClick={() => setSection(id)}
                className={`min-h-[40px] rounded px-3 py-2 text-xs font-medium tracking-[0.06em] transition-colors sm:px-3.5 sm:tracking-[0.08em] ${
                  isSelected
                    ? 'bg-indigo-depth text-white'
                    : 'border border-mist bg-white text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`admin-panel-${section}`}
        role="tabpanel"
        aria-labelledby={`admin-tab-${section}`}
      >
        {section === 'dashboard' && (
          <AdminDashboardSection
            apiLive={apiLive}
            isSuperAdmin={isSuperAdmin}
            registeredUsersCount={registeredUsersCount}
            vehicles={vehicles}
            stations={stations}
            reservations={reservations}
            monthlyRevenue={monthlyRevenue}
            onJumpToActiveRentals={() => {
              setResInitialFilter('Active');
              setSection('reservations');
            }}
            onJumpToMaintenanceVehicles={() => {
              setVehInitialFilter('SERVICE');
              setSection('vehicles');
            }}
            onJumpToUsers={isSuperAdmin ? () => setSection('users') : undefined}
            onRequestConfirm={setPendingConfirm}
            onResetSystemData={onResetSystemData}
          />
        )}

        {section === 'vehicles' && (
          <AdminVehiclesSection
            key={`veh-${vehInitialFilter}`}
            vehicles={vehicles}
            vehicleTypes={vehicleTypes}
            stations={stations}
            initialStatusFilter={vehInitialFilter}
            onShowError={onShowError}
            onRequestConfirm={setPendingConfirm}
            onToggleMaintenance={onToggleMaintenance}
            onAddVehicle={onAddVehicle}
            onUpdateVehicle={onUpdateVehicle}
            onDeleteVehicle={onDeleteVehicle}
          />
        )}

        {section === 'types' && (
          <AdminTypesSection
            vehicleTypes={vehicleTypes}
            onShowError={onShowError}
            onRequestConfirm={setPendingConfirm}
            onAddType={onAddType}
            onUpdateType={onUpdateType}
            onDeleteType={onDeleteType}
          />
        )}

        {section === 'stations' && (
          <AdminStationsSection
            stations={stations}
            onShowError={onShowError}
            onRequestConfirm={setPendingConfirm}
            onAddStation={onAddStation}
            onUpdateStation={onUpdateStation}
            onDeleteStation={onDeleteStation}
          />
        )}

        {section === 'reservations' && (
          <AdminReservationsSection
            key={`res-${resInitialFilter}`}
            reservations={reservations}
            vehicles={vehicles}
            stations={stations}
            initialStatusFilter={resInitialFilter}
            canDeleteReservations={canDeleteReservations}
            onRequestConfirm={setPendingConfirm}
            onAdminSetReservationStatus={onAdminSetReservationStatus}
            onDeleteReservation={onDeleteReservation}
          />
        )}

        {section === 'users' && isSuperAdmin && (
          <AdminUsersSection
            currentUser={currentUser}
            users={users}
            onShowError={onShowError}
            onRequestConfirm={setPendingConfirm}
            onCreateUser={onCreateUser}
            onUpdateUserRole={onUpdateUserRole}
            onToggleUserActive={onToggleUserActive}
            onDeleteUser={onDeleteUser}
          />
        )}
      </div>

      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.title}
          description={pendingConfirm.description}
          confirmLabel={pendingConfirm.confirmLabel}
          onConfirm={async () => {
            await pendingConfirm.action();
            setPendingConfirm(null);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}

export default AdminPage;
