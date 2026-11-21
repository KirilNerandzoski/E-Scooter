import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Gauge,
  MapPin,
} from 'lucide-react';
import type { Reservation, Station, Vehicle, VehicleType } from '../types/rydio';
import { formatMkd, isVehicleAvailable } from '../utils/pricing';

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

const PAGE_SIZE = 4;

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

  const filteredVehicles = useMemo(() => {
    const startIso = new Date(filterStart).toISOString();
    const endIso = new Date(filterEnd).toISOString();

    return vehicles
      .filter((v) => {
        if (v.inMaintenance) return false;
        if (filterTypeId && v.typeId !== filterTypeId) return false;
        if (filterStationId && v.stationId !== filterStationId) return false;
        return isVehicleAvailable(v, reservations, startIso, endIso);
      })
      .sort((a, b) =>
        sortOrder === 'asc'
          ? a.hourlyRateMkd - b.hourlyRateMkd
          : b.hourlyRateMkd - a.hourlyRateMkd
      );
  }, [vehicles, reservations, filterTypeId, filterStationId, filterStart, filterEnd, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredVehicles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getStationName = (id: string) => stations.find((s) => s.id === id)?.name ?? 'Skopje';
  const getTypeName = (id: string) => vehicleTypes.find((t) => t.id === id)?.name ?? 'Electric';

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DDE2E8] pb-6">
        <div>
          <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
            Fleet Catalog &amp; Live Availability
          </h1>
          <p className="mt-2 text-sm text-[#515F73]">
            Showing only vehicles free across your entire selected rental window. Vehicles in
            maintenance are automatically excluded.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="inline-flex items-center gap-2 rounded border border-[#DDE2E8] bg-white px-3.5 py-2 text-xs font-medium tracking-[0.12em] text-[#0A1A33] transition-colors hover:border-[#0A1A33]"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          PRICE: {sortOrder === 'asc' ? 'LOW TO HIGH' : 'HIGH TO LOW'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 grid gap-3 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="cat-type"
            className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
          >
            TYPE
          </label>
          <select
            id="cat-type"
            value={filterTypeId}
            onChange={(e) => {
              onChangeType(e.target.value);
              setPage(1);
            }}
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
            htmlFor="cat-station"
            className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
          >
            STATION
          </label>
          <select
            id="cat-station"
            value={filterStationId}
            onChange={(e) => {
              onChangeStation(e.target.value);
              setPage(1);
            }}
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
            htmlFor="cat-start"
            className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
          >
            START
          </label>
          <input
            id="cat-start"
            type="datetime-local"
            value={filterStart}
            onChange={(e) => {
              onChangeStart(e.target.value);
              setPage(1);
            }}
            className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>

        <div>
          <label
            htmlFor="cat-end"
            className="mb-1 block text-[10px] font-medium tracking-[0.15em] text-[#515F73]"
          >
            END
          </label>
          <input
            id="cat-end"
            type="datetime-local"
            value={filterEnd}
            onChange={(e) => {
              onChangeEnd(e.target.value);
              setPage(1);
            }}
            className="tabular-nums w-full rounded border border-[#DDE2E8] bg-[#F6F7F9] px-3 py-2 text-sm text-[#0A1A33]"
          />
        </div>
      </div>

      {/* Results Ledger */}
      <div className="mt-6 space-y-3">
        {pageItems.length === 0 ? (
          <div className="rounded-lg border border-[#DDE2E8] bg-white p-12 text-center">
            <p className="font-display text-xl text-[#0A1A33]">
              No vehicles available for this period.
            </p>
            <p className="mt-2 text-sm text-[#515F73]">
              Clear a filter or adjust the start/end window to view other rides across Skopje.
            </p>
          </div>
        ) : (
          pageItems.map((vehicle) => (
            <div
              key={vehicle.id}
              className="flex flex-col justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-5 transition-colors hover:border-[#0A1A33]/45 sm:flex-row sm:items-center"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="tabular-nums rounded border border-[#DDE2E8] bg-[#F6F7F9] px-2 py-0.5 text-[11px] font-medium text-[#0A1A33]">
                    {vehicle.code}
                  </span>
                  <span className="text-[11px] font-medium tracking-[0.14em] text-[#515F73]">
                    {getTypeName(vehicle.typeId).toUpperCase()}
                  </span>
                </div>

                <h2 className="font-display text-2xl font-normal text-[#0A1A33]">
                  {vehicle.name}
                </h2>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#515F73]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#0A1A33]" strokeWidth={1.6} />
                    {getStationName(vehicle.stationId)}
                  </span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <BatteryCharging className="h-3.5 w-3.5 text-[#0A1A33]" strokeWidth={1.6} />
                    {vehicle.batteryPercent}% ({vehicle.rangeKm} km)
                  </span>
                  <span className="tabular-nums inline-flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 text-[#0A1A33]" strokeWidth={1.6} />
                    {vehicle.maxSpeedKmh} km/h max
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-6 border-t border-[#DDE2E8] pt-4 sm:border-t-0 sm:pt-0">
                <div className="text-left sm:text-right">
                  <p className="tabular-nums font-display text-2xl font-medium text-[#0A1A33]">
                    {formatMkd(vehicle.hourlyRateMkd)}
                    <span className="text-xs font-normal text-[#515F73]"> / hr</span>
                  </p>
                  <p className="tabular-nums text-xs text-[#515F73]">
                    Full day: {formatMkd(vehicle.fullDayRateMkd)} (-20%)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectVehicle(vehicle)}
                  className="inline-flex items-center gap-2 rounded bg-[#0A1A33] px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-[#1E2D4A]"
                >
                  RESERVE
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredVehicles.length > PAGE_SIZE && (
        <div className="mt-8 flex items-center justify-between border-t border-[#DDE2E8] pt-5">
          <span className="tabular-nums text-xs text-[#515F73]">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filteredVehicles.length)} of {filteredVehicles.length}{' '}
            available vehicles
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded border border-[#DDE2E8] bg-white px-3 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-40"
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
              className="inline-flex items-center gap-1 rounded border border-[#DDE2E8] bg-white px-3 py-1.5 text-xs font-medium text-[#0A1A33] disabled:opacity-40"
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
