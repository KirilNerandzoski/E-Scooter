import { ArrowRight, MapPin } from 'lucide-react';
import type { Reservation, Station, Vehicle } from '../types/rydio';
import { isVehicleAvailable } from '../utils/pricing';

interface StationsPageProps {
  stations: Station[];
  vehicles: Vehicle[];
  reservations: Reservation[];
  filterStart: string;
  filterEnd: string;
  onBrowseStation: (stationId: string) => void;
}

export function StationsPage({
  stations,
  vehicles,
  reservations,
  filterStart,
  filterEnd,
  onBrowseStation,
}: StationsPageProps) {
  const startIso = new Date(filterStart).toISOString();
  const endIso = new Date(filterEnd).toISOString();

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10">
      <div className="border-b border-[#DDE2E8] pb-6">
        <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
          Skopje Docking Stations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#515F73]">
          Pick up your reserved scooter or e-bike at any hub and return it to any Skopje station
          when your ride ends.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stations.map((station) => {
          const stationVehicles = vehicles.filter((v) => v.stationId === station.id);
          const freeCount = stationVehicles.filter((v) =>
            isVehicleAvailable(v, reservations, startIso, endIso)
          ).length;

          return (
            <div
              key={station.id}
              className="flex flex-col justify-between rounded-lg border border-[#DDE2E8] bg-white p-6 transition-colors hover:border-[#0A1A33]/45"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="tabular-nums text-[11px] font-medium tracking-[0.16em] text-[#515F73]">
                    {station.code}
                  </span>
                  <span className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-medium text-[#0A1A33]">
                    {station.district}
                  </span>
                </div>

                <h2 className="mt-3 font-display text-2xl font-normal text-[#0A1A33]">
                  {station.name}
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#515F73]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0A1A33]" strokeWidth={1.6} />
                  {station.address}
                </p>
              </div>

              <div className="mt-6 border-t border-[#DDE2E8] pt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[#515F73]">Available for selected window</span>
                  <span className="tabular-nums font-semibold text-[#0A1A33]">
                    {freeCount} / {station.capacity} bays
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onBrowseStation(station.id)}
                  className="mt-4 inline-flex w-full items-center justify-between rounded border border-[#0A1A33]/25 bg-[#F6F7F9] px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-[#0A1A33] transition-colors hover:bg-[#0A1A33] hover:text-white"
                >
                  BROWSE STATION FLEET
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
