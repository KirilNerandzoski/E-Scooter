import { useRef } from 'react';
import { ArrowRight, BatteryCharging, MapPin, ChevronRight, AlertCircle } from 'lucide-react';
import type { Reservation, Station, Vehicle, VehicleType } from '../types/rydio';
import { formatMkd, isVehicleAvailable, toLocalDateTimeInput, toSafeIso } from '../utils/pricing';
import { SuminagashiCanvas } from '../components/SuminagashiCanvas';
import { VehicleSilhouette, resolveVehicleSilhouetteKind } from '../components/VehicleSilhouette';

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
  onSelectVehicle: (vehicle: Vehicle) => void;
}

const DURATION_PRESETS = [
  { label: '2h', hours: 2 },
  { label: '4h', hours: 4 },
  { label: 'Full Day', hours: 24 },
  { label: 'Weekend', hours: 48 },
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
  onSelectVehicle,
}: HomePageProps) {
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const startIso = toSafeIso(filterStart);
  const endIso = toSafeIso(filterEnd);
  const windowInvalid =
    !startIso || !endIso || new Date(endIso).getTime() <= new Date(startIso).getTime();

  const availableVehicles = vehicles.filter((v) => {
    if (v.inMaintenance) return false;
    if (filterTypeId && v.typeId !== filterTypeId) return false;
    if (filterStationId && v.stationId !== filterStationId) return false;
    return isVehicleAvailable(v, reservations, startIso, endIso);
  });

  const featuredList = [...availableVehicles]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .slice(0, 4);

  const getStationName = (id: string) =>
    stations.find((s) => s.id === id)?.name ?? 'Skopje Center';
  const getTypeName = (id: string) =>
    vehicleTypes.find((t) => t.id === id)?.name ?? 'Electric';

  const applyPreset = (hours: number) => {
    const baseStart = startIso ? new Date(startIso) : new Date(Date.now() + 60 * 60 * 1000);
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        <SuminagashiCanvas safeZoneRef={heroCopyRef} className="h-full w-full opacity-95" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1120px] px-6 pb-14 pt-10 sm:px-10 lg:pt-14">
        {/* Hero Copy */}
        <div ref={heroCopyRef} className="max-w-2xl">
          <h1 className="font-display text-4xl font-light leading-[1.1] tracking-[-0.025em] text-[#0A1A33] sm:text-5xl lg:text-[3.5rem]">
            Move with the current.
            <br />
            Ride Skopje.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#515F73]">
            Reserve electric scooters and e-bikes by the hour or full day across six Skopje
            stations. Transparent hourly tariffs with an automatic daily rate cap.
          </p>
        </div>

        {/* Working Inline Availability Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onFindRides();
          }}
          className="mt-8 rounded-lg border border-[#DDE2E8] bg-white/95 p-4 shadow-[0_8px_28px_rgba(10,26,51,0.05)] backdrop-blur-[2px]"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label
                htmlFor="hero-type"
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
              >
                VEHICLE TYPE
              </label>
              <select
                id="hero-type"
                value={filterTypeId}
                onChange={(e) => onChangeType(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
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
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
              >
                PICKUP STATION
              </label>
              <select
                id="hero-station"
                value={filterStationId}
                onChange={(e) => onChangeStation(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
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
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
              >
                START WINDOW
              </label>
              <input
                id="hero-start"
                type="datetime-local"
                value={filterStart}
                onChange={(e) => onChangeStart(e.target.value)}
                className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
            </div>

            <div>
              <label
                htmlFor="hero-end"
                className="mb-1 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
              >
                RETURN WINDOW
              </label>
              <input
                id="hero-end"
                type="datetime-local"
                value={filterEnd}
                onChange={(e) => onChangeEnd(e.target.value)}
                className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
              />
            </div>
          </div>

          {windowInvalid && (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded border border-[#9B2C2C]/30 bg-[#FFF5F5] px-3 py-2 text-xs text-[#822020]"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Select a valid start and return time (return must be after start).</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#DDE2E8] pt-4">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-[#F6F7F9] transition-colors hover:bg-[#1E2D4A]"
            >
              FIND RIDES
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onViewStations}
              className="inline-flex items-center gap-2 rounded border border-[#0A1A33]/35 bg-white px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-[#0A1A33] transition-colors hover:border-[#0A1A33] hover:bg-[#F6F7F9]"
            >
              SKOPJE MAP
            </button>

            <div className="flex flex-wrap items-center gap-1.5 sm:ml-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.hours)}
                  className="rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2.5 py-1 text-[11px] font-medium text-[#515F73] transition-colors hover:border-[#0A1A33] hover:text-[#0A1A33]"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <span className="tabular-nums ml-auto text-xs text-[#515F73]">
              {availableVehicles.length}{' '}
              {availableVehicles.length === 1 ? 'vehicle' : 'vehicles'} free for this window
            </span>
          </div>
        </form>

        {/* Lower 4-Card Strip (semantic <article> cards with hairline vehicle silhouettes) */}
        <section aria-label="Available rides for your selected window" className="mt-10">
          {featuredList.length === 0 ? (
            <div className="rounded-lg border border-[#DDE2E8] bg-white p-10 text-center">
              <p className="font-display text-xl text-[#0A1A33]">
                No free vehicles match this exact filter.
              </p>
              <p className="mt-2 text-sm text-[#515F73]">
                Try widening your station selection or adjusting your pickup window.
              </p>
              <button
                type="button"
                onClick={() => {
                  onChangeType('');
                  onChangeStation('');
                }}
                className="mt-5 rounded border border-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-[#0A1A33] hover:bg-[#0A1A33] hover:text-white"
              >
                RESET FILTERS
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredList.map((vehicle, index) => {
                const isLead = index === 0;
                const typeName = getTypeName(vehicle.typeId);
                const silhouetteKind = resolveVehicleSilhouetteKind(vehicle.name, typeName);

                return (
                  <article
                    key={vehicle.id}
                    className={`flex min-h-[268px] flex-col justify-between rounded-lg p-5 transition-all duration-200 ${
                      isLead
                        ? 'indigo-basin-card border border-[#0A1A33] text-[#F6F7F9] shadow-[0_12px_30px_rgba(10,26,51,0.18)] hover:-translate-y-0.5'
                        : 'border border-[#DDE2E8] bg-white text-[#0A1A33] hover:-translate-y-0.5 hover:border-[#0A1A33]/50 hover:shadow-[0_10px_24px_rgba(10,26,51,0.06)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-medium tracking-[0.12em] ${
                            isLead ? 'text-[#B9CAE3]' : 'text-[#515F73]'
                          }`}
                        >
                          {isLead
                            ? `FEATURED · ${typeName.toUpperCase()}`
                            : typeName.toUpperCase()}
                        </span>
                        <span
                          className={`tabular-nums inline-flex items-center gap-1 text-[11px] font-medium ${
                            isLead ? 'text-[#DCE6F5]' : 'text-[#515F73]'
                          }`}
                        >
                          <BatteryCharging className="h-3.5 w-3.5" strokeWidth={1.6} />
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
                        className={`mt-2.5 font-display text-xl font-medium leading-snug ${
                          isLead ? 'text-white' : 'text-[#0A1A33]'
                        }`}
                      >
                        {vehicle.name}
                      </h2>

                      <p
                        className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                          isLead ? 'text-[#C4D2E8]' : 'text-[#515F73]'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                        {getStationName(vehicle.stationId)}
                      </p>
                    </div>

                    <div
                      className={`mt-5 border-t pt-4 ${
                        isLead ? 'border-white/15' : 'border-[#DDE2E8]'
                      }`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="tabular-nums text-sm font-semibold">
                          {formatMkd(vehicle.hourlyRateMkd)}
                          <span
                            className={`text-xs font-normal ${
                              isLead ? 'text-[#C4D2E8]' : 'text-[#515F73]'
                            }`}
                          >
                            {' '}
                            / hr
                          </span>
                        </span>
                        <span
                          className={`tabular-nums text-[11px] ${
                            isLead ? 'text-[#C4D2E8]' : 'text-[#515F73]'
                          }`}
                        >
                          Cap {formatMkd(vehicle.fullDayRateMkd)}/d
                        </span>
                      </div>

                      <div className="mt-3.5 flex items-center justify-between">
                        <span
                          className={`tabular-nums text-[11px] ${
                            isLead ? 'text-[#B9CAE3]' : 'text-[#515F73]'
                          }`}
                        >
                          {vehicle.rangeKm} km range
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectVehicle(vehicle)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            isLead
                              ? 'text-white hover:bg-white/15'
                              : 'text-[#0A1A33] hover:bg-[#F6F7F9]'
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
        </section>
      </div>
    </div>
  );
}
