import { useMemo, useState } from 'react';
import { X, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Reservation, Station, Vehicle } from '../types/rydio';
import { calculateLatePenalty, formatMkd, formatShortDateTime } from '../utils/pricing';
import { Modal } from './Modal';

interface ReturnModalProps {
  reservation: Reservation;
  vehicle: Vehicle;
  stations: Station[];
  onConfirmReturn: (payload: {
    reservationId: string;
    returnStationId: string;
    actualReturnTime: string;
    latePenaltyMkd: number;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function ReturnModal({
  reservation,
  vehicle,
  stations,
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

  const effectiveReturnDate = useMemo(() => {
    const base = new Date();
    if (simulateLateHours > 0) {
      const bookedEnd = new Date(reservation.endTime);
      const laterOfNowOrEnd = bookedEnd > base ? bookedEnd : base;
      return new Date(laterOfNowOrEnd.getTime() + simulateLateHours * 60 * 60 * 1000);
    }
    return base;
  }, [reservation.endTime, simulateLateHours]);

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
      const ok = await onConfirmReturn({
        reservationId: reservation.id,
        returnStationId,
        actualReturnTime: effectiveReturnDate.toISOString(),
        latePenaltyMkd: penaltyMkd,
      });
      if (ok) {
        setSettledReceipt({
          stationName,
          baseMkd: reservation.totalPriceMkd,
          penaltyMkd,
          totalMkd: finalTotal,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal labelledBy="return-modal-title" maxWidthClass="max-w-lg" onClose={onClose}>
      <div className="flex items-start justify-between rounded-t-lg border-b border-[#DDE2E8] bg-white px-6 py-5">
        <div>
          <h2 id="return-modal-title" className="font-display text-2xl font-normal text-[#0A1A33]">
            {settledReceipt ? 'Ride Completed' : `Return ${vehicle.name}`}
          </h2>
          <p className="mt-1 text-xs text-[#515F73]">
            Booking {reservation.id} · Booked end {formatShortDateTime(reservation.endTime)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close return dialog"
          className="rounded border border-[#DDE2E8] p-1.5 text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {settledReceipt ? (
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3 rounded-md border border-[#0A1A33]/20 bg-white p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0A1A33]" />
            <div>
              <p className="text-sm font-medium text-[#0A1A33]">
                Dock locked at {settledReceipt.stationName}
              </p>
              <p className="mt-1 text-xs text-[#515F73]">
                Billing has stopped and {vehicle.name} is now registered at{' '}
                {settledReceipt.stationName}.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-md border border-[#DDE2E8] bg-white p-4">
            <div className="flex items-center justify-between text-xs text-[#515F73]">
              <span>Reserved fare</span>
              <span className="tabular-nums text-[#0A1A33]">
                {formatMkd(settledReceipt.baseMkd)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#515F73]">
              <span>Late penalty</span>
              <span className="tabular-nums text-[#0A1A33]">
                {formatMkd(settledReceipt.penaltyMkd)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-[#DDE2E8] pt-3">
              <span className="text-xs font-medium tracking-[0.14em] text-[#515F73]">
                SETTLED TOTAL
              </span>
              <span className="tabular-nums font-display text-2xl font-medium text-[#0A1A33]">
                {formatMkd(settledReceipt.totalMkd)}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A]"
            >
              DONE
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label
              htmlFor="return-station"
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-[#515F73]"
            >
              <MapPin className="h-3.5 w-3.5 text-[#0A1A33]" />
              DROP-OFF STATION IN SKOPJE
            </label>
            <select
              id="return-station"
              value={returnStationId}
              onChange={(e) => setReturnStationId(e.target.value)}
              className="w-full rounded border border-[#DDE2E8] bg-white px-3 py-2.5 text-sm text-[#0A1A33]"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.district})
                </option>
              ))}
            </select>
          </div>

          {/* Settlement Breakdown */}
          <div className="space-y-2.5 rounded-md border border-[#DDE2E8] bg-white p-4">
            <div className="flex items-center justify-between text-xs text-[#515F73]">
              <span>Reserved ride total</span>
              <span className="tabular-nums text-[#0A1A33]">
                {formatMkd(reservation.totalPriceMkd)}
              </span>
            </div>

            {lateHours > 0 ? (
              <div className="flex items-center justify-between text-xs text-[#822020]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Late penalty ({lateHours}h × 1.5× tariff)
                </span>
                <span className="tabular-nums font-semibold">+{formatMkd(penaltyMkd)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-[#0A1A33]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Returned within booked window
                </span>
                <span className="tabular-nums">0 MKD</span>
              </div>
            )}

            <div className="flex items-baseline justify-between border-t border-[#DDE2E8] pt-3">
              <span className="text-xs font-medium tracking-[0.14em] text-[#515F73]">
                FINAL SETTLEMENT
              </span>
              <span className="tabular-nums font-display text-2xl font-medium text-[#0A1A33]">
                {formatMkd(finalTotal)}
              </span>
            </div>
          </div>

          {/* Discreet demo helper tucked inside <details> */}
          <details className="text-[11px] text-[#515F73]">
            <summary className="cursor-pointer font-medium hover:text-[#0A1A33]">
              Demo simulation: test late return penalty
            </summary>
            <div className="mt-2 flex items-center justify-between rounded-md border border-[#DDE2E8] bg-white px-3.5 py-2.5">
              <span>Simulate overdue return (1.5× hourly tariff)</span>
              <div className="flex items-center gap-1.5">
                {[0, 2].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    aria-pressed={simulateLateHours === hrs}
                    onClick={() => setSimulateLateHours(hrs)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      simulateLateHours === hrs
                        ? 'bg-[#0A1A33] text-white'
                        : 'border border-[#DDE2E8] text-[#515F73] hover:text-[#0A1A33]'
                    }`}
                  >
                    {hrs === 0 ? 'On Time' : '+2h Late'}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#DDE2E8] bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-[#515F73] hover:border-[#0A1A33] hover:text-[#0A1A33]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-[#1E2D4A] disabled:opacity-45"
            >
              {submitting ? 'COMPLETING...' : 'COMPLETE RETURN'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
