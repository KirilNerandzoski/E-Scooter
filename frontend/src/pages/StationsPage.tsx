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
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      <div className="flex flex-col gap-3 border-b border-mist pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4 sm:pb-6">
        <div>
          <h1 className="font-display text-[1.75rem] font-light tracking-[-0.02em] text-indigo-depth sm:text-4xl">
            Skopje Docking Stations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dilute-ink">
            Pick up your reserved scooter or e-bike at any hub along the Vardar corridor and return
            it to any Skopje station when your ride ends.
          </p>
        </div>
        {startIso && endIso && (
          <div className="tabular-nums inline-flex flex-wrap items-center gap-2 self-start rounded-md border border-mist bg-white px-3 py-2 text-xs text-dilute-ink sm:px-3.5 sm:self-auto">
            <Clock className="h-3.5 w-3.5 shrink-0 text-indigo-depth" />
            <span>
              Window: <strong className="text-indigo-depth">{formatShortDateTime(startIso)}</strong> →{' '}
              <strong className="text-indigo-depth">{formatShortDateTime(endIso)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Interactive Skopje / Vardar Corridor Map */}
      <div className="mt-5 sm:mt-6">
        <SkopjeVardarMap
          items={stationSummaries}
          selectedStationId={selectedStationId}
          onSelectStation={(id) => setSelectedStationId(id)}
          onBrowseStation={onBrowseStation}
        />
      </div>

      {/* Semantic Station Cards (zero nested interactive controls — WCAG 4.1.2 compliant) */}
      <div className="mt-6 grid gap-3.5 sm:mt-8 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stationSummaries.map(({ station, freeCount }) => {
          const isHighlighted = selectedStationId === station.id;
          return (
            <article
              key={station.id}
              className={`flex flex-col justify-between rounded-lg border bg-white p-5 transition-colors sm:p-6 ${
                isHighlighted
                  ? 'border-indigo-depth shadow-[0_8px_24px_rgba(10,26,51,0.08)]'
                  : 'border-mist hover:border-indigo-depth/45'
              }`}
            >
              <button
                type="button"
                aria-pressed={isHighlighted}
                onClick={() => setSelectedStationId(station.id)}
                className="w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-depth"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums text-[11px] font-medium tracking-[0.16em] text-dilute-ink">
                    {station.code}
                  </span>
                  <span className="rounded-full bg-paper-white px-2.5 py-0.5 text-[11px] font-medium text-indigo-depth">
                    {station.district}
                  </span>
                </div>

                <h2 className="mt-3 font-display text-xl font-normal text-indigo-depth sm:text-2xl">
                  {station.name}
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-dilute-ink">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-depth" strokeWidth={1.6} />
                  <span>{station.address}</span>
                </p>
              </button>

              <div className="mt-5 border-t border-mist pt-4 sm:mt-6">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-dilute-ink">Available vehicles</span>
                  <span className="tabular-nums font-semibold text-indigo-depth">
                    {freeCount} free · {station.capacity} docks
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onBrowseStation(station.id)}
                  className="mt-4 inline-flex min-h-[42px] w-full items-center justify-between rounded border border-indigo-depth/25 bg-paper-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-indigo-depth transition-colors hover:bg-indigo-depth hover:text-white"
                >
                  BROWSE STATION FLEET
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
