import { useMemo, useState } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  BatteryCharging,
  MapPin,
  ArrowRight,
  Clock,
} from 'lucide-react';
import type { Reservation, Station, UserAccount, Vehicle, VehicleType } from '../types/rydio';
import {
  calculateReservationPrice,
  formatMkd,
  formatReservationRange,
  getMaxEndDateTimeLocal,
  getMinStartDateTimeLocal,
  MAX_RENTAL_DAYS,
  suggestWindowAfterReservation,
  toLocalDateTimeInput,
  toSafeIso,
} from '../utils/pricing';
import { buildStationOptionsForModel, normalizeModelKey } from '../utils/productGroups';
import { Modal } from './Modal';
import { VehicleSilhouette } from './VehicleSilhouette';
import { resolveVehicleSilhouetteKind } from '../utils/vehicleSilhouette';

interface ReservationModalProps {
  vehicle: Vehicle;
  allVehicles: Vehicle[];
  vehicleTypes: VehicleType[];
  stations: Station[];
  preferredStationId?: string;
  initialStart: string;
  initialEnd: string;
  reservations: Reservation[];
  currentUser: UserAccount | null;
  onRequireAuth: (mode: 'login' | 'register') => void;
  onConfirm: (payload: {
    vehicleId: string;
    startTime: string;
    endTime: string;
    basePriceMkd: number;
    discountAppliedMkd: number;
    totalPriceMkd: number;
  }) => Promise<boolean>;
  onClose: () => void;
}

const DURATION_PRESETS = [
  { label: 'Now (2h)', hours: 2, fromNow: true },
  { label: '2h', hours: 2, fromNow: false },
  { label: '4h', hours: 4, fromNow: false },
  { label: 'Full Day', hours: 24, fromNow: false },
  { label: 'Weekend (48h)', hours: 48, fromNow: false },
];

export function ReservationModal({
  vehicle,
  allVehicles,
  vehicleTypes,
  stations,
  preferredStationId,
  initialStart,
  initialEnd,
  reservations,
  currentUser,
  onRequireAuth,
  onConfirm,
  onClose,
}: ReservationModalProps) {
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [submitting, setSubmitting] = useState(false);
  const [nowRef, setNowRef] = useState(() => new Date());

  const modelUnits = useMemo(() => {
    const key = normalizeModelKey(vehicle.name);
    const matching = allVehicles.filter(
      (v) => !v.inMaintenance && normalizeModelKey(v.name) === key
    );
    return matching.length > 0 ? matching : [vehicle];
  }, [allVehicles, vehicle]);

  const startIso = toSafeIso(startTime);
  const endIso = toSafeIso(endTime);
  const windowInvalid =
    !startIso ||
    !endIso ||
    new Date(endIso).getTime() <= new Date(startIso).getTime();

  const stationOptions = useMemo(
    () =>
      buildStationOptionsForModel(
        modelUnits,
        stations,
        reservations,
        startIso,
        endIso,
        windowInvalid,
        nowRef
      ),
    [modelUnits, stations, reservations, startIso, endIso, windowInvalid, nowRef]
  );

  const [selectedStationId, setSelectedStationId] = useState<string>(() => {
    if (preferredStationId && modelUnits.some((u) => u.stationId === preferredStationId)) {
      return preferredStationId;
    }
    return vehicle.stationId;
  });

  const activeStationOption = useMemo(
    () =>
      stationOptions.find((o) => o.station.id === selectedStationId) ?? stationOptions[0],
    [stationOptions, selectedStationId]
  );

  const activeVehicle = activeStationOption?.unit ?? vehicle;
  const activeStation = activeStationOption?.station;
  const vehicleType = useMemo(
    () => vehicleTypes.find((t) => t.id === activeVehicle.typeId),
    [vehicleTypes, activeVehicle.typeId]
  );

  const minStartLocal = useMemo(() => getMinStartDateTimeLocal(nowRef), [nowRef]);
  const maxEndLocal = useMemo(
    () => getMaxEndDateTimeLocal(startTime, nowRef),
    [startTime, nowRef]
  );

  const price = useMemo(
    () =>
      calculateReservationPrice(
        activeVehicle,
        startTime,
        endTime,
        nowRef,
        vehicleType?.fullDayDiscountPercent ?? 20
      ),
    [activeVehicle, startTime, endTime, nowRef, vehicleType?.fullDayDiscountPercent]
  );

  const upcomingBookings = activeStationOption?.upcoming ?? [];
  const conflictingBookings = useMemo(
    () => (price.valid ? (activeStationOption?.conflicts ?? []) : []),
    [price.valid, activeStationOption]
  );
  const hasConflict = conflictingBookings.length > 0;
  const alternativeFreeStation = useMemo(
    () =>
      hasConflict
        ? stationOptions.find((o) => o.station.id !== activeStation?.id && o.isAvailable)
        : undefined,
    [hasConflict, stationOptions, activeStation?.id]
  );

  const canSubmit =
    price.valid &&
    !hasConflict &&
    !activeVehicle.inMaintenance &&
    Boolean(currentUser) &&
    !submitting;

  const applyPreset = (hours: number, fromNow: boolean) => {
    const freshNow = new Date();
    setNowRef(freshNow);
    if (fromNow) {
      const nowStart = new Date(freshNow.getTime() + 2 * 60 * 1000);
      nowStart.setSeconds(0, 0);
      const nextEnd = new Date(nowStart.getTime() + hours * 60 * 60 * 1000);
      setStartTime(toLocalDateTimeInput(nowStart));
      setEndTime(toLocalDateTimeInput(nextEnd));
      return;
    }

    const parsedStart = toSafeIso(startTime);
    const baseStart = parsedStart
      ? new Date(parsedStart)
      : new Date(freshNow.getTime() + 60 * 60 * 1000);
    if (!parsedStart) {
      baseStart.setMinutes(0, 0, 0);
      setStartTime(toLocalDateTimeInput(baseStart));
    }
    const nextEnd = new Date(baseStart.getTime() + hours * 60 * 60 * 1000);
    setEndTime(toLocalDateTimeInput(nextEnd));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sIso = toSafeIso(startTime);
    const eIso = toSafeIso(endTime);
    if (!canSubmit || !sIso || !eIso) return;
    setSubmitting(true);
    try {
      await onConfirm({
        vehicleId: activeVehicle.id,
        startTime: sIso,
        endTime: eIso,
        basePriceMkd: price.basePriceMkd,
        discountAppliedMkd: price.discountAppliedMkd,
        totalPriceMkd: price.finalPriceMkd,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const silhouetteKind = resolveVehicleSilhouetteKind(
    activeVehicle.name,
    vehicleType?.name ?? 'E-Scooter'
  );

  return (
    <Modal labelledBy="reserve-modal-title" maxWidthClass="max-w-xl" onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 rounded-t-lg border-b border-mist bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="hidden rounded-md border border-mist bg-paper-white p-2 sm:block">
            <VehicleSilhouette kind={silhouetteKind} className="h-9 w-14" />
          </div>
          <div className="min-w-0">
            <h2
              id="reserve-modal-title"
              className="font-display text-xl font-normal text-indigo-depth sm:text-2xl"
            >
              Reserve {activeVehicle.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dilute-ink">
              <span className="tabular-nums font-medium text-indigo-depth">
                {activeVehicle.code}
              </span>
              <span>{vehicleType?.name ?? 'Electric'}</span>
              <span className="inline-flex items-center gap-1 font-medium text-indigo-depth">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {activeStation?.name ?? 'Skopje'}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <BatteryCharging className="h-3.5 w-3.5 shrink-0" />
                {activeVehicle.batteryPercent}% · {activeVehicle.rangeKm} km
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reservation dialog"
          className="shrink-0 rounded border border-mist p-1.5 text-dilute-ink transition-colors hover:border-indigo-depth hover:text-indigo-depth"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 p-4 sm:space-y-5 sm:p-6"
      >
        {/* Login Required Notice */}
        {!currentUser && (
          <div className="flex flex-col gap-3 rounded-md border border-indigo-depth/25 bg-white px-4 py-3 text-xs text-indigo-depth sm:flex-row sm:items-center sm:justify-between">
            <span>Sign in or create an account to confirm this reservation.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRequireAuth('login')}
                className="min-h-[38px] flex-1 rounded bg-indigo-depth px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-white hover:bg-ink-current sm:flex-none"
              >
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => onRequireAuth('register')}
                className="min-h-[38px] flex-1 rounded border border-indigo-depth/35 bg-white px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-indigo-depth hover:border-indigo-depth sm:flex-none"
              >
                REGISTER
              </button>
            </div>
          </div>
        )}

        {/* Pickup Station Selector */}
        <div>
          <span className="mb-2 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink">
            CHOOSE PICKUP STATION ({stationOptions.length}{' '}
            {stationOptions.length === 1 ? 'LOCATION' : 'LOCATIONS'})
          </span>
          <div
            role="radiogroup"
            aria-label="Choose pickup station"
            className="grid gap-2 sm:grid-cols-2"
          >
            {stationOptions.map((opt) => {
              const isSelected = opt.station.id === activeStation?.id;
              return (
                <button
                  key={opt.station.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedStationId(opt.station.id)}
                  className={`flex flex-col justify-between gap-1.5 rounded-md border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-indigo-depth bg-indigo-depth text-surface-pure shadow-sm'
                      : opt.isAvailable
                        ? 'border-mist bg-surface-pure text-indigo-depth hover:border-indigo-depth/60'
                        : 'border-status-warn-border bg-status-warn-bg/50 text-indigo-depth hover:border-status-warn-text/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{opt.station.name}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${
                        opt.isAvailable
                          ? isSelected
                            ? 'bg-status-ok-bg text-status-ok-text'
                            : 'border border-status-ok-border bg-status-ok-bg text-status-ok-text'
                          : 'border border-status-warn-border bg-status-warn-bg text-status-warn-text'
                      }`}
                    >
                      {opt.isAvailable ? 'FREE' : 'RESERVED'}
                    </span>
                  </div>
                  <div
                    className={`flex items-center justify-between gap-2 text-[11px] tabular-nums ${
                      isSelected ? 'text-basin-soft' : 'text-dilute-ink'
                    }`}
                  >
                    <span>
                      {opt.unit.code} · {opt.station.district}
                    </span>
                    <span>{opt.unit.batteryPercent}% battery</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Existing Reserved Windows on Selected Station Unit */}
        {upcomingBookings.length > 0 && (
          <div className="rounded-md border border-status-warn-border bg-status-warn-bg px-3.5 py-3 text-xs text-status-warn-text">
            <p className="flex items-center gap-1.5 font-semibold tracking-[0.08em]">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              RESERVED AT {(activeStation?.name ?? 'THIS STATION').toUpperCase()} (
              {activeVehicle.code})
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {upcomingBookings.slice(0, 4).map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 tabular-nums"
                >
                  <span>
                    {b.status === 'Active' ? 'Active ride: ' : 'Reserved: '}
                    <strong>{formatReservationRange(b.startTime, b.endTime)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const freshNow = new Date();
                      setNowRef(freshNow);
                      const next = suggestWindowAfterReservation(b.endTime, 2, freshNow);
                      setStartTime(next.startLocal);
                      setEndTime(next.endLocal);
                    }}
                    className="rounded border border-status-warn-text/30 bg-surface-pure px-2 py-0.5 text-[11px] font-medium text-status-warn-text transition-colors hover:bg-status-warn-text hover:text-surface-pure"
                  >
                    Book after return
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Duration Presets */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="w-full text-[11px] font-medium tracking-[0.12em] text-dilute-ink sm:w-auto">
            QUICK DURATION:
          </span>
          {DURATION_PRESETS.map((preset) => {
            const isSelected = !preset.fromNow && price.valid && price.totalHours === preset.hours;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => applyPreset(preset.hours, preset.fromNow)}
                className={`min-h-[34px] rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-indigo-depth bg-indigo-depth text-surface-pure'
                    : 'border-mist bg-surface-pure text-indigo-depth hover:border-indigo-depth hover:bg-indigo-depth hover:text-surface-pure'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Date/Time Pickers */}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <label
              htmlFor="reserve-start"
              className="mb-1.5 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
            >
              PICKUP DATE &amp; TIME
            </label>
            <input
              id="reserve-start"
              type="datetime-local"
              min={minStartLocal}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="tabular-nums w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
            />
          </div>
          <div>
            <label
              htmlFor="reserve-end"
              className="mb-1.5 block text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
            >
              RETURN DATE &amp; TIME
            </label>
            <input
              id="reserve-end"
              type="datetime-local"
              min={startTime || minStartLocal}
              max={maxEndLocal}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="tabular-nums w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
            />
          </div>
        </div>

        {/* Validation / Conflict Feedback */}
        {(!price.valid || hasConflict) && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-status-danger-text/30 bg-status-danger-bg px-3.5 py-3 text-xs text-status-danger-deep"
          >
            <span className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {!price.valid
                  ? price.error
                  : `Reserved at ${activeStation?.name ?? 'this station'} between ${formatReservationRange(conflictingBookings[0].startTime, conflictingBookings[0].endTime)}. ${
                      alternativeFreeStation
                        ? `Switch to ${alternativeFreeStation.station.name} above or choose another time.`
                        : 'Choose a start/return window outside that period.'
                    }`}
              </span>
            </span>
            {hasConflict && alternativeFreeStation && (
              <button
                type="button"
                onClick={() => setSelectedStationId(alternativeFreeStation.station.id)}
                className="rounded border border-status-danger-deep/35 bg-surface-pure px-2.5 py-1 text-[11px] font-semibold text-status-danger-deep transition-colors hover:bg-status-danger-deep hover:text-surface-pure"
              >
                Use {alternativeFreeStation.station.name}
              </button>
            )}
          </div>
        )}

        {/* Transparent Live Receipt */}
        <div className="rounded-md border border-mist bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-dilute-ink">
            <span>Pickup station</span>
            <span className="shrink-0 font-semibold text-indigo-depth">
              {activeStation?.name ?? 'Skopje'} ({activeVehicle.code})
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-dilute-ink">
            <span>Hourly tariff</span>
            <span className="tabular-nums shrink-0 font-medium text-indigo-depth">
              {formatMkd(activeVehicle.hourlyRateMkd)} / hr
            </span>
          </div>
          <div className="mt-2 flex items-start justify-between gap-3 text-xs text-dilute-ink">
            <span>
              Full-day cap (auto-caps from{' '}
              {Math.max(
                1,
                Math.ceil(
                  activeVehicle.fullDayRateMkd / Math.max(1, activeVehicle.hourlyRateMkd)
                )
              )}
              h onward per 24h block)
            </span>
            <span className="tabular-nums shrink-0 font-medium text-indigo-depth">
              {formatMkd(activeVehicle.fullDayRateMkd)} / day
            </span>
          </div>

          {price.valid && (
            <>
              <div className="my-3 h-px bg-mist" />
              <div className="flex items-center justify-between gap-2 text-xs text-dilute-ink">
                <span>
                  Duration ({price.fullDays > 0 ? `${price.fullDays}d ` : ''}
                  {price.remainingHours}h · {price.totalHours}h total)
                </span>
                <span className="tabular-nums shrink-0 text-indigo-depth">
                  {formatMkd(price.basePriceMkd)}
                </span>
              </div>

              {price.hasFullDayDiscount && (
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-indigo-depth">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-indigo-depth" />
                    Full-day rate cap applied
                  </span>
                  <span className="tabular-nums shrink-0 font-semibold">
                    −{formatMkd(price.discountAppliedMkd)}
                  </span>
                </div>
              )}

              <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-mist pt-3">
                <span className="text-xs font-medium tracking-[0.14em] text-dilute-ink">
                  ESTIMATED TOTAL
                </span>
                <span className="tabular-nums font-display text-xl font-medium text-indigo-depth sm:text-2xl">
                  {formatMkd(price.finalPriceMkd)}
                </span>
              </div>
            </>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-dilute-ink">
          Free cancellation up to 1 hour before pickup. Pickup opens 30 minutes before start at{' '}
          <strong className="text-indigo-depth">{activeStation?.name ?? 'your station'}</strong>.
          Maximum duration {MAX_RENTAL_DAYS} days. Late returns incur a 1.5× hourly tariff penalty.
        </p>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded border border-mist bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-dilute-ink transition-colors hover:border-indigo-depth hover:text-indigo-depth"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded bg-indigo-depth px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-ink-current disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? 'CONFIRMING...' : 'CONFIRM RESERVATION'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
