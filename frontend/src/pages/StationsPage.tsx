import { useState } from 'react';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import type { Reservation, Station, Vehicle } from '../types/rydio';
import { formatShortDateTime, isVehicleAvailable, toSafeIso } from '../utils/pricing';
import { SkopjeVardarMap } from '../components/SkopjeVardarMap';

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
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    stations[0]?.id ?? null
  );

  const startIso = toSafeIso(filterStart);
  const endIso = toSafeIso(filterEnd);

  const stationSummaries = stations.map((station) => {
    const stationVehicles = vehicles.filter((v) => v.stationId === station.id);
    const freeCount = stationVehicles.filter((v) =>
      isVehicleAvailable(v, reservations, startIso, endIso)
    ).length;
    return { station, freeCount };
  });

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DDE2E8] pb-6">
        <div>
          <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
            Skopje Docking Stations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#515F73]">
            Pick up your reserved scooter or e-bike at any hub along the Vardar corridor and return
            it to any Skopje station when your ride ends.
          </p>
        </div>
        {startIso && endIso && (
          <div className="tabular-nums inline-flex items-center gap-2 rounded-md border border-[#DDE2E8] bg-white px-3.5 py-2 text-xs text-[#515F73]">
            <Clock className="h-3.5 w-3.5 text-[#0A1A33]" />
            <span>
              Window: <strong className="text-[#0A1A33]">{formatShortDateTime(startIso)}</strong> →{' '}
              <strong className="text-[#0A1A33]">{formatShortDateTime(endIso)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Interactive Skopje / Vardar Corridor Map */}
      <div className="mt-6">
        <SkopjeVardarMap
          items={stationSummaries}
          selectedStationId={selectedStationId}
          onSelectStation={(id) => setSelectedStationId(id)}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stationSummaries.map(({ station, freeCount }) => {
          const isHighlighted = selectedStationId === station.id;
          return (
            <article
              key={station.id}
              tabIndex={0}
              onClick={() => setSelectedStationId(station.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedStationId(station.id);
                }
              }}
              className={`flex cursor-pointer flex-col justify-between rounded-lg border bg-white p-6 transition-colors ${
                isHighlighted
                  ? 'border-[#0A1A33] shadow-[0_8px_24px_rgba(10,26,51,0.08)]'
                  : 'border-[#DDE2E8] hover:border-[#0A1A33]/45'
              }`}
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
                  <span className="text-[#515F73]">Available vehicles</span>
                  <span className="tabular-nums font-semibold text-[#0A1A33]">
                    {freeCount} free · {station.capacity} docks
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBrowseStation(station.id);
                  }}
                  className="mt-4 inline-flex w-full items-center justify-between rounded border border-[#0A1A33]/25 bg-[#F6F7F9] px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-[#0A1A33] transition-colors hover:bg-[#0A1A33] hover:text-white"
                >
                  BROWSE STATION FLEET
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
