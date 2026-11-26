import type { Reservation, Station, Vehicle } from '../types/rydio';
import {
  getOverlappingReservations,
  getUpcomingVehicleReservations,
  isVehicleAvailable,
} from './pricing.ts';

export interface StationUnitOption {
  station: Station;
  /** Preferred unit at this station (available & highest battery first). */
  unit: Vehicle;
  allUnitsAtStation: Vehicle[];
  isAvailable: boolean;
  freeUnitsCount: number;
  conflicts: Reservation[];
  upcoming: Reservation[];
}

export interface GroupedProduct {
  /** Normalized lowercase model name key */
  key: string;
  /** Representative vehicle for title, specs, and pricing */
  leadVehicle: Vehicle;
  /** All non-maintenance units of this model across the entire fleet */
  allUnits: Vehicle[];
  /** Units matching the active station filter (or allUnits when All Stations is selected) */
  scopedUnits: Vehicle[];
  /** Distinct station options across the entire fleet for this model */
  allStationOptions: StationUnitOption[];
  /** Station options within the current station filter scope */
  scopedStationOptions: StationUnitOption[];
  /** Station options that have at least 1 free unit for the selected window */
  freeScopedStations: StationUnitOption[];
  /** Station options where all units at that station are reserved for the selected window */
  reservedScopedStations: StationUnitOption[];
  /** True when at least 1 scoped station has a free unit for the selected window */
  isAvailableInScope: boolean;
  /** True when at least 1 scoped station is fully reserved for the selected window */
  hasReservedInScope: boolean;
  featured: boolean;
}

export function normalizeModelKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Builds per-station pickup options for all physical units of a single product model.
 */
export function buildStationOptionsForModel(
  modelUnits: Vehicle[],
  stations: Station[],
  reservations: Reservation[],
  startIso: string | null,
  endIso: string | null,
  windowInvalid: boolean,
  now: Date = new Date()
): StationUnitOption[] {
  const byStation = new Map<string, Vehicle[]>();
  for (const unit of modelUnits) {
    if (unit.inMaintenance) continue;
    const list = byStation.get(unit.stationId) ?? [];
    list.push(unit);
    byStation.set(unit.stationId, list);
  }

  const options: StationUnitOption[] = [];
  for (const station of stations) {
    const units = byStation.get(station.id);
    if (!units || units.length === 0) continue;

    const evaluated = units.map((u) => {
      const free = !windowInvalid && isVehicleAvailable(u, reservations, startIso, endIso, now);
      const conflicts = !windowInvalid
        ? getOverlappingReservations(u, reservations, startIso, endIso, now)
        : [];
      const upcoming = getUpcomingVehicleReservations(u, reservations, now);
      return { unit: u, free, conflicts, upcoming };
    });

    // Prefer an available unit with the highest battery; otherwise pick the unit whose conflict ends earliest
    evaluated.sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      return b.unit.batteryPercent - a.unit.batteryPercent;
    });

    const best = evaluated[0];
    const freeUnitsCount = evaluated.filter((e) => e.free).length;

    options.push({
      station,
      unit: best.unit,
      allUnitsAtStation: units,
      isAvailable: windowInvalid ? true : freeUnitsCount > 0,
      freeUnitsCount,
      conflicts: best.conflicts,
      upcoming: best.upcoming,
    });
  }

  // Fallback for any unit whose stationId wasn't in stations array
  for (const [stId, units] of byStation.entries()) {
    if (options.some((o) => o.station.id === stId)) continue;
    const u = units[0];
    const conflicts = !windowInvalid
      ? getOverlappingReservations(u, reservations, startIso, endIso, now)
      : [];
    const upcoming = getUpcomingVehicleReservations(u, reservations, now);
    const free = !windowInvalid && conflicts.length === 0;
    options.push({
      station: {
        id: stId,
        code: 'SKP',
        name: 'Skopje Station',
        district: 'Skopje',
        address: 'Skopje',
        capacity: 10,
      },
      unit: u,
      allUnitsAtStation: units,
      isAvailable: windowInvalid ? true : free,
      freeUnitsCount: free ? 1 : 0,
      conflicts,
      upcoming,
    });
  }

  return options;
}

/**
 * Groups fleet vehicles by product model name so identical models across multiple stations
 * appear as a single clean product card with station pickup choices.
 */
export function groupVehiclesByModel(params: {
  vehicles: Vehicle[];
  stations: Station[];
  reservations: Reservation[];
  filterTypeId: string;
  filterStationId: string;
  searchQuery?: string;
  startIso: string | null;
  endIso: string | null;
  windowInvalid: boolean;
  now?: Date;
}): GroupedProduct[] {
  const {
    vehicles,
    stations,
    reservations,
    filterTypeId,
    filterStationId,
    searchQuery = '',
    startIso,
    endIso,
    windowInvalid,
    now = new Date(),
  } = params;

  const q = searchQuery.trim().toLowerCase();
  const buckets = new Map<string, Vehicle[]>();

  for (const v of vehicles) {
    if (v.inMaintenance) continue;
    if (filterTypeId && v.typeId !== filterTypeId) continue;
    const key = normalizeModelKey(v.name);
    const list = buckets.get(key) ?? [];
    list.push(v);
    buckets.set(key, list);
  }

  const results: GroupedProduct[] = [];

  for (const [key, allUnits] of buckets.entries()) {
    const scopedUnits = filterStationId
      ? allUnits.filter((u) => u.stationId === filterStationId)
      : allUnits;

    if (scopedUnits.length === 0) continue;

    if (q) {
      const matchesSearch = scopedUnits.some((u) => {
        const stName = stations.find((s) => s.id === u.stationId)?.name.toLowerCase() ?? '';
        return (
          u.name.toLowerCase().includes(q) ||
          u.code.toLowerCase().includes(q) ||
          stName.includes(q)
        );
      });
      if (!matchesSearch) continue;
    }

    const allStationOptions = buildStationOptionsForModel(
      allUnits,
      stations,
      reservations,
      startIso,
      endIso,
      windowInvalid,
      now
    );

    const scopedStationOptions = filterStationId
      ? allStationOptions.filter((o) => o.station.id === filterStationId)
      : allStationOptions;

    const freeScopedStations = windowInvalid
      ? scopedStationOptions
      : scopedStationOptions.filter((o) => o.isAvailable);
    const reservedScopedStations = windowInvalid
      ? []
      : scopedStationOptions.filter((o) => !o.isAvailable);

    const preferredOption = freeScopedStations[0] ?? scopedStationOptions[0];
    const leadVehicle = preferredOption ? preferredOption.unit : scopedUnits[0];
    const featured = allUnits.some((u) => Boolean(u.featured));

    results.push({
      key,
      leadVehicle,
      allUnits,
      scopedUnits,
      allStationOptions,
      scopedStationOptions,
      freeScopedStations,
      reservedScopedStations,
      isAvailableInScope: freeScopedStations.length > 0,
      hasReservedInScope: reservedScopedStations.length > 0,
      featured,
    });
  }

  return results;
}
