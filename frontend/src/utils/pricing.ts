import type {
  MonthlyRevenuePoint,
  PriceBreakdown,
  Reservation,
  Vehicle,
} from '../types/rydio';

export const MAX_RENTAL_DAYS = 7;
export const MAX_RENTAL_HOURS = MAX_RENTAL_DAYS * 24;
export const LATE_PENALTY_MULTIPLIER = 1.5;
export const CANCEL_CUTOFF_HOURS = 1;
export const PICKUP_EARLY_WINDOW_MINUTES = 30;

/**
 * Generates a collision-safe uppercase hexadecimal reservation ID matching backend RES-XXXXXXXX format.
 */
export function createClientReservationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    return `RES-${hex}`;
  }
  return `RES-${Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

/**
 * Computes the default full-day rate cap from a vehicle's hourly tariff and its VehicleType's full-day discount percentage.
 */
export function deriveFullDayRateMkd(
  hourlyRateMkd: number,
  fullDayDiscountPercent: number = 20
): number {
  const safeHourly = Math.max(50, Number.isFinite(hourlyRateMkd) ? hourlyRateMkd : 180);
  const clampedDiscount = Math.min(90, Math.max(0, fullDayDiscountPercent));
  const derived = Math.round((safeHourly * 24 * (100 - clampedDiscount)) / 100);
  return Math.max(safeHourly, derived);
}

/**
 * Checks whether [startA, endA) overlaps with [startB, endB).
 */
export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Safely converts a date string (such as a datetime-local value) to an ISO string,
 * returning null instead of throwing RangeError if empty or invalid.
 */
export function toSafeIso(value: string): string | null {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Human-readable duration label for a selected start/end window.
 */
export function formatWindowDuration(startValue: string, endValue: string): string {
  const startIso = toSafeIso(startValue);
  const endIso = toSafeIso(endValue);
  if (!startIso || !endIso) return 'Invalid';
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (diffMs <= 0) return 'Invalid';
  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  return `${totalHours}h`;
}

/**
 * Checks if a vehicle is available (not in maintenance, valid start < end window,
 * and has no overlapping Reserved/Active reservation).
 */
export function isVehicleAvailable(
  vehicle: Vehicle,
  reservations: Reservation[],
  startIso: string | null,
  endIso: string | null,
  now: Date = new Date()
): boolean {
  if (vehicle.inMaintenance) return false;
  if (!startIso || !endIso) return false;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return false;
  }

  const nowMs = now.getTime();
  return !reservations.some((res) => {
    if (!res.vehicleId || res.vehicleId !== vehicle.id) return false;
    if (res.status === 'Cancelled' || res.status === 'Completed') return false;
    const resStartMs = new Date(res.startTime).getTime();
    const resEndMs = new Date(res.endTime).getTime();
    if (res.status === 'Active') {
      const effectiveStart = new Date(Math.min(resStartMs, nowMs));
      const effectiveEnd = new Date(Math.max(resEndMs, nowMs + 60 * 60 * 1000));
      return rangesOverlap(start, end, effectiveStart, effectiveEnd);
    }
    return rangesOverlap(start, end, new Date(resStartMs), new Date(resEndMs));
  });
}

/**
 * Validates a catalog/home search window for well-formed timestamps, non-past start (5-min grace),
 * positive duration, and maximum 7-day cap.
 */
export function validateFilterWindow(
  startValue: string,
  endValue: string,
  now: Date = new Date()
): { valid: boolean; error?: string; canResetToNow?: boolean } {
  const startIso = toSafeIso(startValue);
  const endIso = toSafeIso(endValue);
  if (!startIso || !endIso) {
    return { valid: false, error: 'Select both a valid start and return date/time.' };
  }
  const start = new Date(startIso);
  const end = new Date(endIso);
  const graceNow = new Date(now.getTime() - 5 * 60 * 1000);
  if (start < graceNow) {
    return {
      valid: false,
      error: 'Start time is in the past — tap Now to refresh your pickup window.',
      canResetToNow: true,
    };
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    return {
      valid: false,
      error: 'Select a valid start and return time (return must be after start).',
    };
  }
  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (totalHours > MAX_RENTAL_HOURS) {
    return {
      valid: false,
      error: `Maximum rental duration is ${MAX_RENTAL_DAYS} days (${MAX_RENTAL_HOURS} hours).`,
    };
  }
  return { valid: true };
}

/**
 * Validates booking window (no past start, end > start, max 7 days) and calculates price with automatic full-day discount.
 */
export function calculateReservationPrice(
  vehicle: Vehicle,
  startIso: string,
  endIso: string,
  now: Date = new Date(),
  fullDayDiscountPercent: number = 20
): PriceBreakdown {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      valid: false,
      error: 'Select both a valid start and end date/time.',
      totalHours: 0,
      fullDays: 0,
      remainingHours: 0,
      basePriceMkd: 0,
      discountAppliedMkd: 0,
      finalPriceMkd: 0,
      hasFullDayDiscount: false,
    };
  }

  // Allow 5-minute grace window for immediate "now" booking
  const graceNow = new Date(now.getTime() - 5 * 60 * 1000);
  if (start < graceNow) {
    return {
      valid: false,
      error: 'Start time cannot be in the past.',
      totalHours: 0,
      fullDays: 0,
      remainingHours: 0,
      basePriceMkd: 0,
      discountAppliedMkd: 0,
      finalPriceMkd: 0,
      hasFullDayDiscount: false,
    };
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    return {
      valid: false,
      error: 'End time must be after start time.',
      totalHours: 0,
      fullDays: 0,
      remainingHours: 0,
      basePriceMkd: 0,
      discountAppliedMkd: 0,
      finalPriceMkd: 0,
      hasFullDayDiscount: false,
    };
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (totalHours > MAX_RENTAL_HOURS) {
    return {
      valid: false,
      error: `Maximum rental duration is ${MAX_RENTAL_DAYS} days (${MAX_RENTAL_HOURS} hours).`,
      totalHours,
      fullDays: Math.floor(totalHours / 24),
      remainingHours: totalHours % 24,
      basePriceMkd: 0,
      discountAppliedMkd: 0,
      finalPriceMkd: 0,
      hasFullDayDiscount: false,
    };
  }

  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  const undiscountedTotal = totalHours * vehicle.hourlyRateMkd;
  const fullDayCap =
    vehicle.fullDayRateMkd > 0
      ? vehicle.fullDayRateMkd
      : deriveFullDayRateMkd(vehicle.hourlyRateMkd, fullDayDiscountPercent);

  let discountedTotal = fullDays * fullDayCap;
  if (remainingHours > 0) {
    const remainingHourlyCost = remainingHours * vehicle.hourlyRateMkd;
    discountedTotal += Math.min(remainingHourlyCost, fullDayCap);
  }

  const discountAppliedMkd = Math.max(0, undiscountedTotal - discountedTotal);

  return {
    valid: true,
    totalHours,
    fullDays,
    remainingHours,
    basePriceMkd: undiscountedTotal,
    discountAppliedMkd,
    finalPriceMkd: discountedTotal,
    hasFullDayDiscount: discountAppliedMkd > 0,
  };
}

/**
 * Calculates late return penalty (1.5x hourly rate per overdue hour, rounded up).
 */
export function calculateLatePenalty(
  vehicle: Vehicle,
  bookedEndIso: string,
  actualReturn: Date
): { lateHours: number; penaltyMkd: number } {
  const bookedEnd = new Date(bookedEndIso);
  const overdueMs = actualReturn.getTime() - bookedEnd.getTime();
  if (overdueMs <= 0) {
    return { lateHours: 0, penaltyMkd: 0 };
  }
  const lateHours = Math.ceil(overdueMs / (1000 * 60 * 60));
  const penaltyMkd = Math.round(lateHours * vehicle.hourlyRateMkd * LATE_PENALTY_MULTIPLIER);
  return { lateHours, penaltyMkd };
}

/**
 * Pickup window guard: customers can pick up a Reserved booking starting 30 minutes before startTime
 * and before endTime (Admin/SuperAdmin may override).
 */
export function getPickupEligibility(
  reservation: Reservation,
  isAdminOverride: boolean = false,
  now: Date = new Date(),
  allReservations?: Reservation[]
): { canPickUp: boolean; reason?: string } {
  if (reservation.status !== 'Reserved') {
    return { canPickUp: false, reason: 'Only reserved bookings can be picked up.' };
  }
  if (!reservation.vehicleId) {
    return { canPickUp: false, reason: 'Assigned vehicle is no longer in the fleet.' };
  }
  if (
    allReservations?.some(
      (r) =>
        r.id !== reservation.id &&
        r.vehicleId === reservation.vehicleId &&
        r.status === 'Active'
    )
  ) {
    return {
      canPickUp: false,
      reason: 'This vehicle has not yet been returned from a prior active ride.',
    };
  }
  if (isAdminOverride) {
    return { canPickUp: true };
  }
  const startMs = new Date(reservation.startTime).getTime();
  const endMs = new Date(reservation.endTime).getTime();
  const nowMs = now.getTime();
  const earliestMs = startMs - PICKUP_EARLY_WINDOW_MINUTES * 60 * 1000;

  if (nowMs >= endMs) {
    return {
      canPickUp: false,
      reason: 'Reservation window has already ended.',
    };
  }
  if (nowMs < earliestMs) {
    return {
      canPickUp: false,
      reason: `Pickup opens ${PICKUP_EARLY_WINDOW_MINUTES} min before start (${formatShortDateTime(new Date(earliestMs).toISOString())}).`,
    };
  }
  return { canPickUp: true };
}

/**
 * Cancellation is permitted only up to 1 hour before reservation start.
 */
export function canCancelReservation(reservation: Reservation, now: Date = new Date()): boolean {
  if (reservation.status !== 'Reserved') return false;
  const start = new Date(reservation.startTime);
  const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours >= CANCEL_CUTOFF_HOURS;
}

/**
 * Aggregates live lifetime monthly sales strictly from Completed reservations across all users
 * (no predefined numbers). Initializes a rolling 6-month window ending at referenceNow with 0 MKD
 * and includes any additional lifetime months that have completed sales, ordered chronologically.
 */
export function buildMonthlyRevenue(
  reservations: Reservation[],
  referenceNow: Date = new Date()
): MonthlyRevenuePoint[] {
  const refYear = referenceNow.getUTCFullYear();
  const refMonthIdx = referenceNow.getUTCMonth();

  const map = new Map<
    number,
    { year: number; monthNum: number; rawLabel: string; revenueMkd: number; rides: number }
  >();

  for (let offset = -5; offset <= 0; offset++) {
    const mDate = new Date(Date.UTC(refYear, refMonthIdx + offset, 1));
    const year = mDate.getUTCFullYear();
    const monthNum = mDate.getUTCMonth() + 1;
    const ym = year * 100 + monthNum;
    const shortLabel = mDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    map.set(ym, {
      year,
      monthNum,
      rawLabel: shortLabel,
      revenueMkd: 0,
      rides: 0,
    });
  }

  reservations.forEach((r) => {
    if (r.status !== 'Completed') return;
    const d = new Date(r.actualReturnTime ?? r.endTime);
    if (Number.isNaN(d.getTime())) return;
    const year = d.getUTCFullYear();
    const monthNum = d.getUTCMonth() + 1;
    const ym = year * 100 + monthNum;
    const shortLabel = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const earned = r.totalPriceMkd + r.latePenaltyMkd;

    const existing = map.get(ym);
    if (existing) {
      existing.revenueMkd += earned;
      existing.rides += 1;
    } else {
      map.set(ym, {
        year,
        monthNum,
        rawLabel: shortLabel,
        revenueMkd: earned,
        rides: 1,
      });
    }
  });

  const sortedEntries = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  const labelCounts = new Map<string, number>();
  sortedEntries.forEach(([, v]) => {
    const key = v.rawLabel.toLowerCase();
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  });

  return sortedEntries.map(([ym, v]) => {
    const hasDuplicate = (labelCounts.get(v.rawLabel.toLowerCase()) ?? 0) > 1;
    return {
      month: hasDuplicate
        ? `${v.rawLabel} '${String(v.year % 100).padStart(2, '0')}`
        : v.rawLabel,
      sortOrder: ym,
      revenueMkd: v.revenueMkd,
      rides: v.rides,
    };
  });
}

export function formatMkd(amount: number): string {
  return `${amount.toLocaleString('en-US')} MKD`;
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getMinStartDateTimeLocal(now: Date = new Date()): string {
  return toLocalDateTimeInput(now);
}

export function getMaxEndDateTimeLocal(startLocal: string, now: Date = new Date()): string {
  const startIso = toSafeIso(startLocal);
  const base = startIso ? new Date(startIso) : now;
  return toLocalDateTimeInput(new Date(base.getTime() + MAX_RENTAL_HOURS * 60 * 60 * 1000));
}

export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
