import type { PriceBreakdown, Reservation, Vehicle } from '../types/rydio';

export const MAX_RENTAL_DAYS = 7;
export const MAX_RENTAL_HOURS = MAX_RENTAL_DAYS * 24;
export const LATE_PENALTY_MULTIPLIER = 1.5;
export const CANCEL_CUTOFF_HOURS = 1;

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
 * Checks if a vehicle is available (not in maintenance and has no overlapping Reserved/Active reservation).
 */
export function isVehicleAvailable(
  vehicle: Vehicle,
  reservations: Reservation[],
  startIso: string | null,
  endIso: string | null
): boolean {
  if (vehicle.inMaintenance) return false;
  if (!startIso || !endIso) return true;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return true;
  }

  return !reservations.some((res) => {
    if (res.vehicleId !== vehicle.id) return false;
    if (res.status === 'Cancelled' || res.status === 'Completed') return false;
    return rangesOverlap(start, end, new Date(res.startTime), new Date(res.endTime));
  });
}

/**
 * Validates booking window (no past start, end > start, max 7 days) and calculates price with automatic full-day discount.
 */
export function calculateReservationPrice(
  vehicle: Vehicle,
  startIso: string,
  endIso: string,
  now: Date = new Date()
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

  // Full-day pricing: each 24h block uses vehicle.fullDayRateMkd; if remaining hours >= 8, cap at fullDayRateMkd
  let discountedTotal = fullDays * vehicle.fullDayRateMkd;
  if (remainingHours > 0) {
    const remainingHourlyCost = remainingHours * vehicle.hourlyRateMkd;
    discountedTotal += Math.min(remainingHourlyCost, vehicle.fullDayRateMkd);
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
 * Cancellation is permitted only up to 1 hour before reservation start.
 */
export function canCancelReservation(reservation: Reservation, now: Date = new Date()): boolean {
  if (reservation.status !== 'Reserved') return false;
  const start = new Date(reservation.startTime);
  const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours >= CANCEL_CUTOFF_HOURS;
}

export function formatMkd(amount: number): string {
  return `${amount.toLocaleString('en-US')} MKD`;
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
