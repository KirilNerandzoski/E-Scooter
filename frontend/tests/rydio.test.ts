import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyRevenue,
  calculateLatePenalty,
  calculateReservationPrice,
  canCancelReservation,
  createClientReservationId,
  deriveFullDayRateMkd,
  formatReservationRange,
  getOverlappingReservations,
  getPickupEligibility,
  getUpcomingVehicleReservations,
  isVehicleAvailable,
  suggestWindowAfterReservation,
  validateFilterWindow,
} from '../src/utils/pricing.ts';
import {
  hasPermission,
  isPrimarySuperAdminEmail,
  normalizeUserRole,
  sanitizeUsersRbac,
} from '../src/utils/rbac.ts';
import type { Reservation, Vehicle } from '../src/types/rydio.ts';

const sampleVehicle: Vehicle = {
  id: 'veh-1',
  code: 'RYD-S01',
  name: 'Rydio S1 Pro',
  typeId: 'vt-scooter',
  stationId: 'st-plostad',
  hourlyRateMkd: 180,
  fullDayRateMkd: 950,
  batteryPercent: 95,
  rangeKm: 48,
  maxSpeedKmh: 25,
  inMaintenance: false,
};

test('pricing validates past start, max 7 days, and full-day cap', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  const past = calculateReservationPrice(
    sampleVehicle,
    '2026-11-25T09:40:00Z',
    '2026-11-25T12:00:00Z',
    now
  );
  assert.equal(past.valid, false);

  const tooLong = calculateReservationPrice(
    sampleVehicle,
    '2026-11-25T11:00:00Z',
    '2026-12-03T12:00:00Z',
    now
  );
  assert.equal(tooLong.valid, false);

  const capped = calculateReservationPrice(
    sampleVehicle,
    '2026-11-25T11:00:00Z',
    '2026-11-25T18:00:00Z',
    now
  );
  assert.equal(capped.valid, true);
  assert.equal(capped.basePriceMkd, 7 * 180);
  assert.equal(capped.finalPriceMkd, 950);
  assert.equal(capped.hasFullDayDiscount, true);
});

test('deriveFullDayRateMkd wires VehicleType discount percent into default daily cap', () => {
  assert.equal(deriveFullDayRateMkd(200, 25), 3600);
  assert.equal(deriveFullDayRateMkd(200, 0), 4800);
  assert.equal(deriveFullDayRateMkd(180, 20), 3456);
});

test('pickup eligibility enforces 30-min early window and blocks expired bookings for customers', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  const baseRes: Reservation = {
    id: 'RES-TEST0001',
    vehicleId: 'veh-1',
    customerName: 'Kiril',
    customerEmail: 'kiril@rydio.mk',
    pickupStationId: 'st-plostad',
    startTime: '2026-11-25T13:00:00Z',
    endTime: '2026-11-25T15:00:00Z',
    status: 'Reserved',
    basePriceMkd: 360,
    discountAppliedMkd: 0,
    latePenaltyMkd: 0,
    totalPriceMkd: 360,
    createdAt: '2026-11-25T09:00:00Z',
  };

  // 3h before start -> customer blocked, admin allowed
  assert.equal(getPickupEligibility(baseRes, false, now).canPickUp, false);
  assert.equal(getPickupEligibility(baseRes, true, now).canPickUp, true);

  // 20m before start -> customer allowed
  const nearNow = new Date('2026-11-25T12:40:00Z');
  assert.equal(getPickupEligibility(baseRes, false, nearNow).canPickUp, true);

  // Past endTime -> customer blocked
  const expiredNow = new Date('2026-11-25T15:05:00Z');
  assert.equal(getPickupEligibility(baseRes, false, expiredNow).canPickUp, false);
});

test('1-hour cancellation cutoff and 1.5x late penalty', () => {
  const res: Reservation = {
    id: 'RES-TEST0002',
    vehicleId: 'veh-1',
    customerName: 'Kiril',
    customerEmail: 'kiril@rydio.mk',
    pickupStationId: 'st-plostad',
    startTime: '2026-11-25T12:00:00Z',
    endTime: '2026-11-25T14:00:00Z',
    status: 'Reserved',
    basePriceMkd: 360,
    discountAppliedMkd: 0,
    latePenaltyMkd: 0,
    totalPriceMkd: 360,
    createdAt: '2026-11-25T09:00:00Z',
  };

  assert.equal(canCancelReservation(res, new Date('2026-11-25T10:59:00Z')), true);
  assert.equal(canCancelReservation(res, new Date('2026-11-25T11:01:00Z')), false);

  const late = calculateLatePenalty(
    sampleVehicle,
    '2026-11-25T14:00:00Z',
    new Date('2026-11-25T15:20:00Z')
  );
  assert.equal(late.lateHours, 2);
  assert.equal(late.penaltyMkd, 540);
});

test('availability excludes maintenance and overlapping active/reserved bookings', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  const reservations: Reservation[] = [
    {
      id: 'RES-TEST0003',
      vehicleId: 'veh-1',
      customerName: 'Kiril',
      customerEmail: 'kiril@rydio.mk',
      pickupStationId: 'st-plostad',
      startTime: '2026-11-25T12:00:00Z',
      endTime: '2026-11-25T14:00:00Z',
      status: 'Reserved',
      basePriceMkd: 360,
      discountAppliedMkd: 0,
      latePenaltyMkd: 0,
      totalPriceMkd: 360,
      createdAt: '2026-11-25T09:00:00Z',
    },
  ];

  assert.equal(
    isVehicleAvailable(
      sampleVehicle,
      reservations,
      '2026-11-25T13:00:00Z',
      '2026-11-25T15:00:00Z',
      now
    ),
    false
  );
  assert.equal(
    isVehicleAvailable(
      sampleVehicle,
      reservations,
      '2026-11-25T14:00:00Z',
      '2026-11-25T16:00:00Z',
      now
    ),
    true
  );
  assert.equal(
    isVehicleAvailable(
      { ...sampleVehicle, inMaintenance: true },
      [],
      '2026-11-25T14:00:00Z',
      '2026-11-25T16:00:00Z',
      now
    ),
    false
  );
});

test('buildMonthlyRevenue tracks live lifetime Completed sales with zero predefined baseline & RBAC invariants hold', () => {
  const reservations: Reservation[] = [
    {
      id: 'RES-1',
      vehicleId: null,
      vehicleName: 'Retired Scooter',
      customerName: 'A',
      customerEmail: 'a@example.mk',
      pickupStationId: 'st-plostad',
      startTime: '2027-01-05T10:00:00Z',
      endTime: '2027-01-05T12:00:00Z',
      actualReturnTime: '2027-01-05T12:00:00Z',
      status: 'Completed',
      basePriceMkd: 400,
      discountAppliedMkd: 0,
      latePenaltyMkd: 100,
      totalPriceMkd: 400,
      createdAt: '2027-01-05T09:00:00Z',
    },
    {
      id: 'RES-2',
      vehicleId: 'veh-1',
      customerName: 'B',
      customerEmail: 'b@example.mk',
      pickupStationId: 'st-plostad',
      startTime: '2026-11-10T10:00:00Z',
      endTime: '2026-11-10T12:00:00Z',
      status: 'Active',
      basePriceMkd: 720,
      discountAppliedMkd: 0,
      latePenaltyMkd: 0,
      totalPriceMkd: 720,
      createdAt: '2026-11-10T09:00:00Z',
    },
    {
      id: 'RES-3',
      vehicleId: 'veh-1',
      customerName: 'C',
      customerEmail: 'c@example.mk',
      pickupStationId: 'st-plostad',
      startTime: '2026-12-10T10:00:00Z',
      endTime: '2026-12-10T12:00:00Z',
      status: 'Reserved',
      basePriceMkd: 9000,
      discountAppliedMkd: 0,
      latePenaltyMkd: 0,
      totalPriceMkd: 9000,
      createdAt: '2026-12-01T09:00:00Z',
    },
  ];

  const rev = buildMonthlyRevenue(reservations, new Date('2026-11-25T10:00:00Z'));
  assert.deepEqual(
    rev.map((r) => r.month),
    ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Jan']
  );
  assert.equal(rev.find((r) => r.month === 'Nov')?.revenueMkd, 0);
  assert.equal(rev.find((r) => r.month === 'Jan')?.revenueMkd, 500);
  assert.equal(rev.find((r) => r.month === 'Jan')?.rides, 1);

  // RBAC invariants
  assert.equal(isPrimarySuperAdminEmail('superadmin@rydio.mk'), true);
  assert.equal(normalizeUserRole('other@rydio.mk', 'SuperAdmin'), 'Customer');
  const sanitized = sanitizeUsersRbac([
    {
      id: 'u1',
      name: 'Intruder',
      email: 'intruder@rydio.mk',
      password: 'x',
      role: 'SuperAdmin',
      active: true,
      createdAt: '2026-11-25T00:00:00Z',
    },
  ]);
  assert.equal(sanitized[0].role, 'Customer');
  assert.equal(hasPermission(sanitized[0], 'fleet:manage'), false);

  // Client reservation IDs
  const id = createClientReservationId();
  assert.match(id, /^RES-[0-9A-F]{8}$/);
});

test('validateFilterWindow, custom discount fallback, and simultaneous active pickup guard', () => {
  const now = new Date('2026-11-25T10:00:00Z');

  // Past start (>5m ago) flags canResetToNow
  const pastWin = validateFilterWindow('2026-11-25T09:30:00Z', '2026-11-25T11:30:00Z', now);
  assert.equal(pastWin.valid, false);
  assert.equal(pastWin.canResetToNow, true);

  // Within 5-minute grace window is valid (prevents "Now" preset rejection after 2 minutes)
  const graceWin = validateFilterWindow('2026-11-25T09:57:00Z', '2026-11-25T11:57:00Z', now);
  assert.equal(graceWin.valid, true);

  // > 7 days rejected
  const overMaxWin = validateFilterWindow('2026-11-25T10:00:00Z', '2026-12-04T10:00:00Z', now);
  assert.equal(overMaxWin.valid, false);

  // Vehicle with fullDayRateMkd = 0 derives cap from custom VehicleType discount (25%)
  const zeroCapVeh: Vehicle = { ...sampleVehicle, hourlyRateMkd: 200, fullDayRateMkd: 0 };
  const derivedPrice = calculateReservationPrice(
    zeroCapVeh,
    '2026-11-25T10:00:00Z',
    '2026-11-26T10:00:00Z',
    now,
    25
  );
  assert.equal(derivedPrice.valid, true);
  assert.equal(derivedPrice.finalPriceMkd, 3600);

  // Pickup blocked if another Active unreturned ride still holds the same vehicle
  const activeOut: Reservation = {
    id: 'RES-ACTIVE01',
    vehicleId: 'veh-1',
    customerName: 'Prior Rider',
    customerEmail: 'prior@rydio.mk',
    pickupStationId: 'st-plostad',
    startTime: '2026-11-25T08:00:00Z',
    endTime: '2026-11-25T09:30:00Z',
    status: 'Active',
    basePriceMkd: 360,
    discountAppliedMkd: 0,
    latePenaltyMkd: 0,
    totalPriceMkd: 360,
    createdAt: '2026-11-25T07:00:00Z',
  };
  const nextSlot: Reservation = {
    ...activeOut,
    id: 'RES-NEXT0002',
    status: 'Reserved',
    startTime: '2026-11-25T10:15:00Z',
    endTime: '2026-11-25T12:00:00Z',
  };
  const blockedPickup = getPickupEligibility(nextSlot, false, now, [activeOut, nextSlot]);
  assert.equal(blockedPickup.canPickUp, false);
  assert.match(blockedPickup.reason ?? '', /not yet been returned/i);
});

test('reserved vehicle window helpers surface overlapping and upcoming bookings without hiding fleet items', () => {
  const now = new Date('2026-11-26T18:00:00Z');
  const bookings: Reservation[] = [
    {
      id: 'RES-LATE0001',
      vehicleId: 'veh-1',
      customerName: 'Rider 1',
      customerEmail: 'r1@rydio.mk',
      pickupStationId: 'st-plostad',
      startTime: '2026-11-27T14:00:00Z',
      endTime: '2026-11-27T18:00:00Z',
      status: 'Reserved',
      basePriceMkd: 720,
      discountAppliedMkd: 0,
      latePenaltyMkd: 0,
      totalPriceMkd: 720,
      createdAt: '2026-11-26T17:00:00Z',
    },
    {
      id: 'RES-SOON0002',
      vehicleId: 'veh-1',
      customerName: 'Rider 2',
      customerEmail: 'r2@rydio.mk',
      pickupStationId: 'st-plostad',
      startTime: '2026-11-26T20:00:00Z',
      endTime: '2026-11-26T22:00:00Z',
      status: 'Reserved',
      basePriceMkd: 360,
      discountAppliedMkd: 0,
      latePenaltyMkd: 0,
      totalPriceMkd: 360,
      createdAt: '2026-11-26T17:30:00Z',
    },
  ];

  const overlaps = getOverlappingReservations(
    sampleVehicle,
    bookings,
    '2026-11-26T19:00:00Z',
    '2026-11-26T21:00:00Z',
    now
  );
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].id, 'RES-SOON0002');
  assert.match(formatReservationRange(overlaps[0].startTime, overlaps[0].endTime), /→/);

  const upcoming = getUpcomingVehicleReservations(sampleVehicle, bookings, now);
  assert.deepEqual(
    upcoming.map((r) => r.id),
    ['RES-SOON0002', 'RES-LATE0001']
  );

  const suggested = suggestWindowAfterReservation(overlaps[0].endTime, 2, now);
  assert.equal(new Date(suggested.startLocal) > new Date(overlaps[0].endTime), true);
});
