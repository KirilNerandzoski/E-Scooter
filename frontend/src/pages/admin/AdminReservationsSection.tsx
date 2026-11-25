import { useCallback, useMemo, useState } from 'react';
import { Ban, Check, Loader2, Play, Trash2 } from 'lucide-react';
import type { Reservation, ReservationStatus, Station, Vehicle } from '../../types/rydio';
import { formatMkd, formatShortDateTime } from '../../utils/pricing';
import type { PendingConfirm } from './types';

interface AdminReservationsSectionProps {
  reservations: Reservation[];
  vehicles: Vehicle[];
  stations: Station[];
  canDeleteReservations: boolean;
  onRequestConfirm: (confirm: PendingConfirm) => void;
  onAdminSetReservationStatus: (
    reservationId: string,
    status: ReservationStatus
  ) => Promise<void>;
  onDeleteReservation: (reservationId: string) => Promise<void>;
}

function statusBadgeClass(status: ReservationStatus) {
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
}

export function AdminReservationsSection({
  reservations,
  vehicles,
  stations,
  canDeleteReservations,
  onRequestConfirm,
  onAdminSetReservationStatus,
  onDeleteReservation,
}: AdminReservationsSectionProps) {
  const [resStatusFilter, setResStatusFilter] = useState<ReservationStatus | 'ALL'>('ALL');
  const [resStationFilter, setResStationFilter] = useState<string>('ALL');
  const [resFromDate, setResFromDate] = useState<string>('');
  const [resToDate, setResToDate] = useState<string>('');
  const [resSearch, setResSearch] = useState('');
  const [busyResId, setBusyResId] = useState<string | null>(null);

  const resolveVehicleLabel = useCallback(
    (r: Reservation) => {
      if (r.vehicleId) {
        const veh = vehicles.find((v) => v.id === r.vehicleId);
        if (veh) return veh.name;
      }
      return r.vehicleName || 'Retired Vehicle';
    },
    [vehicles]
  );

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
        const vehName = resolveVehicleLabel(r).toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          vehName.includes(q)
        );
      }
      return true;
    });
  }, [
    reservations,
    resStatusFilter,
    resStationFilter,
    resFromDate,
    resToDate,
    resSearch,
    resolveVehicleLabel,
  ]);

  const runStatusUpdate = async (id: string, status: ReservationStatus) => {
    if (busyResId) return;
    setBusyResId(id);
    try {
      await onAdminSetReservationStatus(id, status);
    } finally {
      setBusyResId(null);
    }
  };

  const hasActiveFilter = Boolean(
    resSearch ||
      resStatusFilter !== 'ALL' ||
      resStationFilter !== 'ALL' ||
      resFromDate ||
      resToDate
  );

  return (
    <div className="mt-6 space-y-5 sm:mt-8">
      {/* Labeled Filter Bar */}
      <div className="grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label
            htmlFor="res-filter-search"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            SEARCH
          </label>
          <input
            id="res-filter-search"
            type="search"
            placeholder="ID, rider, vehicle..."
            value={resSearch}
            onChange={(e) => setResSearch(e.target.value)}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="res-filter-status"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            STATUS
          </label>
          <select
            id="res-filter-status"
            value={resStatusFilter}
            onChange={(e) => setResStatusFilter(e.target.value as ReservationStatus | 'ALL')}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Reserved">Reserved</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="res-filter-station"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            STATION
          </label>
          <select
            id="res-filter-station"
            value={resStationFilter}
            onChange={(e) => setResStationFilter(e.target.value)}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          >
            <option value="ALL">All Stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="res-filter-from"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            FROM DATE
          </label>
          <input
            id="res-filter-from"
            type="date"
            value={resFromDate}
            onChange={(e) => setResFromDate(e.target.value)}
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
        <div>
          <label
            htmlFor="res-filter-to"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-[#515F73]"
          >
            TO DATE
          </label>
          <div className="flex gap-2">
            <input
              id="res-filter-to"
              type="date"
              value={resToDate}
              onChange={(e) => setResToDate(e.target.value)}
              className="tabular-nums min-h-[42px] min-w-0 flex-1 rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
            />
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setResSearch('');
                  setResStatusFilter('ALL');
                  setResStationFilter('ALL');
                  setResFromDate('');
                  setResToDate('');
                }}
                className="min-h-[42px] shrink-0 rounded border border-[#DDE2E8] bg-white px-3 py-2 text-xs font-medium text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Stacked Cards (< xl) */}
      <div className="space-y-3 xl:hidden">
        {filteredReservations.length === 0 ? (
          <div className="rounded-lg border border-[#DDE2E8] bg-white p-8 text-center text-sm text-[#515F73]">
            No reservations match the current filters.
          </div>
        ) : (
          filteredReservations.map((r) => {
            const isBusy = busyResId === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-[#DDE2E8] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular-nums text-xs font-semibold text-[#0A1A33]">{r.id}</span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] ${statusBadgeClass(r.status)}`}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-medium text-[#0A1A33]">
                      {resolveVehicleLabel(r)}
                    </p>
                    <p className="text-xs text-[#515F73]">
                      {r.customerName} · {r.customerEmail}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.status === 'Cancelled' ? (
                      <span className="tabular-nums text-xs text-[#8C97A8] line-through">
                        {formatMkd(r.totalPriceMkd)}
                      </span>
                    ) : (
                      <>
                        <p className="tabular-nums text-sm font-semibold text-[#0A1A33]">
                          {formatMkd(r.totalPriceMkd + r.latePenaltyMkd)}
                        </p>
                        {r.latePenaltyMkd > 0 && (
                          <p className="tabular-nums text-[11px] text-[#991B1B]">
                            +{formatMkd(r.latePenaltyMkd)} late
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <p className="tabular-nums mt-2 text-xs text-[#515F73]">
                  {formatShortDateTime(r.startTime)} → {formatShortDateTime(r.endTime)}
                </p>

                {(r.status === 'Reserved' || r.status === 'Active' || canDeleteReservations) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#DDE2E8] pt-3">
                    {r.status === 'Reserved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runStatusUpdate(r.id, 'Active')}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-45"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Activate
                      </button>
                    )}
                    {(r.status === 'Reserved' || r.status === 'Active') && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runStatusUpdate(r.id, 'Completed')}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-45"
                        >
                          <Check className="h-3 w-3" />
                          Complete
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            onRequestConfirm({
                              title: `Cancel reservation ${r.id}?`,
                              description: `This will cancel ${r.customerName}'s reservation and release the vehicle.`,
                              confirmLabel: 'Cancel Reservation',
                              action: () => onAdminSetReservationStatus(r.id, 'Cancelled'),
                            })
                          }
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-[#DDE2E8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:opacity-45"
                        >
                          <Ban className="h-3 w-3" />
                          Cancel
                        </button>
                      </>
                    )}
                    {canDeleteReservations && (
                      <button
                        type="button"
                        disabled={isBusy}
                        aria-label={`Delete reservation ${r.id} permanently`}
                        onClick={() =>
                          onRequestConfirm({
                            title: `Delete reservation ${r.id}?`,
                            description:
                              'This permanently removes the booking record from system history.',
                            confirmLabel: 'Delete Record',
                            action: () => onDeleteReservation(r.id),
                          })
                        }
                        className="ml-auto inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded border border-[#DDE2E8] bg-white p-2 text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:opacity-45"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (xl+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-[#DDE2E8] bg-white xl:block">
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
                const isBusy = busyResId === r.id;
                return (
                  <tr key={r.id} className="hover:bg-[#F6F7F9]/60">
                    <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-xs font-medium text-[#0A1A33]">
                      {r.id}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-[#0A1A33]">{r.customerName}</p>
                      <p className="text-[11px] text-[#515F73]">{r.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#0A1A33]">{resolveVehicleLabel(r)}</td>
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
                            disabled={isBusy}
                            aria-label={`Mark reservation ${r.id} active`}
                            title="Mark Active"
                            onClick={() => void runStatusUpdate(r.id, 'Active')}
                            className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#0A1A33] hover:border-[#0A1A33] disabled:opacity-45"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        {(r.status === 'Reserved' || r.status === 'Active') && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Complete reservation ${r.id}`}
                              title="Complete"
                              onClick={() => void runStatusUpdate(r.id, 'Completed')}
                              className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#0A1A33] hover:border-[#0A1A33] disabled:opacity-45"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Cancel reservation ${r.id}`}
                              title="Cancel"
                              onClick={() =>
                                onRequestConfirm({
                                  title: `Cancel reservation ${r.id}?`,
                                  description: `This will cancel ${r.customerName}'s reservation and release the vehicle.`,
                                  confirmLabel: 'Cancel Reservation',
                                  action: () => onAdminSetReservationStatus(r.id, 'Cancelled'),
                                })
                              }
                              className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:opacity-45"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {canDeleteReservations && (
                          <button
                            type="button"
                            disabled={isBusy}
                            aria-label={`Delete reservation ${r.id} permanently`}
                            title="Delete permanently"
                            onClick={() =>
                              onRequestConfirm({
                                title: `Delete reservation ${r.id}?`,
                                description:
                                  'This permanently removes the booking record from system history.',
                                confirmLabel: 'Delete Record',
                                action: () => onDeleteReservation(r.id),
                              })
                            }
                            className="rounded border border-[#DDE2E8] bg-white p-1.5 text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:opacity-45"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
