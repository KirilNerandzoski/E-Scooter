import { useMemo, useState } from 'react';
import { X, AlertCircle, CheckCircle2, BatteryCharging, MapPin, ArrowRight } from 'lucide-react';
import type { Reservation, Station, UserAccount, Vehicle, VehicleType } from '../types/rydio';
import {
  calculateReservationPrice,
  formatMkd,
  getMaxEndDateTimeLocal,
  getMinStartDateTimeLocal,
  isVehicleAvailable,
  MAX_RENTAL_DAYS,
  toLocalDateTimeInput,
  toSafeIso,
} from '../utils/pricing';
import { Modal } from './Modal';
import { VehicleSilhouette } from './VehicleSilhouette';
import { resolveVehicleSilhouetteKind } from '../utils/vehicleSilhouette';

interface ReservationModalProps {
  vehicle: Vehicle;
  vehicleType?: VehicleType;
  station?: Station;
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
  vehicleType,
  station,
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

  const minStartLocal = useMemo(() => getMinStartDateTimeLocal(nowRef), [nowRef]);
  const maxEndLocal = useMemo(
    () => getMaxEndDateTimeLocal(startTime, nowRef),
    [startTime, nowRef]
  );

  const price = useMemo(
    () =>
      calculateReservationPrice(
        vehicle,
        startTime,
        endTime,
        nowRef,
        vehicleType?.fullDayDiscountPercent ?? 20
      ),
    [vehicle, startTime, endTime, nowRef, vehicleType?.fullDayDiscountPercent]
  );

  const hasConflict = useMemo(() => {
    if (!price.valid) return false;
    return !isVehicleAvailable(
      vehicle,
      reservations,
      toSafeIso(startTime),
      toSafeIso(endTime),
      nowRef
    );
  }, [vehicle, reservations, startTime, endTime, price.valid, nowRef]);

  const canSubmit =
    price.valid && !hasConflict && !vehicle.inMaintenance && Boolean(currentUser) && !submitting;

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

    const startIso = toSafeIso(startTime);
    const baseStart = startIso ? new Date(startIso) : new Date(freshNow.getTime() + 60 * 60 * 1000);
    if (!startIso) {
      baseStart.setMinutes(0, 0, 0);
      setStartTime(toLocalDateTimeInput(baseStart));
    }
    const nextEnd = new Date(baseStart.getTime() + hours * 60 * 60 * 1000);
    setEndTime(toLocalDateTimeInput(nextEnd));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startIso = toSafeIso(startTime);
    const endIso = toSafeIso(endTime);
    if (!canSubmit || !startIso || !endIso) return;
    setSubmitting(true);
    try {
      await onConfirm({
        vehicleId: vehicle.id,
        startTime: startIso,
        endTime: endIso,
        basePriceMkd: price.basePriceMkd,
        discountAppliedMkd: price.discountAppliedMkd,
        totalPriceMkd: price.finalPriceMkd,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const silhouetteKind = resolveVehicleSilhouetteKind(
    vehicle.name,
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
              Reserve {vehicle.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dilute-ink">
              <span className="tabular-nums font-medium text-indigo-depth">{vehicle.code}</span>
              <span>{vehicleType?.name ?? 'Electric'}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {station?.name ?? 'Skopje'}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <BatteryCharging className="h-3.5 w-3.5 shrink-0" />
                {vehicle.batteryPercent}% · {vehicle.rangeKm} km
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
            className="flex items-start gap-2.5 rounded-md border border-status-danger-text/30 bg-status-danger-bg px-3.5 py-3 text-xs text-status-danger-deep"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {!price.valid
                ? price.error
                : 'This vehicle already has an overlapping reservation during the selected window. Choose a different time slot.'}
            </span>
          </div>
        )}

        {/* Transparent Live Receipt */}
        <div className="rounded-md border border-mist bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-dilute-ink">
            <span>Hourly tariff</span>
            <span className="tabular-nums shrink-0 font-medium text-indigo-depth">
              {formatMkd(vehicle.hourlyRateMkd)} / hr
            </span>
          </div>
          <div className="mt-2 flex items-start justify-between gap-3 text-xs text-dilute-ink">
            <span>
              Full-day cap (auto-caps from{' '}
              {Math.max(1, Math.ceil(vehicle.fullDayRateMkd / Math.max(1, vehicle.hourlyRateMkd)))}h
              onward per 24h block)
            </span>
            <span className="tabular-nums shrink-0 font-medium text-indigo-depth">
              {formatMkd(vehicle.fullDayRateMkd)} / day
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
          Free cancellation up to 1 hour before pickup. Pickup opens 30 minutes before start.
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
