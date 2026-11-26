import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BatteryCharging, MapPin, ChevronRight, AlertCircle } from 'lucide-react';
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
import { SuminagashiCanvas } from '../components/SuminagashiCanvas';
import { VehicleSilhouette } from '../components/VehicleSilhouette';
import { resolveVehicleSilhouetteKind } from '../utils/vehicleSilhouette';

interface HomePageProps {
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
  onFindRides: () => void;
  onViewStations: () => void;
  onResetFilters: () => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

const DURATION_PRESETS = [
  { label: 'Now', hours: 2, fromNow: true },
  { label: '2h', hours: 2, fromNow: false },
  { label: '4h', hours: 4, fromNow: false },
  { label: 'Full Day', hours: 24, fromNow: false },
  { label: 'Weekend', hours: 48, fromNow: false },
];

export function HomePage({
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
  onFindRides,
  onViewStations,
  onResetFilters,
  onSelectVehicle,
}: HomePageProps) {
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
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

  const availableVehicles = vehicles.filter((v) => {
    if (v.inMaintenance) return false;
    if (filterTypeId && v.typeId !== filterTypeId) return false;
    if (filterStationId && v.stationId !== filterStationId) return false;
    if (windowInvalid) return false;
    return isVehicleAvailable(v, reservations, startIso, endIso, nowRef);
  });

  const featuredList = [...availableVehicles]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .slice(0, 4);

  const getStationName = (id: string) =>
    stations.find((s) => s.id === id)?.name ?? 'Skopje Center';
  const getType = (id: string) => vehicleTypes.find((t) => t.id === id);

  const applyPreset = (hours: number, fromNow: boolean) => {
    const freshNow = new Date();
    setNowRef(freshNow);
    if (fromNow) {
      const nowStart = new Date(freshNow.getTime() + 2 * 60 * 1000);
      nowStart.setSeconds(0, 0);
      const nextEnd = new Date(nowStart.getTime() + hours * 60 * 60 * 1000);
      onChangeStart(toLocalDateTimeInput(nowStart));
      onChangeEnd(toLocalDateTimeInput(nextEnd));
      return;
    }

    const baseStart = startIso ? new Date(startIso) : new Date(freshNow.getTime() + 60 * 60 * 1000);
    if (!startIso) {
      baseStart.setMinutes(0, 0, 0);
      onChangeStart(toLocalDateTimeInput(baseStart));
    }
    const nextEnd = new Date(baseStart.getTime() + hours * 60 * 60 * 1000);
    onChangeEnd(toLocalDateTimeInput(nextEnd));
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Full-width flowing Suminagashi indigo ink currents reaching the left HOME rail without overlapping text */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] overflow-hidden sm:h-[440px]">
        <SuminagashiCanvas safeZoneRef={heroCopyRef} className="h-full w-full opacity-95" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1120px] px-4 pb-12 pt-6 sm:px-8 sm:pt-10 lg:px-10 lg:pt-14">
        {/* Hero Copy */}
        <div ref={heroCopyRef} className="max-w-2xl">
          <h1 className="font-display text-[2.125rem] font-light leading-[1.1] tracking-[-0.025em] text-indigo-depth sm:text-5xl lg:text-[3.5rem]">
            Move with the current.
            <br />
            Ride Skopje.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-dilute-ink sm:mt-5 sm:text-base">
            Reserve electric scooters and e-bikes by the hour or full day across {stations.length}{' '}
            Skopje stations. Transparent hourly tariffs with an automatic daily rate cap.
          </p>
        </div>

        {/* Working Inline Availability Search Bar */}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!windowInvalid) onFindRides();
          }}
          className="mt-6 rounded-lg border border-mist bg-white/95 p-3.5 shadow-[0_8px_28px_rgba(10,26,51,0.05)] backdrop-blur-[2px] sm:mt-8 sm:p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label
                htmlFor="hero-type"
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
              >
                VEHICLE TYPE
              </label>
              <select
                id="hero-type"
                value={filterTypeId}
                onChange={(e) => onChangeType(e.target.value)}
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
                htmlFor="hero-station"
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
              >
                PICKUP STATION
              </label>
              <select
                id="hero-station"
                value={filterStationId}
                onChange={(e) => onChangeStation(e.target.value)}
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
                htmlFor="hero-start"
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
              >
                START WINDOW
              </label>
              <input
                id="hero-start"
                type="datetime-local"
                min={minStartLocal}
                value={filterStart}
                onChange={(e) => onChangeStart(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth xl:px-2.5 xl:text-[13px]"
              />
            </div>

            <div>
              <label
                htmlFor="hero-end"
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
              >
                RETURN WINDOW
              </label>
              <input
                id="hero-end"
                type="datetime-local"
                min={filterStart || minStartLocal}
                max={maxEndLocal}
                value={filterEnd}
                onChange={(e) => onChangeEnd(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded border border-mist bg-paper-white px-3 py-2 text-sm text-indigo-depth xl:px-2.5 xl:text-[13px]"
              />
            </div>
          </div>

          {windowInvalid && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-status-danger-text/30 bg-status-danger-bg px-3 py-2 text-xs text-status-danger-deep"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
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

          <div className="mt-4 flex flex-col gap-3 border-t border-mist pt-3.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <button
                type="submit"
                disabled={windowInvalid}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded bg-indigo-depth px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-paper-white transition-colors hover:bg-ink-current disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[40px] sm:px-5 sm:tracking-[0.16em]"
              >
                FIND RIDES
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={onViewStations}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded border border-indigo-depth/35 bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-indigo-depth transition-colors hover:border-indigo-depth hover:bg-paper-white sm:min-h-[40px] sm:px-5 sm:tracking-[0.16em]"
              >
                SKOPJE MAP
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:ml-1">
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
            </div>

            <span className="tabular-nums text-xs text-dilute-ink sm:ml-auto">
              {windowInvalid
                ? 'Choose a valid time window'
                : `${availableVehicles.length} ${availableVehicles.length === 1 ? 'vehicle' : 'vehicles'} free for this window`}
            </span>
          </div>
        </form>

        {/* Lower 4-Card Strip (semantic <article> cards with hairline vehicle silhouettes) */}
        <section aria-label="Available rides for your selected window" className="mt-8 sm:mt-10">
          {featuredList.length === 0 ? (
            <div className="rounded-lg border border-mist bg-white p-8 text-center sm:p-10">
              <p className="font-display text-xl text-indigo-depth">
                No free vehicles match this exact filter.
              </p>
              <p className="mt-2 text-sm text-dilute-ink">
                Try widening your station selection or adjusting your pickup window.
              </p>
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-5 min-h-[40px] rounded border border-indigo-depth px-4 py-2 text-xs font-medium tracking-[0.14em] text-indigo-depth hover:bg-indigo-depth hover:text-surface-pure"
              >
                RESET FILTERS &amp; WINDOW
              </button>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {featuredList.map((vehicle, index) => {
                const isLead = index === 0;
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
                    className={`flex min-h-[264px] flex-col justify-between rounded-lg p-4 transition-all duration-200 sm:p-5 ${
                      isLead
                        ? 'indigo-basin-card border border-indigo-depth text-paper-white shadow-[0_12px_30px_rgba(10,26,51,0.18)] hover:-translate-y-0.5'
                        : 'border border-mist bg-white text-indigo-depth hover:-translate-y-0.5 hover:border-indigo-depth/50 hover:shadow-[0_10px_24px_rgba(10,26,51,0.06)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-[10px] font-semibold tracking-[0.12em] ${
                            isLead ? 'text-basin-tint' : 'text-dilute-ink'
                          }`}
                        >
                          {isLead ? 'FEATURED' : typeName.toUpperCase()}
                        </span>
                        <span
                          className={`tabular-nums inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${
                            isLead ? 'text-basin-soft' : 'text-dilute-ink'
                          }`}
                        >
                          <BatteryCharging className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                          {vehicle.batteryPercent}%
                        </span>
                      </div>

                      <div className="mt-3">
                        <VehicleSilhouette
                          kind={silhouetteKind}
                          inverted={isLead}
                          className="h-9 w-16"
                        />
                      </div>

                      <h2
                        className={`mt-2.5 font-display text-[1.0625rem] font-medium leading-snug ${
                          isLead ? 'text-white' : 'text-indigo-depth'
                        }`}
                      >
                        {vehicle.name.replaceAll('-', '\u2011')}
                      </h2>

                      <p
                        className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                          isLead ? 'text-basin-tint' : 'text-dilute-ink'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                        <span className="truncate">{getStationName(vehicle.stationId)}</span>
                      </p>
                    </div>

                    <div
                      className={`mt-4 border-t pt-3.5 ${
                        isLead ? 'border-white/15' : 'border-mist'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="tabular-nums whitespace-nowrap text-sm font-semibold">
                          {formatMkd(vehicle.hourlyRateMkd)}
                          <span
                            className={`text-xs font-normal ${
                              isLead ? 'text-basin-tint' : 'text-dilute-ink'
                            }`}
                          >
                            {' '}
                            / hr
                          </span>
                        </p>
                        <p
                          className={`tabular-nums whitespace-nowrap text-[11px] ${
                            isLead ? 'text-basin-tint' : 'text-dilute-ink'
                          }`}
                        >
                          Day cap {formatMkd(vehicle.fullDayRateMkd)}
                        </p>
                        {est?.valid && (
                          <p
                            className={`tabular-nums whitespace-nowrap pt-0.5 text-[11px] font-medium ${
                              isLead ? 'text-basin-soft' : 'text-indigo-depth'
                            }`}
                          >
                            Est. {formatMkd(est.finalPriceMkd)} ({windowLabel})
                          </p>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span
                          className={`tabular-nums whitespace-nowrap text-[11px] ${
                            isLead ? 'text-basin-tint' : 'text-dilute-ink'
                          }`}
                        >
                          {vehicle.rangeKm} km range
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectVehicle(vehicle)}
                          className={`inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            isLead
                              ? 'bg-white/10 text-white hover:bg-white/20'
                              : 'bg-paper-white text-indigo-depth hover:bg-mist'
                          }`}
                        >
                          Reserve
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {availableVehicles.length > 4 && (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onFindRides}
                className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-medium tracking-[0.12em] text-indigo-depth hover:underline"
              >
                VIEW ALL {availableVehicles.length} FREE VEHICLES
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
