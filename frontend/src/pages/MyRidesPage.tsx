import { useMemo, useState } from 'react';
import {
  Play,
  CornerDownLeft,
  XCircle,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type { Reservation, Station, UserAccount, Vehicle } from '../types/rydio';
import {
  canCancelReservation,
  formatMkd,
  formatShortDateTime,
  getPickupEligibility,
} from '../utils/pricing';
import { hasPermission } from '../utils/rbac';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface MyRidesPageProps {
  currentUser: UserAccount | null;
  reservations: Reservation[];
  vehicles: Vehicle[];
  stations: Station[];
  onOpenAuth: (mode: 'login' | 'register') => void;
  onBrowseCatalog: () => void;
  onPickUp: (reservationId: string) => Promise<void>;
  onOpenReturn: (reservation: Reservation) => void;
  onCancel: (reservationId: string) => Promise<void>;
}

export function MyRidesPage({
  currentUser,
  reservations,
  vehicles,
  stations,
  onOpenAuth,
  onBrowseCatalog,
  onPickUp,
  onOpenReturn,
  onCancel,
}: MyRidesPageProps) {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{
    id: string;
    kind: 'pickup' | 'cancel';
  } | null>(null);
  const [nowMs] = useState(() => Date.now());
  const nowDate = useMemo(() => new Date(nowMs), [nowMs]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-12 sm:px-8 sm:py-16">
        <div className="rounded-lg border border-[#DDE2E8] bg-white p-6 text-center sm:p-10">
          <h1 className="font-display text-2xl font-light text-[#0A1A33] sm:text-3xl">
            My Reservations
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#515F73]">
            Sign in or create an account to reserve vehicles, pick up rides, return to Skopje
            stations, and manage your booking history.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="min-h-[44px] rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-[#1E2D4A]"
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="min-h-[44px] rounded border border-[#0A1A33]/35 bg-white px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-[#0A1A33] transition-colors hover:border-[#0A1A33]"
            >
              CREATE ACCOUNT
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAdminOverride = hasPermission(currentUser, 'reservations:manage');
  const myReservations = reservations.filter(
    (r) =>
      (r.userId && r.userId === currentUser.id) ||
      r.customerEmail.toLowerCase() === currentUser.email.toLowerCase()
  );
  const activeRides = myReservations.filter((r) => r.status === 'Active');
  const upcomingRides = myReservations.filter((r) => r.status === 'Reserved');
  const pastRides = myReservations.filter(
    (r) => r.status === 'Completed' || r.status === 'Cancelled'
  );

  const getVehicleName = (res: Reservation) => {
    if (res.vehicleId) {
      const found = vehicles.find((v) => v.id === res.vehicleId);
      if (found) return found.name;
    }
    return res.vehicleName || 'Electric Vehicle';
  };
  const getStationName = (id?: string) =>
    stations.find((s) => s.id === id)?.name ?? 'Skopje Station';

  const handlePickUpClick = async (id: string) => {
    if (busyAction) return;
    setBusyAction({ id, kind: 'pickup' });
    try {
      await onPickUp(id);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      <div className="border-b border-[#DDE2E8] pb-5 sm:pb-6">
        <h1 className="font-display text-[1.75rem] font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
          My Reservations &amp; Rides
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#515F73]">
          Signed in as <strong className="text-[#0A1A33]">{currentUser.name}</strong> (
          {currentUser.email}). Pick up bookings starting 30 minutes before start time, return
          active rides to any Skopje station, or cancel up to 1 hour before start.
        </p>
      </div>

      {/* Active Ride Banner */}
      {activeRides.length > 0 && (
        <section aria-label="Active rides" className="mt-7 space-y-4 sm:mt-8">
          <h2 className="text-xs font-medium tracking-[0.16em] text-[#515F73]">ACTIVE RIGHT NOW</h2>
          {activeRides.map((res) => {
            const isOverdue = new Date(res.endTime).getTime() < nowMs;
            const canReturn = Boolean(
              res.vehicleId && vehicles.some((v) => v.id === res.vehicleId)
            );
            return (
              <div
                key={res.id}
                className="indigo-basin-card flex flex-col justify-between gap-5 rounded-lg p-4 text-white sm:flex-row sm:items-center sm:p-6"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#10B981]/25 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.14em] text-[#A7F3D0]">
                      ACTIVE RIDE
                    </span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/25 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.12em] text-[#FECACA]">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        OVERDUE (1.5× PENALTY)
                      </span>
                    )}
                    <span className="tabular-nums text-xs text-[#C4D2E8]">{res.id}</span>
                  </div>
                  <h3 className="font-display text-xl font-normal text-white sm:text-2xl">
                    {getVehicleName(res)}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#C4D2E8]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      Picked up at {getStationName(res.pickupStationId)}
                    </span>
                    <span className="tabular-nums inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Due by {formatShortDateTime(res.endTime)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-3.5 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="tabular-nums font-display text-xl text-white">
                      {formatMkd(res.totalPriceMkd)}
                    </p>
                    <p className="text-[11px] text-[#C4D2E8]">Base fare</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canReturn}
                    onClick={() => onOpenReturn(res)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-[#0A1A33] transition-colors hover:bg-[#E6EEF8] disabled:opacity-45"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                    RETURN VEHICLE
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Upcoming Reservations */}
      <section aria-label="Upcoming reservations" className="mt-8 sm:mt-10">
        <h2 className="text-xs font-medium tracking-[0.16em] text-[#515F73]">
          UPCOMING RESERVATIONS ({upcomingRides.length})
        </h2>
        <div className="mt-4 space-y-3">
          {upcomingRides.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-[#DDE2E8] bg-white p-5 text-sm text-[#515F73] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <span>You have no upcoming reservations yet.</span>
              <button
                type="button"
                onClick={onBrowseCatalog}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded bg-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A]"
              >
                BROWSE CATALOG
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            upcomingRides.map((res) => {
              const cancellable = canCancelReservation(res, nowDate) || isAdminOverride;
              const pickupCheck = getPickupEligibility(
                res,
                isAdminOverride,
                nowDate,
                reservations
              );
              const isPickingUp = busyAction?.id === res.id && busyAction.kind === 'pickup';
              const isCancelling = busyAction?.id === res.id && busyAction.kind === 'cancel';

              return (
                <div
                  key={res.id}
                  className="flex flex-col justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums text-xs font-medium text-[#0A1A33]">
                        {res.id}
                      </span>
                      <span className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-medium tracking-[0.12em] text-[#92400E]">
                        RESERVED
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-[#0A1A33]">{getVehicleName(res)}</h3>
                    <p className="tabular-nums text-xs text-[#515F73]">
                      {formatShortDateTime(res.startTime)} → {formatShortDateTime(res.endTime)} ·{' '}
                      {getStationName(res.pickupStationId)}
                    </p>
                    {res.discountAppliedMkd > 0 && (
                      <p className="tabular-nums text-[11px] font-medium text-[#0A1A33]">
                        Full-day rate cap applied (−{formatMkd(res.discountAppliedMkd)})
                      </p>
                    )}
                    {!pickupCheck.canPickUp && pickupCheck.reason && (
                      <p className="text-[11px] text-[#515F73]">{pickupCheck.reason}</p>
                    )}
                    {!cancellable && (
                      <p className="text-[11px] text-[#822020]">
                        Cancellation closed (less than 1 hour before pickup).
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#DDE2E8] pt-3.5 sm:justify-end sm:gap-3 sm:border-t-0 sm:pt-0">
                    <span className="tabular-nums font-display text-xl font-medium text-[#0A1A33] sm:mr-2">
                      {formatMkd(res.totalPriceMkd)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!pickupCheck.canPickUp || Boolean(busyAction)}
                        title={pickupCheck.reason ?? 'Pick up vehicle'}
                        onClick={() => void handlePickUpClick(res.id)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded bg-[#0A1A33] px-3.5 py-2 text-xs font-medium tracking-[0.14em] text-white transition-colors hover:bg-[#1E2D4A] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isPickingUp ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {isPickingUp ? 'STARTING...' : 'PICK UP'}
                      </button>
                      <button
                        type="button"
                        disabled={!cancellable || Boolean(busyAction)}
                        onClick={() => setConfirmCancelId(res.id)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded border border-[#DDE2E8] bg-white px-3.5 py-2 text-xs font-medium tracking-[0.12em] text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isCancelling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {isCancelling ? 'CANCELLING...' : 'CANCEL'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Past History */}
      <section aria-label="Past ride history" className="mt-8 sm:mt-10">
        <h2 className="text-xs font-medium tracking-[0.16em] text-[#515F73]">
          PAST HISTORY ({pastRides.length})
        </h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-[#DDE2E8] bg-white">
          {pastRides.length === 0 ? (
            <p className="p-6 text-sm text-[#515F73]">No completed or cancelled trips yet.</p>
          ) : (
            <div className="divide-y divide-[#DDE2E8]">
              {pastRides.map((res) => {
                const isCancelled = res.status === 'Cancelled';
                return (
                  <div
                    key={res.id}
                    className="flex flex-col justify-between gap-2.5 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[#0A1A33]">
                          {getVehicleName(res)}
                        </span>
                        <span className="tabular-nums text-xs text-[#515F73]">{res.id}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium tracking-[0.1em] ${
                            isCancelled
                              ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                              : 'border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]'
                          }`}
                        >
                          {!isCancelled && <CheckCircle2 className="h-3 w-3" />}
                          {res.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="tabular-nums mt-1 text-xs text-[#515F73]">
                        {formatShortDateTime(res.startTime)} → {formatShortDateTime(res.endTime)} ·{' '}
                        {getStationName(res.pickupStationId)}
                        {res.returnStationId ? ` → ${getStationName(res.returnStationId)}` : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      {isCancelled ? (
                        <>
                          <p className="tabular-nums text-xs text-[#8C97A8] line-through">
                            {formatMkd(res.totalPriceMkd)}
                          </p>
                          <p className="text-[11px] font-medium text-[#515F73]">0 MKD charged</p>
                        </>
                      ) : (
                        <>
                          <p className="tabular-nums text-sm font-semibold text-[#0A1A33]">
                            {formatMkd(res.totalPriceMkd + res.latePenaltyMkd)}
                          </p>
                          {res.latePenaltyMkd > 0 && (
                            <p className="tabular-nums text-[11px] text-[#991B1B]">
                              Includes {formatMkd(res.latePenaltyMkd)} late penalty
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {confirmCancelId && (
        <ConfirmDialog
          title="Cancel reservation?"
          description={`Reservation ${confirmCancelId} will be cancelled and the vehicle will be released back to the public catalog.`}
          confirmLabel="Cancel Reservation"
          onConfirm={async () => {
            const targetId = confirmCancelId;
            setBusyAction({ id: targetId, kind: 'cancel' });
            try {
              await onCancel(targetId);
              setConfirmCancelId(null);
            } finally {
              setBusyAction(null);
            }
          }}
          onCancel={() => setConfirmCancelId(null)}
        />
      )}
    </div>
  );
}
