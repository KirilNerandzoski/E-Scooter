import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import type { Reservation, Station, Vehicle, VehicleType } from '../types/rydio';
import {
  calculateReservationPrice,
  formatMkd,
  formatReservationRange,
  formatWindowDuration,
  getMaxEndDateTimeLocal,
  getMinStartDateTimeLocal,
  suggestWindowAfterReservation,
  toLocalDateTimeInput,
  toSafeIso,
  validateFilterWindow,
} from '../utils/pricing';
import { groupVehiclesByModel } from '../utils/productGroups';
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
  onResetFilters: () => void;
  onSelectVehicle: (
    vehicle: Vehicle,
    overrideWindow?: { start: string; end: string }
  ) => void;
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
  onResetFilters,
  onSelectVehicle,
}: CatalogPageProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'reserved'>(
    'all'
  );
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

  const groupedProducts = useMemo(() => {
    const groups = groupVehiclesByModel({
      vehicles,
      stations,
      reservations,
      filterTypeId,
      filterStationId,
      searchQuery,
      startIso,
      endIso,
      windowInvalid,
      now: nowRef,
    });
    return groups.sort((a, b) =>
      sortOrder === 'asc'
        ? a.leadVehicle.hourlyRateMkd - b.leadVehicle.hourlyRateMkd
        : b.leadVehicle.hourlyRateMkd - a.leadVehicle.hourlyRateMkd
    );
  }, [
    vehicles,
    stations,
    reservations,
    filterTypeId,
    filterStationId,
    searchQuery,
    startIso,
    endIso,
    windowInvalid,
    nowRef,
    sortOrder,
  ]);

  const statusCounts = useMemo(() => {
    if (windowInvalid) {
      return { all: groupedProducts.length, available: 0, reserved: 0 };
    }
    const available = groupedProducts.filter((g) => g.isAvailableInScope).length;
    const reserved = groupedProducts.filter((g) => g.hasReservedInScope).length;
    return { all: groupedProducts.length, available, reserved };
  }, [groupedProducts, windowInvalid]);

  const filteredGroups = useMemo(() => {
    if (availabilityFilter === 'all' || windowInvalid) return groupedProducts;
    if (availabilityFilter === 'available') {
      return groupedProducts.filter((g) => g.isAvailableInScope);
    }
    return groupedProducts.filter((g) => g.hasReservedInScope);
  }, [groupedProducts, availabilityFilter, windowInvalid]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredGroups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getType = (id: string) => vehicleTypes.find((t) => t.id === id);
  const activeStationObj = filterStationId
    ? stations.find((s) => s.id === filterStationId)
    : undefined;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      <div className="flex flex-col gap-4 border-b border-mist pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="max-w-xl">
          <h1 className="font-display text-[1.75rem] font-light tracking-[-0.02em] text-indigo-depth sm:text-4xl">
            Fleet Catalog &amp; Live Availability
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-dilute-ink">
            Select any scooter or e-bike model and choose your pickup station when reserving.
            Reserved windows are shown live; vehicles in maintenance are hidden.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 self-start rounded border border-mist bg-white px-3.5 py-2 text-xs font-medium tracking-[0.12em] text-indigo-depth transition-colors hover:border-indigo-depth sm:self-auto"
        >
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          PRICE: {sortOrder === 'asc' ? 'LOW TO HIGH' : 'HIGH TO LOW'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mt-5 grid gap-3 rounded-lg border border-mist bg-white p-3.5 sm:mt-6 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
        <div>
          <label
            htmlFor="cat-type"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
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
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
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
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
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
            className="min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth"
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
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
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
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth lg:px-2.5 lg:text-[13px]"
          />
        </div>

        <div>
          <label
            htmlFor="cat-end"
            className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
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
            className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth lg:px-2.5 lg:text-[13px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-mist pt-3 sm:col-span-2 sm:gap-2 lg:col-span-4">
          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-dilute-ink" />
            <input
              type="search"
              aria-label="Search catalog by vehicle model, code, or station"
              placeholder="Search model or station…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="min-h-[34px] w-full rounded border border-mist bg-paper-white py-1 pr-2.5 pl-8 text-xs text-indigo-depth"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by reservation availability"
            className="inline-flex items-center rounded border border-mist bg-paper-white p-0.5"
          >
            {(
              [
                { id: 'all', label: `All (${statusCounts.all})` },
                { id: 'available', label: `Free (${statusCounts.available})` },
                { id: 'reserved', label: `Reserved (${statusCounts.reserved})` },
              ] as const
            ).map((pill) => {
              const active = availabilityFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setAvailabilityFilter(pill.id);
                    setPage(1);
                  }}
                  className={`min-h-[30px] rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors tabular-nums ${
                    active
                      ? 'bg-indigo-depth text-surface-pure'
                      : 'text-dilute-ink hover:text-indigo-depth'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <span className="w-full text-[11px] font-medium tracking-[0.12em] text-dilute-ink sm:ml-1 sm:w-auto">
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
                    ? 'border-indigo-depth bg-indigo-depth text-white'
                    : 'border-mist bg-paper-white text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth'
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
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-indigo-depth/30 bg-paper-white px-2.5 py-1 text-[11px] font-medium text-indigo-depth hover:border-indigo-depth"
            >
              <MapPin className="h-3 w-3" />
              {activeStationObj.name}
              <X className="h-3 w-3" />
            </button>
          )}

          {(filterTypeId ||
            filterStationId ||
            searchQuery.trim() ||
            availabilityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                onChangeType('');
                onChangeStation('');
                setSearchQuery('');
                setAvailabilityFilter('all');
                setPage(1);
              }}
              className="ml-auto min-h-[32px] text-xs font-medium text-dilute-ink hover:text-indigo-depth hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {windowInvalid && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-status-danger-text/30 bg-status-danger-bg px-4 py-3 text-xs text-status-danger-deep"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{windowCheck.error}</span>
          </span>
          {windowCheck.canResetToNow && (
            <button
              type="button"
              onClick={() => applyPreset(2, true)}
              className="rounded border border-status-danger-deep/35 bg-white px-2.5 py-1 text-[11px] font-medium text-status-danger-deep hover:bg-status-danger-deep hover:text-white"
            >
              Set to Now
            </button>
          )}
        </div>
      )}

      {/* Results Ledger (1 card per distinct model) */}
      <div className="mt-5 space-y-3 sm:mt-6">
        {pageItems.length === 0 ? (
          <div className="rounded-lg border border-mist bg-white p-8 text-center sm:p-12">
            <p className="font-display text-xl text-indigo-depth">
              No vehicles match this filter.
            </p>
            <p className="mt-2 text-sm text-dilute-ink">
              Clear a filter or adjust the start/end window to view rides across Skopje.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setAvailabilityFilter('all');
                onResetFilters();
                setPage(1);
              }}
              className="mt-5 min-h-[40px] rounded border border-indigo-depth px-4 py-2 text-xs font-medium tracking-[0.14em] text-indigo-depth hover:bg-indigo-depth hover:text-surface-pure"
            >
              RESET FILTERS &amp; WINDOW
            </button>
          </div>
        ) : (
          pageItems.map((group) => {
            const vehicle = group.leadVehicle;
            const vType = getType(vehicle.typeId);
            const typeName = vType?.name ?? 'Electric';
            const silhouetteKind = resolveVehicleSilhouetteKind(vehicle.name, typeName);
            const totalScopedStations = group.scopedStationOptions.length;
            const freeStationsCount = group.freeScopedStations.length;
            const fullyReserved = !windowInvalid && !group.isAvailableInScope;
            const firstReservedOpt = group.reservedScopedStations[0];
            const firstConflict = firstReservedOpt?.conflicts[0];
            const isOutOnRide =
              fullyReserved &&
              group.reservedScopedStations.some((o) =>
                o.conflicts.some((c) => c.status === 'Active')
              );

            const stationSummary = group.scopedStationOptions
              .map((o) => o.station.name)
              .join(' · ');

            const maxBattery = Math.max(
              ...group.scopedStationOptions.map((o) => o.unit.batteryPercent)
            );

            const nextUpcomingWhenAllFree =
              !group.hasReservedInScope
                ? group.scopedStationOptions
                    .flatMap((o) =>
                      o.upcoming.map((u) => ({ stationName: o.station.name, res: u }))
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.res.startTime).getTime() - new Date(b.res.startTime).getTime()
                    )[0]
                : undefined;

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
                key={group.key}
                className={`flex flex-col justify-between gap-4 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:p-5 ${
                  fullyReserved
                    ? 'border-status-warn-border bg-surface-pure'
                    : 'border-mist bg-white hover:border-indigo-depth/45'
                }`}
              >
                <div className="flex items-start gap-3.5 sm:items-center sm:gap-5">
                  <div
                    className={`shrink-0 rounded-md border p-2 sm:p-2.5 ${
                      fullyReserved
                        ? 'border-status-warn-border bg-status-warn-bg/60'
                        : 'border-mist bg-paper-white'
                    }`}
                  >
                    <VehicleSilhouette
                      kind={silhouetteKind}
                      className="h-8 w-12 sm:h-10 sm:w-16"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {totalScopedStations === 1 && (
                        <span className="tabular-nums rounded border border-mist bg-paper-white px-2 py-0.5 text-[11px] font-medium text-indigo-depth">
                          {vehicle.code}
                        </span>
                      )}
                      <span className="text-[11px] font-medium tracking-[0.14em] text-dilute-ink">
                        {typeName.toUpperCase()}
                      </span>
                      {!windowInvalid &&
                        (fullyReserved ? (
                          <span className="inline-flex items-center gap-1 rounded border border-status-warn-border bg-status-warn-bg px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-status-warn-text">
                            <Clock className="h-3 w-3 shrink-0" />
                            {isOutOnRide ? 'ACTIVE RIDE' : 'RESERVED'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded border border-status-ok-border bg-status-ok-bg px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-status-ok-text tabular-nums">
                            {totalScopedStations > 1
                              ? `AVAILABLE · ${freeStationsCount} OF ${totalScopedStations} STATIONS`
                              : 'AVAILABLE'}
                          </span>
                        ))}
                    </div>

                    <h2 className="font-display text-xl font-normal text-indigo-depth sm:text-2xl">
                      {vehicle.name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dilute-ink">
                      <span className="inline-flex items-center gap-1.5 font-medium text-indigo-depth">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-depth" strokeWidth={1.6} />
                        <span>{stationSummary}</span>
                      </span>
                      <span className="tabular-nums inline-flex items-center gap-1.5">
                        <BatteryCharging
                          className="h-3.5 w-3.5 shrink-0 text-indigo-depth"
                          strokeWidth={1.6}
                        />
                        {totalScopedStations > 1 ? `Up to ${maxBattery}%` : `${maxBattery}%`} (
                        {vehicle.rangeKm} km)
                      </span>
                      <span className="tabular-nums inline-flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5 shrink-0 text-indigo-depth" strokeWidth={1.6} />
                        {vehicle.maxSpeedKmh} km/h max
                      </span>
                    </div>

                    {fullyReserved && firstConflict && (
                      <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded border border-status-warn-border bg-status-warn-bg px-2.5 py-1 text-xs font-medium text-status-warn-text tabular-nums">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Reserved at {firstReservedOpt.station.name} between{' '}
                          <strong>
                            {formatReservationRange(
                              firstConflict.startTime,
                              firstConflict.endTime
                            )}
                          </strong>
                        </span>
                      </div>
                    )}

                    {!fullyReserved && group.hasReservedInScope && firstConflict && (
                      <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-status-warn-text tabular-nums">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>
                          {firstReservedOpt.station.name} reserved{' '}
                          <strong>
                            {formatReservationRange(
                              firstConflict.startTime,
                              firstConflict.endTime
                            )}
                          </strong>{' '}
                          · Free at {group.freeScopedStations.map((s) => s.station.name).join(', ')}
                        </span>
                      </p>
                    )}

                    {!group.hasReservedInScope && nextUpcomingWhenAllFree && (
                      <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-dilute-ink tabular-nums">
                        <Clock className="h-3 w-3 shrink-0 text-indigo-depth" />
                        <span>
                          {nextUpcomingWhenAllFree.stationName} reserved later:{' '}
                          <strong className="text-indigo-depth">
                            {formatReservationRange(
                              nextUpcomingWhenAllFree.res.startTime,
                              nextUpcomingWhenAllFree.res.endTime
                            )}
                          </strong>
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-3.5 sm:shrink-0 sm:gap-6 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="tabular-nums font-display text-xl font-medium text-indigo-depth sm:text-2xl">
                      {formatMkd(vehicle.hourlyRateMkd)}
                      <span className="text-xs font-normal text-dilute-ink"> / hr</span>
                    </p>
                    <p className="tabular-nums text-xs text-dilute-ink">
                      Full-day cap: {formatMkd(vehicle.fullDayRateMkd)}
                    </p>
                    {est?.valid && !fullyReserved && (
                      <p className="tabular-nums mt-0.5 text-xs font-semibold text-indigo-depth">
                        Est. {formatMkd(est.finalPriceMkd)} ({windowLabel})
                      </p>
                    )}
                  </div>

                  {fullyReserved ? (
                    <div className="flex flex-col items-end gap-1.5 sm:items-end">
                      <span
                        aria-label="Reserved for selected window"
                        className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded border border-status-warn-border bg-status-warn-bg px-3.5 py-2 text-xs font-semibold tracking-[0.12em] text-status-warn-text"
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        RESERVED
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const earliestEnd =
                            firstConflict?.endTime ?? new Date().toISOString();
                          const nextWin = suggestWindowAfterReservation(
                            earliestEnd,
                            activeDurationHours && activeDurationHours <= 24
                              ? activeDurationHours
                              : 2,
                            new Date()
                          );
                          onSelectVehicle(vehicle, {
                            start: nextWin.startLocal,
                            end: nextWin.endLocal,
                          });
                        }}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded border border-mist bg-paper-white px-2.5 py-1 text-[11px] font-medium text-indigo-depth transition-colors hover:border-indigo-depth"
                      >
                        Book other time
                        <ArrowRight className="h-3 w-3 shrink-0" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectVehicle(vehicle)}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded bg-indigo-depth px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-ink-current"
                    >
                      RESERVE
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {filteredGroups.length > PAGE_SIZE && (
        <div className="mt-7 flex flex-col gap-3 border-t border-mist pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="tabular-nums text-xs text-dilute-ink">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filteredGroups.length)} of {filteredGroups.length}{' '}
            models ({statusCounts.available} available)
          </span>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex min-h-[38px] items-center gap-1 rounded border border-mist bg-white px-3 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="tabular-nums px-2 text-xs font-medium text-indigo-depth">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex min-h-[38px] items-center gap-1 rounded border border-mist bg-white px-3 py-1.5 text-xs font-medium text-indigo-depth disabled:opacity-40"
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
