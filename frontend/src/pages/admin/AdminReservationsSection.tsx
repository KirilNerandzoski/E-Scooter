import { useCallback, useMemo, useState } from 'react';
import { Ban, Check, Loader2, MapPin, Play, Trash2 } from 'lucide-react';
import type { Reservation, ReservationStatus, Station, Vehicle } from '../../types/rydio';
import { formatMkd, formatShortDateTime } from '../../utils/pricing';
import type { PendingConfirm } from './types';

interface AdminReservationsSectionProps {
  reservations: Reservation[];
  vehicles: Vehicle[];
  stations: Station[];
  initialStatusFilter?: ReservationStatus | 'ALL';
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
      return 'border-status-ok-border bg-status-ok-bg text-status-ok-text';
    case 'Reserved':
      return 'border-status-warn-border bg-status-warn-bg text-status-warn-text';
    case 'Cancelled':
      return 'border-status-danger-border bg-status-danger-bg text-status-danger-text';
    default:
      return 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-text';
  }
}

export function AdminReservationsSection({
  reservations,
  vehicles,
  stations,
  initialStatusFilter = 'ALL',
  canDeleteReservations,
  onRequestConfirm,
  onAdminSetReservationStatus,
  onDeleteReservation,
}: AdminReservationsSectionProps) {
  const [resStatusFilter, setResStatusFilter] = useState<ReservationStatus | 'ALL'>(
    initialStatusFilter
  );
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

  const resolveVehicleCode = useCallback(
    (r: Reservation) => {
      if (!r.vehicleId) return null;
      return vehicles.find((v) => v.id === r.vehicleId)?.code ?? null;
    },
    [vehicles]
  );

  const resolveStation = useCallback(
    (stationId?: string) => {
      if (!stationId) return null;
      return stations.find((s) => s.id === stationId) ?? null;
    },
    [stations]
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
        const vehCode = (resolveVehicleCode(r) ?? '').toLowerCase();
        const pickupSt = resolveStation(r.pickupStationId);
        const returnSt = resolveStation(r.returnStationId);
        const pickupLabel = `${pickupSt?.name ?? ''} ${pickupSt?.code ?? ''}`.toLowerCase();
        const returnLabel = `${returnSt?.name ?? ''} ${returnSt?.code ?? ''}`.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          vehName.includes(q) ||
          vehCode.includes(q) ||
          pickupLabel.includes(q) ||
          returnLabel.includes(q)
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
    resolveVehicleCode,
    resolveStation,
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
      <div className="grid gap-3 rounded-lg border border-mist bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label
            htmlFor="res-filter-search"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            SEARCH
          </label>
          <input
            id="res-filter-search"
            type="search"
            placeholder="ID, rider, vehicle, station..."
            value={resSearch}
            onChange={(e) => setResSearch(e.target.value)}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="res-filter-status"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            STATUS
          </label>
          <select
            id="res-filter-status"
            value={resStatusFilter}
            onChange={(e) => setResStatusFilter(e.target.value as ReservationStatus | 'ALL')}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
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
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            STATION
          </label>
          <select
            id="res-filter-station"
            value={resStationFilter}
            onChange={(e) => setResStationFilter(e.target.value)}
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
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
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            FROM DATE
          </label>
          <input
            id="res-filter-from"
            type="date"
            value={resFromDate}
            onChange={(e) => setResFromDate(e.target.value)}
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
          />
        </div>
        <div>
          <label
            htmlFor="res-filter-to"
            className="mb-1 block text-[11px] font-medium tracking-[0.12em] text-dilute-ink"
          >
            TO DATE
          </label>
          <div className="flex gap-2">
            <input
              id="res-filter-to"
              type="date"
              value={resToDate}
              onChange={(e) => setResToDate(e.target.value)}
              className="tabular-nums min-h-[42px] min-w-0 flex-1 rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
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
                className="min-h-[42px] shrink-0 rounded border border-mist bg-white px-3 py-2 text-xs font-medium text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
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
          <div className="rounded-lg border border-mist bg-white p-8 text-center text-sm text-dilute-ink">
            No reservations match the current filters.
          </div>
        ) : (
          filteredReservations.map((r) => {
            const isBusy = busyResId === r.id;
            const vehCode = resolveVehicleCode(r);
            const pickupSt = resolveStation(r.pickupStationId);
            const returnSt = resolveStation(r.returnStationId);
            return (
              <div key={r.id} className="rounded-lg border border-mist bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums text-xs font-semibold text-indigo-depth">
                      {r.id}
                    </span>
                    {vehCode && (
                      <span className="tabular-nums rounded border border-mist bg-paper-white px-1.5 py-0.5 text-[10px] font-medium text-indigo-depth">
                        {vehCode}
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] ${statusBadgeClass(r.status)}`}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-medium text-indigo-depth">
                      {resolveVehicleLabel(r)}
                    </p>
                    <p className="text-xs text-dilute-ink">
                      {r.customerName} · {r.customerEmail}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.status === 'Cancelled' ? (
                      <span className="tabular-nums text-xs text-dilute-ink line-through">
                        {formatMkd(r.totalPriceMkd)}
                      </span>
                    ) : (
                      <>
                        <p className="tabular-nums text-sm font-semibold text-indigo-depth">
                          {formatMkd(r.totalPriceMkd + r.latePenaltyMkd)}
                        </p>
                        {r.latePenaltyMkd > 0 && (
                          <p className="tabular-nums text-[11px] text-status-danger-text">
                            +{formatMkd(r.latePenaltyMkd)} late
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-mist bg-paper-white px-2.5 py-1.5 text-xs text-indigo-depth">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-depth" />
                    Taken from: {pickupSt ? `${pickupSt.name} (${pickupSt.code})` : 'Skopje Station'}
                  </span>
                  {returnSt && (
                    <span className="text-dilute-ink">
                      → Returned: <strong className="text-indigo-depth">{returnSt.name}</strong>
                    </span>
                  )}
                </div>

                <p className="tabular-nums mt-2 text-xs text-dilute-ink">
                  {formatShortDateTime(r.startTime)} → {formatShortDateTime(r.endTime)}
                </p>

                {(r.status === 'Reserved' || r.status === 'Active' || canDeleteReservations) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-mist pt-3">
                    {r.status === 'Reserved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void runStatusUpdate(r.id, 'Active')}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded border border-mist bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-45"
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
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-mist bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-45"
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
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-mist bg-white px-2.5 py-1.5 text-xs font-medium text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep disabled:opacity-45"
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
                        className="ml-auto inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded border border-mist bg-white p-2 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep disabled:opacity-45"
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
      <div className="hidden overflow-x-auto rounded-lg border border-mist bg-white xl:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-paper-white text-[11px] font-medium tracking-[0.12em] text-dilute-ink">
            <tr>
              <th className="px-4 py-3">BOOKING</th>
              <th className="px-4 py-3">CUSTOMER</th>
              <th className="px-4 py-3">VEHICLE</th>
              <th className="px-4 py-3">PICKUP STATION</th>
              <th className="px-4 py-3">WINDOW</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3 text-right">TOTAL</th>
              <th className="px-4 py-3 text-right">CONTROLS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {filteredReservations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-dilute-ink">
                  No reservations match the current filters.
                </td>
              </tr>
            ) : (
              filteredReservations.map((r) => {
                const isBusy = busyResId === r.id;
                const vehCode = resolveVehicleCode(r);
                const pickupSt = resolveStation(r.pickupStationId);
                const returnSt = resolveStation(r.returnStationId);
                return (
                  <tr key={r.id} className="hover:bg-paper-white/60">
                    <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-xs font-medium text-indigo-depth">
                      {r.id}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-indigo-depth">{r.customerName}</p>
                      <p className="text-[11px] text-dilute-ink">{r.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-indigo-depth">
                      <p className="font-medium">{resolveVehicleLabel(r)}</p>
                      {vehCode && (
                        <span className="tabular-nums mt-0.5 inline-block rounded border border-mist bg-paper-white px-1.5 py-0.5 text-[10px] font-medium text-dilute-ink">
                          {vehCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <p className="inline-flex items-center gap-1 font-medium text-indigo-depth">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-depth" />
                        <span>
                          {pickupSt ? `${pickupSt.name} (${pickupSt.code})` : 'Skopje Station'}
                        </span>
                      </p>
                      {returnSt && (
                        <p className="mt-0.5 text-[11px] text-dilute-ink">
                          Returned: {returnSt.name}
                        </p>
                      )}
                    </td>
                    <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-xs text-dilute-ink">
                      {formatShortDateTime(r.startTime)} → {formatShortDateTime(r.endTime)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded border px-2.5 py-1 text-[11px] font-medium tracking-[0.1em] ${statusBadgeClass(r.status)}`}
                      >
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold text-indigo-depth">
                      {r.status === 'Cancelled' ? (
                        <span className="font-normal text-dilute-ink line-through">
                          {formatMkd(r.totalPriceMkd)}
                        </span>
                      ) : (
                        <>
                          {formatMkd(r.totalPriceMkd + r.latePenaltyMkd)}
                          {r.latePenaltyMkd > 0 && (
                            <span className="block text-[11px] font-normal text-status-danger-text">
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
                            className="rounded border border-mist bg-white p-1.5 text-indigo-depth hover:border-indigo-depth disabled:opacity-45"
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
                              className="rounded border border-mist bg-white p-1.5 text-indigo-depth hover:border-indigo-depth disabled:opacity-45"
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
                              className="rounded border border-mist bg-white p-1.5 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep disabled:opacity-45"
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
                            className="rounded border border-mist bg-white p-1.5 text-dilute-ink hover:border-status-danger-deep hover:text-status-danger-deep disabled:opacity-45"
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
