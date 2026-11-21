import { useMemo, useState } from 'react';
import { X, AlertCircle, CheckCircle2, BatteryCharging, MapPin, ArrowRight } from 'lucide-react';
import type { Reservation, Station, UserAccount, Vehicle, VehicleType } from '../types/rydio';
import {
  calculateReservationPrice,
  formatMkd,
  isVehicleAvailable,
  MAX_RENTAL_DAYS,
} from '../utils/pricing';

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
  }) => void;
  onClose: () => void;
}

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

  const price = useMemo(
    () => calculateReservationPrice(vehicle, startTime, endTime),
    [vehicle, startTime, endTime]
  );

  const hasConflict = useMemo(() => {
    if (!price.valid) return false;
    return !isVehicleAvailable(
      vehicle,
      reservations,
      new Date(startTime).toISOString(),
      new Date(endTime).toISOString()
    );
  }, [vehicle, reservations, startTime, endTime, price.valid]);

  const canSubmit = price.valid && !hasConflict && !vehicle.inMaintenance && Boolean(currentUser);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      vehicleId: vehicle.id,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      basePriceMkd: price.basePriceMkd,
      discountAppliedMkd: price.discountAppliedMkd,
      totalPriceMkd: price.finalPriceMkd,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1A33]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-xl rounded-lg border border-[#DDE2E8] bg-[#F6F7F9] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between rounded-t-lg border-b border-[#DDE2E8] bg-white px-6 py-5">
          <div>
            <h2
              id="reserve-modal-title"
              className="font-display text-2xl font-normal text-[#0A1A33]"
            >
              Reserve {vehicle.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#515F73]">
              <span className="tabular-nums font-medium text-[#0A1A33]">{vehicle.code}</span>
              <span>{vehicleType?.name ?? 'Electric'}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {station?.name ?? 'Skopje'}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <BatteryCharging className="h-3.5 w-3.5" />
                {vehicle.batteryPercent}% · {vehicle.rangeKm} km
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reservation dialog"
            className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] transition-colors hover:border-[#0A1A33] hover:text-[#0A1A33]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Login Required Notice */}
          {!currentUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#0A1A33]/25 bg-white px-4 py-3 text-xs text-[#0A1A33]">
              <span>An account is required to confirm a reservation.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRequireAuth('login')}
                  className="rounded bg-[#0A1A33] px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-white hover:bg-[#1E2D4A]"
                >
                  SIGN IN
                </button>
                <button
                  type="button"
                  onClick={() => onRequireAuth('register')}
                  className="rounded border border-[#0A1A33]/35 bg-white px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-[#0A1A33] hover:border-[#0A1A33]"
                >
                  REGISTER
                </button>
              </div>
            </div>
          )}

          {/* Date/Time Pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reserve-start"
                className="mb-1.5 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
              >
                PICKUP DATE &amp; TIME
              </label>
              <input
                id="reserve-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="tabular-nums w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="reserve-end"
                className="mb-1.5 block text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
              >
                RETURN DATE &amp; TIME
              </label>
              <input
                id="reserve-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="tabular-nums w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33] focus:border-[#0A1A33] focus:outline-none"
              />
            </div>
          </div>

          {/* Validation / Conflict Feedback */}
          {(!price.valid || hasConflict) && (
            <div className="flex items-start gap-2.5 rounded-md border border-[#9B2C2C]/30 bg-[#FFF5F5] px-4 py-3 text-xs text-[#822020]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {!price.valid
                  ? price.error
                  : 'This vehicle already has an overlapping reservation during the selected window. Choose a different time slot.'}
              </span>
            </div>
          )}

          {/* Transparent Live Receipt */}
          <div className="rounded-md border border-[#DDE2E8] bg-white p-4">
            <div className="flex items-center justify-between text-xs text-[#515F73]">
              <span>Hourly tariff</span>
              <span className="tabular-nums font-medium text-[#0A1A33]">
                {formatMkd(vehicle.hourlyRateMkd)} / hr
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-[#515F73]">
              <span>Full-day capped rate (24h)</span>
              <span className="tabular-nums font-medium text-[#0A1A33]">
                {formatMkd(vehicle.fullDayRateMkd)} / day
              </span>
            </div>

            {price.valid && (
              <>
                <div className="my-3 h-px bg-[#DDE2E8]" />
                <div className="flex items-center justify-between text-xs text-[#515F73]">
                  <span>
                    Duration ({price.fullDays > 0 ? `${price.fullDays}d ` : ''}
                    {price.remainingHours}h · {price.totalHours}h total)
                  </span>
                  <span className="tabular-nums text-[#0A1A33]">
                    {formatMkd(price.basePriceMkd)}
                  </span>
                </div>

                {price.hasFullDayDiscount && (
                  <div className="mt-2 flex items-center justify-between text-xs text-[#0A1A33]">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#0A1A33]" />
                      Full-day discount applied
                    </span>
                    <span className="tabular-nums font-semibold">
                      −{formatMkd(price.discountAppliedMkd)}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-baseline justify-between border-t border-[#DDE2E8] pt-3">
                  <span className="text-xs font-medium tracking-[0.14em] text-[#515F73]">
                    ESTIMATED TOTAL
                  </span>
                  <span className="tabular-nums font-display text-2xl font-medium text-[#0A1A33]">
                    {formatMkd(price.finalPriceMkd)}
                  </span>
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[#515F73]">
            Free cancellation up to 1 hour before pickup. Maximum duration {MAX_RENTAL_DAYS} days.
            Late returns incur a 1.5× hourly tariff penalty.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#DDE2E8] bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-[#515F73] transition-colors hover:border-[#0A1A33] hover:text-[#0A1A33]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-[#1E2D4A] disabled:cursor-not-allowed disabled:opacity-45"
            >
              CONFIRM RESERVATION
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
