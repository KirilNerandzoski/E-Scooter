import { useMemo, useState } from 'react';
import { BarChart3, Loader2, RotateCcw } from 'lucide-react';
import type {
  MonthlyRevenuePoint,
  Reservation,
  Station,
  Vehicle,
} from '../../types/rydio';
import { formatMkd } from '../../utils/pricing';
import type { PendingConfirm } from './types';

interface AdminDashboardSectionProps {
  apiLive: boolean;
  isSuperAdmin: boolean;
  registeredUsersCount: number;
  vehicles: Vehicle[];
  stations: Station[];
  reservations: Reservation[];
  monthlyRevenue: MonthlyRevenuePoint[];
  onJumpToActiveRentals: () => void;
  onJumpToMaintenanceVehicles: () => void;
  onJumpToUsers?: () => void;
  onRequestConfirm: (confirm: PendingConfirm) => void;
  onResetSystemData: () => Promise<void> | void;
}

export function AdminDashboardSection({
  apiLive,
  isSuperAdmin,
  registeredUsersCount,
  vehicles,
  stations,
  reservations,
  monthlyRevenue,
  onJumpToActiveRentals,
  onJumpToMaintenanceVehicles,
  onJumpToUsers,
  onRequestConfirm,
  onResetSystemData,
}: AdminDashboardSectionProps) {
  const [syncing, setSyncing] = useState(false);

  const totalRevenueMkd = useMemo(
    () => monthlyRevenue.reduce((sum, m) => sum + m.revenueMkd, 0),
    [monthlyRevenue]
  );

  const completedRidesCount = useMemo(
    () => monthlyRevenue.reduce((sum, m) => sum + m.rides, 0),
    [monthlyRevenue]
  );

  const inProgressMkd = useMemo(
    () =>
      reservations
        .filter((r) => r.status === 'Reserved' || r.status === 'Active')
        .reduce((sum, r) => sum + r.totalPriceMkd + r.latePenaltyMkd, 0),
    [reservations]
  );

  const popularVehicles = useMemo(() => {
    const counts = new Map<string, number>();
    reservations.forEach((r) => {
      if (r.status !== 'Cancelled' && r.vehicleId) {
        counts.set(r.vehicleId, (counts.get(r.vehicleId) ?? 0) + 1);
      }
    });
    return vehicles
      .map((v) => ({ vehicle: v, bookings: counts.get(v.id) ?? 0 }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);
  }, [vehicles, reservations]);

  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m) => m.revenueMkd), 1);
  const getStationName = (id?: string) => stations.find((s) => s.id === id)?.name ?? '—';

  const handleSyncClick = async () => {
    if (syncing) return;
    if (apiLive) {
      setSyncing(true);
      try {
        await onResetSystemData();
      } finally {
        setSyncing(false);
      }
      return;
    }

    onRequestConfirm({
      title: 'Reset local demo data?',
      description:
        'This will overwrite local offline changes back to the initial Skopje defaults.',
      confirmLabel: 'Reset Data',
      action: () => onResetSystemData(),
    });
  };

  return (
    <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
      <div className="grid gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-mist bg-white p-4 sm:p-5">
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
            LIFETIME SALES
          </p>
          <p className="tabular-nums mt-1.5 font-display text-xl font-medium text-indigo-depth sm:mt-2 sm:text-2xl">
            {formatMkd(totalRevenueMkd)}
          </p>
          <p className="tabular-nums mt-1 text-[11px] text-dilute-ink">
            {completedRidesCount} completed {completedRidesCount === 1 ? 'ride' : 'rides'}
            {inProgressMkd > 0 ? ` · ${formatMkd(inProgressMkd)} pending` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onJumpToActiveRentals}
          className="rounded-lg border border-mist bg-surface-pure p-4 text-left transition-colors hover:border-indigo-depth sm:p-5"
        >
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
            ACTIVE RENTALS
          </p>
          <p className="tabular-nums mt-1.5 font-display text-xl font-medium text-indigo-depth sm:mt-2 sm:text-2xl">
            {reservations.filter((r) => r.status === 'Active').length}
          </p>
          <p className="mt-1 text-[11px] text-dilute-ink">View active bookings →</p>
        </button>
        {isSuperAdmin && onJumpToUsers ? (
          <button
            type="button"
            onClick={onJumpToUsers}
            className="rounded-lg border border-mist bg-surface-pure p-4 text-left transition-colors hover:border-indigo-depth sm:p-5"
          >
            <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
              REGISTERED USERS
            </p>
            <p className="tabular-nums mt-1.5 font-display text-xl font-medium text-indigo-depth sm:mt-2 sm:text-2xl">
              {registeredUsersCount}
            </p>
            <p className="mt-1 text-[11px] text-dilute-ink">Manage accounts &amp; roles →</p>
          </button>
        ) : (
          <div className="rounded-lg border border-mist bg-surface-pure p-4 sm:p-5">
            <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
              REGISTERED USERS
            </p>
            <p className="tabular-nums mt-1.5 font-display text-xl font-medium text-indigo-depth sm:mt-2 sm:text-2xl">
              {registeredUsersCount}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onJumpToMaintenanceVehicles}
          className="rounded-lg border border-mist bg-surface-pure p-4 text-left transition-colors hover:border-indigo-depth sm:p-5"
        >
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
            IN MAINTENANCE
          </p>
          <p className="tabular-nums mt-1.5 font-display text-xl font-medium text-indigo-depth sm:mt-2 sm:text-2xl">
            {vehicles.filter((v) => v.inMaintenance).length}
          </p>
          <p className="mt-1 text-[11px] text-dilute-ink">Filter in-service fleet →</p>
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="rounded-lg border border-mist bg-white p-4 sm:p-6 lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-indigo-depth sm:text-xl">
                Monthly Revenue (MKD)
              </h2>
              <p className="mt-0.5 text-xs text-dilute-ink">
                Live lifetime sales added automatically when customer reservations are completed
              </p>
            </div>
            <BarChart3 className="h-4 w-4 shrink-0 text-dilute-ink" />
          </div>

          <div className="mt-6 flex h-52 items-end gap-1.5 sm:mt-8 sm:h-56 sm:gap-3.5">
            {monthlyRevenue.map((item) => {
              const hasSales = item.revenueMkd > 0;
              const pct = hasSales
                ? Math.max(8, Math.round((item.revenueMkd / maxMonthlyRevenue) * 100))
                : 0;
              const shortAmount =
                item.revenueMkd >= 10000
                  ? `${(item.revenueMkd / 1000).toFixed(1).replace(/\.0$/, '')}k`
                  : item.revenueMkd.toLocaleString('en-US');
              return (
                <div
                  key={`${item.sortOrder ?? item.month}-${item.month}`}
                  title={`${item.month}: ${formatMkd(item.revenueMkd)} (${item.rides} completed ${item.rides === 1 ? 'ride' : 'rides'})`}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2"
                >
                  <span
                    className={`tabular-nums text-[10px] font-medium sm:text-[11px] ${
                      hasSales ? 'text-indigo-depth' : 'text-dilute-ink'
                    }`}
                  >
                    {shortAmount}
                  </span>
                  <div className="flex h-36 w-full items-end rounded-t bg-paper-white sm:h-40">
                    {hasSales ? (
                      <div
                        style={{ height: `${pct}%` }}
                        className="w-full rounded-t bg-indigo-depth transition-all duration-300 hover:bg-ink-current"
                      />
                    ) : (
                      <div className="h-[2px] w-full bg-mist" />
                    )}
                  </div>
                  <div className="text-center">
                    <span className="block truncate text-[11px] font-medium text-indigo-depth sm:text-xs">
                      {item.month}
                    </span>
                    <span className="tabular-nums block text-[10px] text-dilute-ink">
                      {item.rides} {item.rides === 1 ? 'ride' : 'rides'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-mist bg-white p-4 sm:p-6 lg:col-span-2">
          <h2 className="font-display text-lg text-indigo-depth sm:text-xl">Most Popular Vehicles</h2>
          <div className="mt-4 divide-y divide-mist sm:mt-5">
            {popularVehicles.map(({ vehicle, bookings }) => (
              <div key={vehicle.id} className="flex items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-indigo-depth">{vehicle.name}</p>
                  <p className="truncate text-xs text-dilute-ink">
                    {vehicle.code} · {getStationName(vehicle.stationId)}
                  </p>
                </div>
                <span className="tabular-nums shrink-0 rounded bg-paper-white px-2.5 py-1 text-xs font-semibold text-indigo-depth">
                  {bookings} {bookings === 1 ? 'ride' : 'rides'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="flex flex-col gap-3 rounded-lg border border-mist bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-medium text-indigo-depth">System Sync &amp; Tools</p>
            <p className="text-xs text-dilute-ink">
              {apiLive
                ? 'Refresh all fleet, station, reservation, and user tables directly from your live PostgreSQL database.'
                : 'Restore initial local Skopje stations, fleet, sample reservations, and default accounts.'}
            </p>
          </div>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSyncClick()}
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded border border-indigo-depth/35 bg-paper-white px-4 py-2 text-xs font-medium tracking-[0.12em] text-indigo-depth hover:bg-indigo-depth hover:text-white disabled:opacity-45"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {syncing ? 'SYNCING...' : apiLive ? 'SYNC FROM SERVER' : 'RESET DEMO DATA'}
          </button>
        </div>
      )}
    </div>
  );
}
