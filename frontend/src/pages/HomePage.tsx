import { ArrowRight, BatteryCharging, MapPin, ChevronRight } from 'lucide-react';
import type { Reservation, Station, Vehicle, VehicleType } from '../types/rydio';
import { formatMkd, isVehicleAvailable } from '../utils/pricing';
import { SuminagashiCanvas } from '../components/SuminagashiCanvas';

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
  const availableVehicles = vehicles.filter((v) => {
    if (v.inMaintenance) return false;
    if (filterTypeId && v.typeId !== filterTypeId) return false;
    if (filterStationId && v.stationId !== filterStationId) return false;
    return isVehicleAvailable(
      v,
      reservations,
      new Date(filterStart).toISOString(),
      new Date(filterEnd).toISOString()
    );
  });

  // Always show up to 4 cards on the hero strip (featured first)
  const featuredList = [...availableVehicles]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .slice(0, 4);

  const getStationName = (id: string) =>
    stations.find((s) => s.id === id)?.name ?? 'Skopje Center';
  const getTypeName = (id: string) =>
    vehicleTypes.find((t) => t.id === id)?.name ?? 'Electric';

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Upper-right flowing Suminagashi indigo ink current */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        <SuminagashiCanvas className="h-full w-full opacity-95" />
        {/* Soft left fade so hero text always keeps crisp paper contrast */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#F6F7F9] via-[#F6F7F9]/65 to-transparent"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1120px] px-6 pb-14 pt-10 sm:px-10 lg:pt-14">
        {/* Hero Copy */}
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-light leading-[1.1] tracking-[-0.025em] text-[#0A1A33] sm:text-5xl lg:text-[3.5rem]">
            Move with the current.
            <br />
            Ride Skopje.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#515F73]">
            Reserve electric scooters and e-bikes by the hour or full day across six Skopje
            stations. Transparent rates, automatic full-day discounts, and instant station pickup.
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
                className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
              >
                VEHICLE TYPE
              </label>
              <select
                id="hero-type"
                value={filterTypeId}
                onChange={(e) => onChangeType(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
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
                className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
              >
                PICKUP STATION
              </label>
              <select
                id="hero-station"
                value={filterStationId}
                onChange={(e) => onChangeStation(e.target.value)}
                className="w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
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
                className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
              >
                START WINDOW
              </label>
              <input
                id="hero-start"
                type="datetime-local"
                value={filterStart}
                onChange={(e) => onChangeStart(e.target.value)}
                className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="hero-end"
                className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
              >
                RETURN WINDOW
              </label>
              <input
                id="hero-end"
                type="datetime-local"
                value={filterEnd}
                onChange={(e) => onChangeEnd(e.target.value)}
                className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
              />
            </div>
          </div>

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
              VIEW STATIONS
            </button>
            <span className="tabular-nums ml-auto text-xs text-[#515F73]">
              {availableVehicles.length}{' '}
              {availableVehicles.length === 1 ? 'vehicle' : 'vehicles'} free for this window
            </span>
          </div>
        </form>

        {/* Lower 4-Card Strip (Option 1 signature: 1st deep indigo, 3 paper-white) */}
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
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => onSelectVehicle(vehicle)}
                    className={`group flex min-h-[252px] flex-col justify-between rounded-lg p-5 text-left transition-all duration-200 ${
                      isLead
                        ? 'indigo-basin-card border border-[#0A1A33] text-[#F6F7F9] shadow-[0_12px_30px_rgba(10,26,51,0.18)] hover:-translate-y-0.5'
                        : 'border border-[#DDE2E8] bg-white text-[#0A1A33] hover:-translate-y-0.5 hover:border-[#0A1A33]/50 hover:shadow-[0_10px_24px_rgba(10,26,51,0.06)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-medium tracking-[0.16em] ${
                            isLead ? 'text-[#B9CAE3]' : 'text-[#515F73]'
                          }`}
                        >
                          {isLead ? 'FEATURED RIDE' : getTypeName(vehicle.typeId).toUpperCase()}
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

                      <h2
                        className={`mt-3 font-display text-2xl font-normal leading-snug ${
                          isLead ? 'text-white' : 'text-[#0A1A33]'
                        }`}
                      >
                        {vehicle.name}
                      </h2>

                      <p
                        className={`mt-2 flex items-center gap-1.5 text-xs ${
                          isLead ? 'text-[#C4D2E8]' : 'text-[#515F73]'
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                        {getStationName(vehicle.stationId)}
                      </p>
                    </div>

                    <div
                      className={`mt-6 border-t pt-4 ${
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
                          {formatMkd(vehicle.fullDayRateMkd)} / day
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span
                          className={`tabular-nums text-[11px] ${
                            isLead ? 'text-[#B9CAE3]' : 'text-[#515F73]'
                          }`}
                        >
                          {vehicle.rangeKm} km range
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium transition-transform group-hover:translate-x-1 ${
                            isLead ? 'text-white' : 'text-[#0A1A33]'
                          }`}
                        >
                          Reserve
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
