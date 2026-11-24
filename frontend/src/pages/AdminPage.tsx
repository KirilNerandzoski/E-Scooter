import { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Wrench,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  RotateCcw,
  Ban,
  Play,
  Check,
  Pencil,
  AlertCircle,
} from 'lucide-react';
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
import { formatMkd, formatShortDateTime } from '../utils/pricing';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AdminPageProps {
  apiLive: boolean;
  currentUser: UserAccount;
  users: UserAccount[];
  vehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  stations: Station[];
  reservations: Reservation[];
  monthlyRevenue: MonthlyRevenuePoint[];
  onToggleMaintenance: (vehicleId: string) => void;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => void;
  onDeleteVehicle: (vehicleId: string) => void;
  onAddType: (vt: Omit<VehicleType, 'id'>) => void;
  onUpdateType: (typeId: string, patch: Partial<VehicleType>) => void;
  onDeleteType: (typeId: string) => void;
  onAddStation: (station: Omit<Station, 'id'>) => void;
  onUpdateStation: (stationId: string, patch: Partial<Station>) => void;
  onDeleteStation: (stationId: string) => void;
  onAdminSetReservationStatus: (reservationId: string, status: ReservationStatus) => void;
  onDeleteReservation: (reservationId: string) => void;
  onCreateUser: (user: Omit<UserAccount, 'id' | 'createdAt'>) => void;
  onUpdateUserRole: (userId: string, role: AccountRole) => void;
  onToggleUserActive: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onResetSystemData: () => void;
}

type AdminSection = 'dashboard' | 'vehicles' | 'types' | 'stations' | 'reservations' | 'users';

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => void;
}

export function AdminPage({
  apiLive,
  currentUser,
  users,
  vehicles,
  vehicleTypes,
  stations,
  reservations,
  monthlyRevenue,
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
  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // Reservations filters
  const [resStatusFilter, setResStatusFilter] = useState<ReservationStatus | 'ALL'>('ALL');
  const [resStationFilter, setResStationFilter] = useState<string>('ALL');
  const [resFromDate, setResFromDate] = useState<string>('');
  const [resToDate, setResToDate] = useState<string>('');
  const [resSearch, setResSearch] = useState('');

  // Add Vehicle form
  const [newVehName, setNewVehName] = useState('');
  const [newVehCode, setNewVehCode] = useState('');
  const [newVehTypeId, setNewVehTypeId] = useState(vehicleTypes[0]?.id ?? '');
  const [newVehStationId, setNewVehStationId] = useState(stations[0]?.id ?? '');
  const [newVehRate, setNewVehRate] = useState(190);

  // Inline Vehicle Edit state
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState(180);
  const [editStationId, setEditStationId] = useState('');
  const [editBattery, setEditBattery] = useState(90);

  // Add Type form
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeRate, setNewTypeRate] = useState(200);

  // Inline Type Edit state
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeDesc, setEditTypeDesc] = useState('');
  const [editTypeRate, setEditTypeRate] = useState(180);

  // Add Station form
  const [newStationName, setNewStationName] = useState('');
  const [newStationDistrict, setNewStationDistrict] = useState('Centar');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationCapacity, setNewStationCapacity] = useState(10);

  // Inline Station Edit state
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editStationName, setEditStationName] = useState('');
  const [editStationDistrict, setEditStationDistrict] = useState('');
  const [editStationAddress, setEditStationAddress] = useState('');
  const [editStationCapacity, setEditStationCapacity] = useState(10);

  // Add User form (SuperAdmin)
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<AccountRole>('Customer');
  const [userFormError, setUserFormError] = useState<string | null>(null);

  const totalRevenueMkd = useMemo(() => {
    return monthlyRevenue.reduce((sum, m) => sum + m.revenueMkd, 0);
  }, [monthlyRevenue]);

  const popularVehicles = useMemo(() => {
    const counts = new Map<string, number>();
    reservations.forEach((r) => {
      if (r.status !== 'Cancelled') {
        counts.set(r.vehicleId, (counts.get(r.vehicleId) ?? 0) + 1);
      }
    });
    return vehicles
      .map((v) => ({ vehicle: v, bookings: counts.get(v.id) ?? 0 }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);
  }, [vehicles, reservations]);

  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m) => m.revenueMkd), 1);

  const filteredReservations = useMemo(() => {
    const fromMs = resFromDate ? new Date(`${resFromDate}T00:00:00`).getTime() : null;
    const toMs = resToDate ? new Date(`${resToDate}T23:59:59`).getTime() : null;

    return reservations.filter((r) => {
      if (resStatusFilter !== 'ALL' && r.status !== resStatusFilter) return false;
      if (
        resStationFilter !== 'ALL' &&
        r.pickupStationId !== resStationFilter &&
        r.returnStationId !== resStationFilter
      ) {
        return false;
      }
      const startMs = new Date(r.startTime).getTime();
      if (fromMs !== null && !Number.isNaN(fromMs) && startMs < fromMs) return false;
      if (toMs !== null && !Number.isNaN(toMs) && startMs > toMs) return false;

      if (resSearch.trim()) {
        const q = resSearch.toLowerCase();
        const veh = vehicles.find((v) => v.id === r.vehicleId);
        return (
          r.id.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          (veh?.name.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [reservations, resStatusFilter, resStationFilter, resFromDate, resToDate, resSearch, vehicles]);

  const getStationName = (id?: string) => stations.find((s) => s.id === id)?.name ?? '—';
  const getTypeName = (id: string) => vehicleTypes.find((t) => t.id === id)?.name ?? '—';

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehName.trim()) return;
    onAddVehicle({
      code: newVehCode.trim() || `RYD-${vehicles.length + 10}`,
      name: newVehName.trim(),
      typeId: newVehTypeId || vehicleTypes[0]?.id || '',
      stationId: newVehStationId || stations[0]?.id || '',
      hourlyRateMkd: newVehRate,
      fullDayRateMkd: Math.round(newVehRate * 5.4),
      batteryPercent: 100,
      rangeKm: 50,
      maxSpeedKmh: 25,
      inMaintenance: false,
    });
    setNewVehName('');
    setNewVehCode('');
  };

  const startEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id);
    setEditRate(v.hourlyRateMkd);
    setEditStationId(v.stationId);
    setEditBattery(v.batteryPercent);
  };

  const saveEditVehicle = (vehicleId: string) => {
    const safeRate = Math.max(50, Number.isFinite(editRate) ? editRate : 180);
    onUpdateVehicle(vehicleId, {
      hourlyRateMkd: safeRate,
      fullDayRateMkd: Math.round(safeRate * 5.4),
      stationId: editStationId,
      batteryPercent: Math.max(0, Math.min(100, Number.isFinite(editBattery) ? editBattery : 100)),
    });
    setEditingVehicleId(null);
  };

  const statusBadgeClass = (status: ReservationStatus) => {
    switch (status) {
      case 'Active':
        return 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]';
      case 'Reserved':
        return 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]';
      case 'Cancelled':
        return 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]';
      default:
        return 'border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]';
    }
  };

  const handleCreateType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    onAddType({
      name: newTypeName.trim(),
      description: newTypeDesc.trim() || 'Urban electric mobility vehicle.',
      defaultHourlyRateMkd: newTypeRate,
      fullDayDiscountPercent: 20,
    });
    setNewTypeName('');
    setNewTypeDesc('');
  };

  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim()) return;
    onAddStation({
      code: `SKP-${String(stations.length + 1).padStart(2, '0')}`,
      name: newStationName.trim(),
      district: newStationDistrict.trim() || 'Centar',
      address: newStationAddress.trim() || 'Skopje Mobility Dock',
      capacity: newStationCapacity,
    });
    setNewStationName('');
    setNewStationAddress('');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setUserFormError('Full name and email address are required.');
      return;
    }
    if (newUserPassword.length < 6) {
      setUserFormError('Password must be at least 6 characters.');
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === newUserEmail.trim().toLowerCase())) {
      setUserFormError('An account with that email already exists.');
      return;
    }
    onCreateUser({
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      password: newUserPassword,
      role: newUserRole,
      active: true,
    });
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('Customer');
  };

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

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DDE2E8] pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
              {isSuperAdmin ? 'SuperAdmin Control Center' : 'Fleet Administration'}
            </h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 rounded bg-[#0A1A33] px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                FULL ACCESS
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[#515F73]">
            {isSuperAdmin
              ? 'Unrestricted control over fleet, stations, vehicle types, all reservations, user accounts, roles, and system state.'
              : 'Manage Skopje vehicles, types, stations, maintenance states, and revenue analytics.'}
          </p>
        </div>

        {/* Sub-navigation */}
        <div role="tablist" aria-label="Administration sections" className="flex flex-wrap gap-1.5">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={`rounded px-3.5 py-2 text-xs font-medium tracking-[0.08em] transition-colors ${
                section === id
                  ? 'bg-[#0A1A33] text-white'
                  : 'border border-[#DDE2E8] bg-white text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD */}
      {section === 'dashboard' && (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[#DDE2E8] bg-white p-5">
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                TOTAL REVENUE (6 MO)
              </p>
              <p className="tabular-nums mt-2 font-display text-2xl font-medium text-[#0A1A33]">
                {formatMkd(totalRevenueMkd)}
              </p>
            </div>
            <div className="rounded-lg border border-[#DDE2E8] bg-white p-5">
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                ACTIVE RENTALS
              </p>
              <p className="tabular-nums mt-2 font-display text-2xl font-medium text-[#0A1A33]">
                {reservations.filter((r) => r.status === 'Active').length}
              </p>
            </div>
            <div className="rounded-lg border border-[#DDE2E8] bg-white p-5">
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                REGISTERED USERS
              </p>
              <p className="tabular-nums mt-2 font-display text-2xl font-medium text-[#0A1A33]">
                {users.length}
              </p>
            </div>
            <div className="rounded-lg border border-[#DDE2E8] bg-white p-5">
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                IN MAINTENANCE
              </p>
              <p className="tabular-nums mt-2 font-display text-2xl font-medium text-[#0A1A33]">
                {vehicles.filter((v) => v.inMaintenance).length}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="rounded-lg border border-[#DDE2E8] bg-white p-6 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-[#0A1A33]">Monthly Revenue (MKD)</h2>
                <BarChart3 className="h-4 w-4 text-[#515F73]" />
              </div>

              <div className="mt-8 flex h-52 items-end gap-4">
                {monthlyRevenue.map((item) => {
                  const pct = Math.round((item.revenueMkd / maxMonthlyRevenue) * 100);
                  return (
                    <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                      <span className="tabular-nums text-[11px] font-medium text-[#515F73]">
                        {Math.round(item.revenueMkd / 1000)}k
                      </span>
                      <div className="flex h-40 w-full items-end rounded-t bg-[#F6F7F9]">
                        <div
                          style={{ height: `${pct}%` }}
                          className="w-full rounded-t bg-[#0A1A33] transition-all duration-300 hover:bg-[#1E2D4A]"
                        />
                      </div>
                      <span className="text-xs font-medium text-[#0A1A33]">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-[#DDE2E8] bg-white p-6 lg:col-span-2">
              <h2 className="font-display text-xl text-[#0A1A33]">Most Popular Vehicles</h2>
              <div className="mt-5 divide-y divide-[#DDE2E8]">
                {popularVehicles.map(({ vehicle, bookings }) => (
                  <div key={vehicle.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-[#0A1A33]">{vehicle.name}</p>
                      <p className="text-xs text-[#515F73]">
                        {vehicle.code} · {getStationName(vehicle.stationId)}
                      </p>
                    </div>
                    <span className="tabular-nums rounded bg-[#F6F7F9] px-2.5 py-1 text-xs font-semibold text-[#0A1A33]">
                      {bookings} {bookings === 1 ? 'ride' : 'rides'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white px-6 py-4">
              <div>
                <p className="text-sm font-medium text-[#0A1A33]">System Sync &amp; Tools</p>
                <p className="text-xs text-[#515F73]">
                  {apiLive
                    ? 'Refresh all fleet, station, reservation, and user tables directly from your live PostgreSQL database.'
                    : 'Restore initial local Skopje stations, fleet, sample reservations, and default accounts.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (apiLive) {
                    onResetSystemData();
                  } else {
                    setPendingConfirm({
                      title: 'Reset local demo data?',
                      description:
                        'This will overwrite local offline changes back to the initial Skopje defaults.',
                      confirmLabel: 'Reset Data',
                      action: onResetSystemData,
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded border border-[#0A1A33]/35 bg-[#F6F7F9] px-4 py-2 text-xs font-medium tracking-[0.12em] text-[#0A1A33] hover:bg-[#0A1A33] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {apiLive ? 'SYNC FROM SERVER' : 'RESET DEMO DATA'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* VEHICLES CRUD + INLINE EDIT + MAINTENANCE */}
      {section === 'vehicles' && (
        <div className="mt-8 space-y-6">
          <form
            onSubmit={handleCreateVehicle}
            className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div className="lg:col-span-2">
              <label
                htmlFor="add-veh-name"
                className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
              >
                MODEL NAME
              </label>
              <input
                id="add-veh-name"
                type="text"
                placeholder="e.g. Rydio S2"
                value={newVehName}
                onChange={(e) => setNewVehName(e.target.value)}
                required
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
            </div>
            <div>
              <label
                htmlFor="add-veh-code"
                className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
              >
                CODE
              </label>
              <input
                id="add-veh-code"
                type="text"
                placeholder="RYD-S09"
                value={newVehCode}
                onChange={(e) => setNewVehCode(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
            </div>
            <div>
              <label
                htmlFor="add-veh-type"
                className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
              >
                TYPE
              </label>
              <select
                id="add-veh-type"
                value={newVehTypeId}
                onChange={(e) => setNewVehTypeId(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              >
                {vehicleTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="add-veh-station"
                className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
              >
                STATION
              </label>
              <select
                id="add-veh-station"
                value={newVehStationId}
                onChange={(e) => setNewVehStationId(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="add-veh-rate"
                className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
              >
                MKD / HR
              </label>
              <div className="flex gap-2">
                <input
                  id="add-veh-rate"
                  type="number"
                  min={50}
                  step={10}
                  value={newVehRate}
                  onChange={(e) => setNewVehRate(Number(e.target.value))}
                  className="tabular-nums w-20 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-2 text-sm text-[#0A1A33]"
                />
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-[#0A1A33] px-3 py-2 text-xs font-medium tracking-[0.12em] text-white hover:bg-[#1E2D4A]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ADD
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg border border-[#DDE2E8] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#DDE2E8] bg-[#F6F7F9] text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                <tr>
                  <th className="px-4 py-3">VEHICLE</th>
                  <th className="px-4 py-3">TYPE</th>
                  <th className="px-4 py-3">STATION</th>
                  <th className="px-4 py-3">TARIFF &amp; BATTERY</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE2E8]">
                {vehicles.map((v) => {
                  const isEditing = editingVehicleId === v.id;
                  return (
                    <tr key={v.id} className="hover:bg-[#F6F7F9]/60">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[#0A1A33]">{v.name}</p>
                        <p className="tabular-nums text-xs text-[#515F73]">{v.code}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#515F73]">
                        {getTypeName(v.typeId)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#515F73]">
                        {isEditing ? (
                          <select
                            aria-label={`Edit station for ${v.name}`}
                            value={editStationId}
                            onChange={(e) => setEditStationId(e.target.value)}
                            className="rounded border border-[#0A1A33] bg-white px-2 py-1 text-xs text-[#0A1A33]"
                          >
                            {stations.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          getStationName(v.stationId)
                        )}
                      </td>
                      <td className="tabular-nums px-4 py-3.5 text-xs font-medium text-[#0A1A33]">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              aria-label={`Edit hourly rate for ${v.name}`}
                              min={50}
                              step={10}
                              value={editRate}
                              onChange={(e) => setEditRate(Number(e.target.value))}
                              className="w-20 rounded border border-[#0A1A33] px-2 py-1 text-xs"
                            />
                            <input
                              type="number"
                              aria-label={`Edit battery percentage for ${v.name}`}
                              min={0}
                              max={100}
                              value={editBattery}
                              onChange={(e) => setEditBattery(Number(e.target.value))}
                              className="w-16 rounded border border-[#0A1A33] px-2 py-1 text-xs"
                            />
                            <span className="text-[11px] text-[#515F73]">%</span>
                          </div>
                        ) : (
                          <span>
                            {formatMkd(v.hourlyRateMkd)}/hr · {v.batteryPercent}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {v.inMaintenance ? (
                          <span className="inline-flex items-center gap-1 rounded border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-medium text-[#991B1B]">
                            <Wrench className="h-3 w-3" />
                            In Service
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-[#065F46]">
                            <CheckCircle2 className="h-3 w-3" />
                            In Catalog
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEditVehicle(v.id)}
                                className="inline-flex items-center gap-1 rounded bg-[#0A1A33] px-2.5 py-1.5 text-[11px] font-medium text-white"
                              >
                                <Check className="h-3 w-3" />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVehicleId(null)}
                                className="rounded border border-[#DDE2E8] bg-white px-2 py-1.5 text-[11px] text-[#515F73] hover:text-[#0A1A33]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Edit ${v.name}`}
                              onClick={() => startEditVehicle(v)}
                              className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onToggleMaintenance(v.id)}
                            className="rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#0A1A33] hover:border-[#0A1A33]"
                          >
                            {v.inMaintenance ? 'Restore' : 'Service'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${v.name}`}
                            onClick={() =>
                              setPendingConfirm({
                                title: `Delete ${v.name}?`,
                                description: `Vehicle ${v.code} (${v.name}) will be permanently removed from the fleet.`,
                                confirmLabel: 'Delete Vehicle',
                                action: () => onDeleteVehicle(v.id),
                              })
                            }
                            className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
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
      )}

      {/* VEHICLE TYPES CRUD */}
      {section === 'types' && (
        <div className="mt-8 space-y-6">
          <form
            onSubmit={handleCreateType}
            className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-5 sm:grid-cols-4"
          >
            <input
              type="text"
              aria-label="Vehicle type name"
              placeholder="Type name (e.g. Cargo Scooter)"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              required
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <input
              type="text"
              aria-label="Vehicle type description"
              placeholder="Short description"
              value={newTypeDesc}
              onChange={(e) => setNewTypeDesc(e.target.value)}
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <input
              type="number"
              aria-label="Default hourly rate in MKD"
              placeholder="Hourly MKD"
              min={50}
              step={10}
              value={newTypeRate}
              onChange={(e) => setNewTypeRate(Number(e.target.value))}
              className="tabular-nums rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A]"
            >
              <Plus className="h-3.5 w-3.5" />
              ADD TYPE
            </button>
          </form>

          <div className="grid gap-4 sm:grid-cols-2">
            {vehicleTypes.map((t) => {
              const isEditing = editingTypeId === t.id;
              return (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-5"
                >
                  {isEditing ? (
                    <div className="flex-1 space-y-2.5">
                      <input
                        type="text"
                        aria-label={`Edit name for ${t.name}`}
                        value={editTypeName}
                        onChange={(e) => setEditTypeName(e.target.value)}
                        className="w-full rounded border border-[#0A1A33] bg-[#F6F7F9] px-2.5 py-1.5 text-sm font-medium text-[#0A1A33]"
                      />
                      <input
                        type="text"
                        aria-label={`Edit description for ${t.name}`}
                        value={editTypeDesc}
                        onChange={(e) => setEditTypeDesc(e.target.value)}
                        className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          aria-label={`Edit default hourly rate for ${t.name}`}
                          min={50}
                          step={10}
                          value={editTypeRate}
                          onChange={(e) => setEditTypeRate(Number(e.target.value))}
                          className="tabular-nums w-28 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                        />
                        <span className="text-xs text-[#515F73]">MKD / hr</span>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateType(t.id, {
                              name: editTypeName.trim() || t.name,
                              description: editTypeDesc.trim(),
                              defaultHourlyRateMkd: editTypeRate,
                            });
                            setEditingTypeId(null);
                          }}
                          className="ml-auto inline-flex items-center gap-1 rounded bg-[#0A1A33] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#1E2D4A]"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTypeId(null)}
                          className="rounded border border-[#DDE2E8] px-2.5 py-1.5 text-[11px] text-[#515F73] hover:text-[#0A1A33]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-display text-xl text-[#0A1A33]">{t.name}</h3>
                      <p className="mt-1 text-xs text-[#515F73]">{t.description}</p>
                      <p className="tabular-nums mt-3 text-xs font-medium text-[#0A1A33]">
                        Base {formatMkd(t.defaultHourlyRateMkd)}/hr · Daily cap enabled
                      </p>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => {
                          setEditingTypeId(t.id);
                          setEditTypeName(t.name);
                          setEditTypeDesc(t.description);
                          setEditTypeRate(t.defaultHourlyRateMkd);
                        }}
                        className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${t.name}`}
                        onClick={() =>
                          setPendingConfirm({
                            title: `Delete vehicle type "${t.name}"?`,
                            description:
                              'Vehicle types with assigned fleet vehicles cannot be deleted until those vehicles are reassigned.',
                            confirmLabel: 'Delete Type',
                            action: () => onDeleteType(t.id),
                          })
                        }
                        className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STATIONS CRUD */}
      {section === 'stations' && (
        <div className="mt-8 space-y-6">
          <form
            onSubmit={handleCreateStation}
            className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-5 sm:grid-cols-5"
          >
            <input
              type="text"
              aria-label="Station name"
              placeholder="Station name"
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              required
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <input
              type="text"
              aria-label="Station district"
              placeholder="District"
              value={newStationDistrict}
              onChange={(e) => setNewStationDistrict(e.target.value)}
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <input
              type="text"
              aria-label="Station address"
              placeholder="Address"
              value={newStationAddress}
              onChange={(e) => setNewStationAddress(e.target.value)}
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] sm:col-span-2"
            />
            <div className="flex gap-2">
              <input
                type="number"
                min={2}
                value={newStationCapacity}
                onChange={(e) => setNewStationCapacity(Number(e.target.value))}
                aria-label="Station capacity"
                className="tabular-nums w-20 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-2 text-sm text-[#0A1A33]"
              />
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-[#0A1A33] px-3 py-2 text-xs font-medium tracking-[0.12em] text-white hover:bg-[#1E2D4A]"
              >
                <Plus className="h-3.5 w-3.5" />
                ADD
              </button>
            </div>
          </form>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => {
              const isEditing = editingStationId === s.id;
              return (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#DDE2E8] bg-white p-5"
                >
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <span className="tabular-nums text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                        {s.code}
                      </span>
                      <input
                        type="text"
                        aria-label={`Edit name for ${s.name}`}
                        value={editStationName}
                        onChange={(e) => setEditStationName(e.target.value)}
                        className="w-full rounded border border-[#0A1A33] bg-[#F6F7F9] px-2.5 py-1.5 text-sm font-medium text-[#0A1A33]"
                      />
                      <input
                        type="text"
                        aria-label={`Edit district for ${s.name}`}
                        value={editStationDistrict}
                        onChange={(e) => setEditStationDistrict(e.target.value)}
                        className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                      />
                      <input
                        type="text"
                        aria-label={`Edit address for ${s.name}`}
                        value={editStationAddress}
                        onChange={(e) => setEditStationAddress(e.target.value)}
                        className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          aria-label={`Edit dock capacity for ${s.name}`}
                          min={2}
                          value={editStationCapacity}
                          onChange={(e) => setEditStationCapacity(Number(e.target.value))}
                          className="tabular-nums w-20 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#0A1A33]"
                        />
                        <span className="text-xs text-[#515F73]">docks</span>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateStation(s.id, {
                              name: editStationName.trim() || s.name,
                              district: editStationDistrict.trim() || s.district,
                              address: editStationAddress.trim() || s.address,
                              capacity: Math.max(1, editStationCapacity),
                            });
                            setEditingStationId(null);
                          }}
                          className="ml-auto inline-flex items-center gap-1 rounded bg-[#0A1A33] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#1E2D4A]"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStationId(null)}
                          className="rounded border border-[#DDE2E8] px-2.5 py-1.5 text-[11px] text-[#515F73] hover:text-[#0A1A33]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="tabular-nums text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                        {s.code} · {s.district}
                      </span>
                      <h3 className="mt-1 font-display text-xl text-[#0A1A33]">{s.name}</h3>
                      <p className="mt-1 text-xs text-[#515F73]">{s.address}</p>
                      <p className="tabular-nums mt-2 text-xs font-medium text-[#0A1A33]">
                        Capacity: {s.capacity} docks
                      </p>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => {
                          setEditingStationId(s.id);
                          setEditStationName(s.name);
                          setEditStationDistrict(s.district);
                          setEditStationAddress(s.address);
                          setEditStationCapacity(s.capacity);
                        }}
                        className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        onClick={() =>
                          setPendingConfirm({
                            title: `Delete station "${s.name}"?`,
                            description:
                              'Stations that still hold docked vehicles cannot be deleted until those vehicles are moved.',
                            confirmLabel: 'Delete Station',
                            action: () => onDeleteStation(s.id),
                          })
                        }
                        className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALL RESERVATIONS */}
      {section === 'reservations' && (
        <div className="mt-8 space-y-5">
          <div className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
            <input
              type="search"
              aria-label="Search reservations"
              placeholder="Search ID, customer, vehicle..."
              value={resSearch}
              onChange={(e) => setResSearch(e.target.value)}
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <select
              aria-label="Filter reservations by status"
              value={resStatusFilter}
              onChange={(e) => setResStatusFilter(e.target.value as ReservationStatus | 'ALL')}
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Reserved">Reserved</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <select
              aria-label="Filter reservations by station"
              value={resStationFilter}
              onChange={(e) => setResStationFilter(e.target.value)}
              className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            >
              <option value="ALL">All Stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Filter reservations from date"
              value={resFromDate}
              onChange={(e) => setResFromDate(e.target.value)}
              className="tabular-nums rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            <div className="flex gap-2">
              <input
                type="date"
                aria-label="Filter reservations to date"
                value={resToDate}
                onChange={(e) => setResToDate(e.target.value)}
                className="tabular-nums min-w-0 flex-1 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
              {(resSearch ||
                resStatusFilter !== 'ALL' ||
                resStationFilter !== 'ALL' ||
                resFromDate ||
                resToDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setResSearch('');
                    setResStatusFilter('ALL');
                    setResStationFilter('ALL');
                    setResFromDate('');
                    setResToDate('');
                  }}
                  className="shrink-0 rounded border border-[#DDE2E8] bg-white px-2.5 py-2 text-xs font-medium text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#DDE2E8] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#DDE2E8] bg-[#F6F7F9] text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                <tr>
                  <th className="px-4 py-3">BOOKING</th>
                  <th className="px-4 py-3">CUSTOMER</th>
                  <th className="px-4 py-3">VEHICLE</th>
                  <th className="px-4 py-3">WINDOW</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">TOTAL</th>
                  <th className="px-4 py-3 text-right">CONTROLS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE2E8]">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#515F73]">
                      No reservations match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((r) => {
                    const veh = vehicles.find((v) => v.id === r.vehicleId);
                    return (
                      <tr key={r.id} className="hover:bg-[#F6F7F9]/60">
                        <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-xs font-medium text-[#0A1A33]">
                          {r.id}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-medium text-[#0A1A33]">{r.customerName}</p>
                          <p className="text-[11px] text-[#515F73]">{r.customerEmail}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[#0A1A33]">{veh?.name ?? '—'}</td>
                        <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-xs text-[#515F73]">
                          {formatShortDateTime(r.startTime)} → {formatShortDateTime(r.endTime)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded border px-2.5 py-1 text-[11px] font-medium tracking-[0.1em] ${statusBadgeClass(r.status)}`}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold text-[#0A1A33]">
                          {r.status === 'Cancelled' ? (
                            <span className="font-normal text-[#8C97A8] line-through">
                              {formatMkd(r.totalPriceMkd)}
                            </span>
                          ) : (
                            <>
                              {formatMkd(r.totalPriceMkd + r.latePenaltyMkd)}
                              {r.latePenaltyMkd > 0 && (
                                <span className="block text-[11px] font-normal text-[#991B1B]">
                                  +{formatMkd(r.latePenaltyMkd)} late
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {r.status === 'Reserved' && (
                            <button
                              type="button"
                              aria-label={`Mark reservation ${r.id} active`}
                              title="Mark Active"
                              onClick={() => onAdminSetReservationStatus(r.id, 'Active')}
                              className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#0A1A33] hover:border-[#0A1A33]"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(r.status === 'Reserved' || r.status === 'Active') && (
                            <>
                              <button
                                type="button"
                                aria-label={`Complete reservation ${r.id}`}
                                title="Complete"
                                onClick={() => onAdminSetReservationStatus(r.id, 'Completed')}
                                className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#0A1A33] hover:border-[#0A1A33]"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Cancel reservation ${r.id}`}
                                title="Cancel"
                                onClick={() =>
                                  setPendingConfirm({
                                    title: `Cancel reservation ${r.id}?`,
                                    description: `This will cancel ${r.customerName}'s reservation and release the vehicle.`,
                                    confirmLabel: 'Cancel Reservation',
                                    action: () => onAdminSetReservationStatus(r.id, 'Cancelled'),
                                  })
                                }
                                className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              aria-label={`Delete reservation ${r.id} permanently`}
                              title="Delete permanently"
                              onClick={() =>
                                setPendingConfirm({
                                  title: `Delete reservation ${r.id}?`,
                                  description:
                                    'This permanently removes the booking record from system history.',
                                  confirmLabel: 'Delete Record',
                                  action: () => onDeleteReservation(r.id),
                                })
                              }
                              className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUPERADMIN USERS & ROLES */}
      {section === 'users' && isSuperAdmin && (
        <div className="mt-8 space-y-6">
          <form
            onSubmit={handleCreateUser}
            className="space-y-3 rounded-lg border border-[#DDE2E8] bg-white p-5"
          >
            {userFormError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded border border-[#9B2C2C]/30 bg-[#FFF5F5] px-3 py-2 text-xs text-[#822020]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{userFormError}</span>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                aria-label="New user full name"
                placeholder="Full name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                required
                className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
              <input
                type="email"
                aria-label="New user email address"
                placeholder="Email address"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                required
                className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
              <input
                type="password"
                aria-label="New user password"
                placeholder="Password (min 6 chars)"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                required
                className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
              <select
                aria-label="New user role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as AccountRole)}
                className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              >
                <option value="Customer">Customer</option>
                <option value="Admin">Admin</option>
                <option value="SuperAdmin">SuperAdmin</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A]"
              >
                <Plus className="h-3.5 w-3.5" />
                CREATE USER
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg border border-[#DDE2E8] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#DDE2E8] bg-[#F6F7F9] text-[11px] font-medium tracking-[0.12em] text-[#515F73]">
                <tr>
                  <th className="px-4 py-3">USER</th>
                  <th className="px-4 py-3">ROLE</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE2E8]">
                {users.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-[#F6F7F9]/60">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[#0A1A33]">
                          {u.name}{' '}
                          {isSelf && (
                            <span className="ml-1 text-[11px] text-[#515F73]">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-[#515F73]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          aria-label={`Role for ${u.name}`}
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) => {
                            const nextRole = e.target.value as AccountRole;
                            setPendingConfirm({
                              title: `Change ${u.name}'s role to ${nextRole}?`,
                              description:
                                nextRole === 'SuperAdmin'
                                  ? `Granting SuperAdmin gives ${u.email} unrestricted control over all users, roles, fleet, and reservations.`
                                  : `This updates ${u.email} from ${u.role} to ${nextRole}.`,
                              confirmLabel: `Set ${nextRole}`,
                              action: () => onUpdateUserRole(u.id, nextRole),
                            });
                          }}
                          className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-50"
                        >
                          <option value="Customer">Customer</option>
                          <option value="Admin">Admin</option>
                          <option value="SuperAdmin">SuperAdmin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        {u.active ? (
                          <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-[#065F46]">
                            Active
                          </span>
                        ) : (
                          <span className="rounded border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-medium text-[#991B1B]">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => onToggleUserActive(u.id)}
                            className="rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#0A1A33] hover:border-[#0A1A33] disabled:opacity-40"
                          >
                            {u.active ? 'Suspend' : 'Reactivate'}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            aria-label={`Delete ${u.name}`}
                            onClick={() =>
                              setPendingConfirm({
                                title: `Delete user ${u.name}?`,
                                description: `Account ${u.email} will be permanently deleted and cannot sign in again.`,
                                confirmLabel: 'Delete User',
                                action: () => onDeleteUser(u.id),
                              })
                            }
                            className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:opacity-40"
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
      )}

      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.title}
          description={pendingConfirm.description}
          confirmLabel={pendingConfirm.confirmLabel}
          onConfirm={() => {
            pendingConfirm.action();
            setPendingConfirm(null);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}
