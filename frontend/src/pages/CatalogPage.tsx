import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Gauge,
  MapPin,
  X,
} from 'lucide-react';
import type { Reservation, Station, Vehicle, VehicleType } from '../types/rydio';
import {
  calculateReservationPrice,
  formatMkd,
  formatWindowDuration,
  getMaxEndDateTimeLocal,
  getMinStartDateTimeLocal,
  isVehicleAvailable,
  toLocalDateTimeInput,
  toSafeIso,
  validateFilterWindow,
} from '../utils/pricing';
import { VehicleSilhouette } from '../components/VehicleSilhouette';
import { resolveVehicleSilhouetteKind } from '../utils/vehicleSilhouette';

interface CatalogPageProps {
  vehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  stations: Station[];
  reservations: Reservation[];
  filterTypeId: string;
  filterStationId: string;
  filterStart: string;
  filterEnd: string;
  onChangeType: (val: string) => void;
  onChangeStation: (val: string) => void;
  onChangeStart: (val: string) => void;
  onChangeEnd: (val: string) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

const PAGE_SIZE = 6;
const DURATION_PRESETS = [
  { label: 'Now', hours: 2, fromNow: true },
  { label: '2h', hours: 2, fromNow: false },
  { label: '4h', hours: 4, fromNow: false },
  { label: 'Full Day', hours: 24, fromNow: false },
  { label: 'Weekend', hours: 48, fromNow: false },
];

export function CatalogPage({
  vehicles,
  vehicleTypes,
  stations,
  reservations,
  filterTypeId,
  filterStationId,
  filterStart,
  filterEnd,
  onChangeType,
  onChangeStation,
  onChangeStart,
  onChangeEnd,
  onSelectVehicle,
}: CatalogPageProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [nowRef, setNowRef] = useState(() => new Date());

  const startIso = toSafeIso(filterStart);
  const endIso = toSafeIso(filterEnd);
  const windowCheck = useMemo(
    () => validateFilterWindow(filterStart, filterEnd, nowRef),
    [filterStart, filterEnd, nowRef]
  );
  const windowInvalid = !windowCheck.valid;

  const minStartLocal = useMemo(() => getMinStartDateTimeLocal(nowRef), [nowRef]);
  const maxEndLocal = useMemo(
    () => getMaxEndDateTimeLocal(filterStart, nowRef),
    [filterStart, nowRef]
  );

  const activeDurationHours =
    !windowInvalid && startIso && endIso
      ? Math.ceil((new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60 * 60))
      : null;
  const windowLabel = formatWindowDuration(filterStart, filterEnd);

  const applyPreset = (hours: number, fromNow: boolean) => {
    const freshNow = new Date();
    setNowRef(freshNow);
    if (fromNow) {
      const nowStart = new Date(freshNow.getTime() + 2 * 60 * 1000);
      nowStart.setSeconds(0, 0);
      const nextEnd = new Date(nowStart.getTime() + hours * 60 * 60 * 1000);
      onChangeStart(toLocalDateTimeInput(nowStart));
      onChangeEnd(toLocalDateTimeInput(nextEnd));
      setPage(1);
      return;
    }

    const baseStart = startIso ? new Date(startIso) : new Date(freshNow.getTime() + 60 * 60 * 1000);
    if (!startIso) {
      baseStart.setMinutes(0, 0, 0);
      onChangeStart(toLocalDateTimeInput(baseStart));
    }
    const nextEnd = new Date(baseStart.getTime() + hours * 60 * 60 * 1000);
    onChangeEnd(toLocalDateTimeInput(nextEnd));
    setPage(1);
  };

  const filteredVehicles = useMemo(() => {
    if (windowInvalid) return [];
    return vehicles
      .filter((v) => {
        if (v.inMaintenance) return false;
        if (filterTypeId && v.typeId !== filterTypeId) return false;
        if (filterStationId && v.stationId !== filterStationId) return false;
        return isVehicleAvailable(v, reservations, startIso, endIso, nowRef);
      })
      .sort((a, b) =>
        sortOrder === 'asc'
          ? a.hourlyRateMkd - b.hourlyRateMkd
          : b.hourlyRateMkd - a.hourlyRateMkd
      );
  }, [
    vehicles,
    reservations,
    filterTypeId,
    filterStationId,
    startIso,
    endIso,
    sortOrder,
    windowInvalid,
    nowRef,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredVehicles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getStationName = (id: string) => stations.find((s) => s.id === id)?.name ?? 'Skopje';
  const getType = (id: string) => vehicleTypes.find((t) => t.id === id);
  const activeStationObj = filterStationId
    ? stations.find((s) => s.id === filterStationId)
    : undefined;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      <div className="flex flex-col gap-4 border-b border-[#DDE2E8] pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="max-w-xl">
          <h1 className="font-display text-[1.75rem] font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
            Fleet Catalog &amp; Live Availability
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#515F73]">
            Showing only vehicles free across your selected window. Vehicles in maintenance are
            automatically excluded.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 self-start rounded border border-[#DDE2E8] bg-white px-3.5 py-2 text-xs font-medium tracking-[0.12em] text-[#0A1A33] transition-colors hover:border-[#0A1A33] sm:self-auto"
        >
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          PRICE: {sortOrder === 'asc' ? 'LOW TO HIGH' : 'HIGH TO LOW'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mt-5 grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-3.5 sm:mt-6 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
        <div>
          <label
            htmlFor="cat-type"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
          >
            VEHICLE TYPE
          </label>
          <select
            id="cat-type"
            value={filterTypeId}
            onChange={(e) => {
              onChangeType(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          >
            <option value="">All Vehicles</option>
            {vehicleTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="cat-station"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
          >
            PICKUP STATION
          </label>
          <select
            id="cat-station"
            value={filterStationId}
            onChange={(e) => {
              onChangeStation(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          >
            <option value="">All Skopje Stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="cat-start"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
          >
            START WINDOW
          </label>
          <input
            id="cat-start"
            type="datetime-local"
            min={minStartLocal}
            value={filterStart}
            onChange={(e) => {
              onChangeStart(e.target.value);
              setPage(1);
            }}
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] lg:px-2.5 lg:text-[13px]"
          />
        </div>

        <div>
          <label
            htmlFor="cat-end"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
          >
            RETURN WINDOW
          </label>
          <input
            id="cat-end"
            type="datetime-local"
            min={filterStart || minStartLocal}
            max={maxEndLocal}
            value={filterEnd}
            onChange={(e) => {
              onChangeEnd(e.target.value);
              setPage(1);
            }}
            className="tabular-nums min-h-[42px] w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] lg:px-2.5 lg:text-[13px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#DDE2E8] pt-3 sm:col-span-2 sm:gap-2 lg:col-span-4">
          <span className="w-full text-[11px] font-medium tracking-[0.12em] text-[#515F73] sm:w-auto">
            QUICK WINDOW:
          </span>
          {DURATION_PRESETS.map((p) => {
            const isActive = !p.fromNow && activeDurationHours === p.hours;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={isActive}
                onClick={() => applyPreset(p.hours, p.fromNow)}
                className={`min-h-[34px] rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'border-[#0A1A33] bg-[#0A1A33] text-white'
                    : 'border-[#DDE2E8] bg-[#F6F7F9] text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]'
                }`}
              >
                {p.label}
              </button>
            );
          })}

          {activeStationObj && (
            <button
              type="button"
              onClick={() => {
                onChangeStation('');
                setPage(1);
              }}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-[#0A1A33]/30 bg-[#F6F7F9] px-2.5 py-1 text-[11px] font-medium text-[#0A1A33] hover:border-[#0A1A33]"
            >
              <MapPin className="h-3 w-3" />
              {activeStationObj.name}
              <X className="h-3 w-3" />
            </button>
          )}

          {(filterTypeId || filterStationId) && (
            <button
              type="button"
              onClick={() => {
                onChangeType('');
                onChangeStation('');
                setPage(1);
              }}
              className="ml-auto min-h-[32px] text-xs font-medium text-[#515F73] hover:text-[#0A1A33] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {windowInvalid && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#9B2C2C]/30 bg-[#FFF5F5] px-4 py-3 text-xs text-[#822020]"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{windowCheck.error}</span>
          </span>
          {windowCheck.canResetToNow && (
            <button
              type="button"
              onClick={() => applyPreset(2, true)}
              className="rounded border border-[#822020]/35 bg-white px-2.5 py-1 text-[11px] font-medium text-[#822020] hover:bg-[#822020] hover:text-white"
            >
              Set to Now
            </button>
          )}
        </div>
      )}

      {/* Results Ledger */}
      <div className="mt-5 space-y-3 sm:mt-6">
        {pageItems.length === 0 ? (
          <div className="rounded-lg border border-[#DDE2E8] bg-white p-8 text-center sm:p-12">
            <p className="font-display text-xl text-[#0A1A33]">
              No vehicles available for this period.
            </p>
            <p className="mt-2 text-sm text-[#515F73]">
              Clear a filter or adjust the start/end window to view other rides across Skopje.
            </p>
            <button
              type="button"
              onClick={() => {
                onChangeType('');
                onChangeStation('');
                setPage(1);
              }}
              className="mt-5 min-h-[40px] rounded border border-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-[#0A1A33] hover:bg-[#0A1A33] hover:text-white"
            >
              RESET FILTERS
            </button>
          </div>
        ) : (
          pageItems.map((vehicle) => {
            const vType = getType(vehicle.typeId);
            const typeName = vType?.name ?? 'Electric';
            const silhouetteKind = resolveVehicleSilhouetteKind(vehicle.name, typeName);
            const est = !windowInvalid
              ? calculateReservationPrice(
                  vehicle,
                  filterStart,
                  filterEnd,
                  nowRef,
                  vType?.fullDayDiscountPercent ?? 20
                )
              : null;
            return (
              <article
                key={vehicle.id}
                className="flex flex-col justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-4 transition-colors hover:border-[#0A1A33]/45 sm:flex-row sm:items-center sm:p-5"
              >
                <div className="flex items-start gap-3.5 sm:items-center sm:gap-5">
                  <div className="shrink-0 rounded-md border border-[#DDE2E8] bg-[#F6F7F9] p-2 sm:p-2.5">
                    <VehicleSilhouette
                      kind={silhouetteKind}
                      className="h-8 w-12 sm:h-10 sm:w-16"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2 py-0.5 text-[11px] font-medium text-[#0A1A33]">
                        {vehicle.code}
                      </span>
                      <span className="text-[11px] font-medium tracking-[0.14em] text-[#515F73]">
                        {typeName.toUpperCase()}
                      </span>
                    </div>

                    <h2 className="font-display text-xl font-normal text-[#0A1A33] sm:text-2xl">
                      {vehicle.name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#515F73]">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0A1A33]" strokeWidth={1.6} />
                        {getStationName(vehicle.stationId)}
                      </span>
                      <span className="tabular-nums inline-flex items-center gap-1.5">
                        <BatteryCharging
                          className="h-3.5 w-3.5 shrink-0 text-[#0A1A33]"
                          strokeWidth={1.6}
                        />
                        {vehicle.batteryPercent}% ({vehicle.rangeKm} km)
                      </span>
                      <span className="tabular-nums inline-flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5 shrink-0 text-[#0A1A33]" strokeWidth={1.6} />
                        {vehicle.maxSpeedKmh} km/h max
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DDE2E8] pt-3.5 sm:shrink-0 sm:gap-6 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="tabular-nums font-display text-xl font-medium text-[#0A1A33] sm:text-2xl">
                      {formatMkd(vehicle.hourlyRateMkd)}
                      <span className="text-xs font-normal text-[#515F73]"> / hr</span>
                    </p>
                    <p className="tabular-nums text-xs text-[#515F73]">
                      Full-day cap: {formatMkd(vehicle.fullDayRateMkd)}
                    </p>
                    {est?.valid && (
                      <p className="tabular-nums mt-0.5 text-xs font-semibold text-[#0A1A33]">
                        Est. {formatMkd(est.finalPriceMkd)} ({windowLabel})
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectVehicle(vehicle)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded bg-[#0A1A33] px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-[#1E2D4A]"
                  >
                    RESERVE
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {filteredVehicles.length > PAGE_SIZE && (
        <div className="mt-7 flex flex-col gap-3 border-t border-[#DDE2E8] pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="tabular-nums text-xs text-[#515F73]">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filteredVehicles.length)} of {filteredVehicles.length}{' '}
            available vehicles
          </span>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex min-h-[38px] items-center gap-1 rounded border border-[#DDE2E8] bg-white px-3 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="tabular-nums px-2 text-xs font-medium text-[#0A1A33]">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex min-h-[38px] items-center gap-1 rounded border border-[#DDE2E8] bg-white px-3 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
