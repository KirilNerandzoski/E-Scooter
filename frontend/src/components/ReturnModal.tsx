import { useMemo, useState } from 'react';
import { X, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Reservation, Station, Vehicle } from '../types/rydio';
import { calculateLatePenalty, formatMkd, formatShortDateTime } from '../utils/pricing';
import { Modal } from './Modal';

export interface ReturnSettlementResult {
  ok: boolean;
  latePenaltyMkd?: number;
  totalPriceMkd?: number;
}

interface ReturnModalProps {
  reservation: Reservation;
  vehicle: Vehicle;
  stations: Station[];
  canSimulateLateReturn: boolean;
  onConfirmReturn: (payload: {
    reservationId: string;
    returnStationId: string;
    actualReturnTime?: string;
    latePenaltyMkd: number;
  }) => Promise<ReturnSettlementResult>;
  onClose: () => void;
}

export function ReturnModal({
  reservation,
  vehicle,
  stations,
  canSimulateLateReturn,
  onConfirmReturn,
  onClose,
}: ReturnModalProps) {
  const [returnStationId, setReturnStationId] = useState(reservation.pickupStationId);
  const [simulateLateHours, setSimulateLateHours] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [settledReceipt, setSettledReceipt] = useState<{
    stationName: string;
    baseMkd: number;
    penaltyMkd: number;
    totalMkd: number;
  } | null>(null);

  const [openedAt] = useState(() => new Date());

  const effectiveReturnDate = useMemo(() => {
    if (canSimulateLateReturn && simulateLateHours > 0) {
      const bookedEnd = new Date(reservation.endTime);
      const laterOfNowOrEnd = bookedEnd > openedAt ? bookedEnd : openedAt;
      return new Date(laterOfNowOrEnd.getTime() + simulateLateHours * 60 * 60 * 1000);
    }
    return openedAt;
  }, [canSimulateLateReturn, openedAt, reservation.endTime, simulateLateHours]);

  const { lateHours, penaltyMkd } = useMemo(
    () => calculateLatePenalty(vehicle, reservation.endTime, effectiveReturnDate),
    [vehicle, reservation.endTime, effectiveReturnDate]
  );

  const finalTotal = reservation.totalPriceMkd + penaltyMkd;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const stationName = stations.find((s) => s.id === returnStationId)?.name ?? 'Skopje Station';
      const result = await onConfirmReturn({
        reservationId: reservation.id,
        returnStationId,
        actualReturnTime:
          canSimulateLateReturn && simulateLateHours > 0
            ? effectiveReturnDate.toISOString()
            : undefined,
        latePenaltyMkd: penaltyMkd,
      });
      if (result.ok) {
        const settledBase = result.totalPriceMkd ?? reservation.totalPriceMkd;
        const settledPenalty = result.latePenaltyMkd ?? penaltyMkd;
        setSettledReceipt({
          stationName,
          baseMkd: settledBase,
          penaltyMkd: settledPenalty,
          totalMkd: settledBase + settledPenalty,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal labelledBy="return-modal-title" maxWidthClass="max-w-lg" onClose={onClose}>
      <div className="flex items-start justify-between gap-3 rounded-t-lg border-b border-mist bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <h2
            id="return-modal-title"
            className="font-display text-xl font-normal text-indigo-depth sm:text-2xl"
          >
            {settledReceipt ? 'Ride Completed' : `Return ${vehicle.name}`}
          </h2>
          <p className="mt-1 text-xs text-dilute-ink">
            Booking {reservation.id} · Booked end {formatShortDateTime(reservation.endTime)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close return dialog"
          className="shrink-0 rounded border border-mist p-1.5 text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {settledReceipt ? (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex items-start gap-3 rounded-md border border-indigo-depth/20 bg-white p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-depth" />
            <div>
              <p className="text-sm font-medium text-indigo-depth">
                Dock locked at {settledReceipt.stationName}
              </p>
              <p className="mt-1 text-xs text-dilute-ink">
                Billing has stopped and {vehicle.name} is now registered at{' '}
                {settledReceipt.stationName}.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-md border border-mist bg-white p-4">
            <div className="flex items-center justify-between text-xs text-dilute-ink">
              <span>Reserved fare</span>
              <span className="tabular-nums text-indigo-depth">
                {formatMkd(settledReceipt.baseMkd)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-dilute-ink">
              <span>Late penalty</span>
              <span className="tabular-nums text-indigo-depth">
                {formatMkd(settledReceipt.penaltyMkd)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-mist pt-3">
              <span className="text-xs font-medium tracking-[0.14em] text-dilute-ink">
                SETTLED TOTAL
              </span>
              <span className="tabular-nums font-display text-xl font-medium text-indigo-depth sm:text-2xl">
                {formatMkd(settledReceipt.totalMkd)}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] w-full rounded bg-indigo-depth px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-white hover:bg-ink-current sm:w-auto"
            >
              DONE
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 p-4 sm:p-6">
          <div>
            <label
              htmlFor="return-station"
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-dilute-ink"
            >
              <MapPin className="h-3.5 w-3.5 text-indigo-depth" />
              DROP-OFF STATION IN SKOPJE
            </label>
            <select
              id="return-station"
              value={returnStationId}
              onChange={(e) => setReturnStationId(e.target.value)}
              className="w-full rounded border border-mist bg-white px-3 py-2.5 text-sm text-indigo-depth"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.district})
                </option>
              ))}
            </select>
          </div>

          {/* Settlement Breakdown */}
          <div className="space-y-2.5 rounded-md border border-mist bg-white p-4">
            <div className="flex items-center justify-between text-xs text-dilute-ink">
              <span>Reserved ride total</span>
              <span className="tabular-nums text-indigo-depth">
                {formatMkd(reservation.totalPriceMkd)}
              </span>
            </div>

            {lateHours > 0 ? (
              <div className="flex items-center justify-between gap-2 text-xs text-status-danger-deep">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Late penalty ({lateHours}h × 1.5× tariff)
                </span>
                <span className="tabular-nums shrink-0 font-semibold">+{formatMkd(penaltyMkd)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-indigo-depth">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Returned within booked window
                </span>
                <span className="tabular-nums">0 MKD</span>
              </div>
            )}

            <div className="flex items-baseline justify-between border-t border-mist pt-3">
              <span className="text-xs font-medium tracking-[0.14em] text-dilute-ink">
                FINAL SETTLEMENT
              </span>
              <span className="tabular-nums font-display text-xl font-medium text-indigo-depth sm:text-2xl">
                {formatMkd(finalTotal)}
              </span>
            </div>
          </div>

          {/* Admin / Offline Evaluation simulation helper */}
          {canSimulateLateReturn && (
            <details className="text-[11px] text-dilute-ink">
              <summary className="cursor-pointer py-1 font-medium hover:text-indigo-depth">
                Admin simulation: test late return penalty
              </summary>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-mist bg-white px-3.5 py-2.5">
                <span>Simulate overdue return (1.5× hourly tariff)</span>
                <div className="flex items-center gap-1.5">
                  {[0, 2].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      aria-pressed={simulateLateHours === hrs}
                      onClick={() => setSimulateLateHours(hrs)}
                      className={`min-h-[32px] rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        simulateLateHours === hrs
                          ? 'bg-indigo-depth text-white'
                          : 'border border-mist text-dilute-ink hover:text-indigo-depth'
                      }`}
                    >
                      {hrs === 0 ? 'On Time' : '+2h Late'}
                    </button>
                  ))}
                </div>
              </div>
            </details>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded border border-mist bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-dilute-ink hover:border-indigo-depth hover:text-indigo-depth"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded bg-indigo-depth px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-ink-current disabled:opacity-45"
            >
              {submitting ? 'COMPLETING...' : 'COMPLETE RETURN'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
