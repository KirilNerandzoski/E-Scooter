import { useState } from 'react';
import {
  Play,
  CornerDownLeft,
  XCircle,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type { Reservation, Station, UserAccount, Vehicle } from '../types/rydio';
import { canCancelReservation, formatMkd, formatShortDateTime } from '../utils/pricing';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface MyRidesPageProps {
  currentUser: UserAccount | null;
  reservations: Reservation[];
  vehicles: Vehicle[];
  stations: Station[];
  onOpenAuth: (mode: 'login' | 'register') => void;
  onBrowseCatalog: () => void;
  onPickUp: (reservationId: string) => void;
  onOpenReturn: (reservation: Reservation) => void;
  onCancel: (reservationId: string) => void;
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

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[960px] px-6 py-16 sm:px-10">
        <div className="rounded-lg border border-[#DDE2E8] bg-white p-10 text-center">
          <h1 className="font-display text-3xl font-light text-[#0A1A33]">My Reservations</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#515F73]">
            Sign in or create an account to reserve vehicles, pick up rides, return to Skopje
            stations, and manage your booking history.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="rounded bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-[#1E2D4A]"
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="rounded border border-[#0A1A33]/35 bg-white px-5 py-2.5 text-xs font-medium tracking-[0.16em] text-[#0A1A33] transition-colors hover:border-[#0A1A33]"
            >
              CREATE ACCOUNT
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myReservations = reservations.filter(
    (r) => r.customerEmail.toLowerCase() === currentUser.email.toLowerCase()
  );
  const activeRides = myReservations.filter((r) => r.status === 'Active');
  const upcomingRides = myReservations.filter((r) => r.status === 'Reserved');
  const pastRides = myReservations.filter(
    (r) => r.status === 'Completed' || r.status === 'Cancelled'
  );

  const getVehicle = (id: string) => vehicles.find((v) => v.id === id);
  const getStationName = (id?: string) =>
    stations.find((s) => s.id === id)?.name ?? 'Skopje Station';

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10">
      <div className="border-b border-[#DDE2E8] pb-6">
        <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-[#0A1A33] sm:text-4xl">
          My Reservations &amp; Rides
        </h1>
        <p className="mt-2 text-sm text-[#515F73]">
          Signed in as <strong className="text-[#0A1A33]">{currentUser.name}</strong> (
          {currentUser.email}). Pick up upcoming bookings, return active rides, or cancel up to 1
          hour before start.
        </p>
      </div>

      {/* Active Ride Banner */}
      {activeRides.length > 0 && (
        <section aria-label="Active rides" className="mt-8 space-y-4">
          <h2 className="text-xs font-medium tracking-[0.16em] text-[#515F73]">ACTIVE RIGHT NOW</h2>
          {activeRides.map((res) => {
            const vehicle = getVehicle(res.vehicleId);
            const isOverdue = new Date(res.endTime).getTime() < Date.now();
            return (
              <div
                key={res.id}
                className="indigo-basin-card flex flex-col justify-between gap-6 rounded-lg p-6 text-white sm:flex-row sm:items-center"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-full bg-[#10B981]/25 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.14em] text-[#A7F3D0]">
                      ACTIVE RIDE
                    </span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/25 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.12em] text-[#FECACA]">
                        <AlertTriangle className="h-3 w-3" />
                        OVERDUE (1.5× PENALTY)
                      </span>
                    )}
                    <span className="tabular-nums text-xs text-[#C4D2E8]">{res.id}</span>
                  </div>
                  <h3 className="font-display text-2xl font-normal text-white">
                    {vehicle?.name ?? 'Electric Vehicle'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#C4D2E8]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      Picked up at {getStationName(res.pickupStationId)}
                    </span>
                    <span className="tabular-nums inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Due by {formatShortDateTime(res.endTime)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="tabular-nums font-display text-xl text-white">
                      {formatMkd(res.totalPriceMkd)}
                    </p>
                    <p className="text-[11px] text-[#C4D2E8]">Base fare</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReturn(res)}
                    className="inline-flex items-center gap-2 rounded bg-white px-4 py-2.5 text-xs font-medium tracking-[0.14em] text-[#0A1A33] transition-colors hover:bg-[#E6EEF8]"
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
      <section aria-label="Upcoming reservations" className="mt-10">
        <h2 className="text-xs font-medium tracking-[0.16em] text-[#515F73]">
          UPCOMING RESERVATIONS ({upcomingRides.length})
        </h2>
        <div className="mt-4 space-y-3">
          {upcomingRides.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-6 text-sm text-[#515F73]">
              <span>You have no upcoming reservations yet.</span>
              <button
                type="button"
                onClick={onBrowseCatalog}
                className="inline-flex items-center gap-1.5 rounded bg-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A]"
              >
                BROWSE CATALOG
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            upcomingRides.map((res) => {
              const vehicle = getVehicle(res.vehicleId);
              const cancellable = canCancelReservation(res);
              return (
                <div
                  key={res.id}
                  className="flex flex-col justify-between gap-4 rounded-lg border border-[#DDE2E8] bg-white p-5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="tabular-nums text-xs font-medium text-[#0A1A33]">
                        {res.id}
                      </span>
                      <span className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-medium tracking-[0.12em] text-[#92400E]">
                        RESERVED
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-[#0A1A33]">
                      {vehicle?.name ?? 'Electric Vehicle'}
                    </h3>
                    <p className="tabular-nums text-xs text-[#515F73]">
                      {formatShortDateTime(res.startTime)} → {formatShortDateTime(res.endTime)} ·{' '}
                      {getStationName(res.pickupStationId)}
                    </p>
                    {res.discountAppliedMkd > 0 && (
                      <p className="tabular-nums text-[11px] font-medium text-[#0A1A33]">
                        Full-day rate cap applied (−{formatMkd(res.discountAppliedMkd)})
                      </p>
                    )}
                    {!cancellable && (
                      <p className="text-[11px] text-[#822020]">
                        Cancellation closed (less than 1 hour before pickup).
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tabular-nums mr-2 font-display text-xl font-medium text-[#0A1A33]">
                      {formatMkd(res.totalPriceMkd)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPickUp(res.id)}
                      className="inline-flex items-center gap-1.5 rounded bg-[#0A1A33] px-4 py-2 text-xs font-medium tracking-[0.14em] text-white hover:bg-[#1E2D4A]"
                    >
                      <Play className="h-3.5 w-3.5" />
                      PICK UP
                    </button>
                    <button
                      type="button"
                      disabled={!cancellable}
                      onClick={() => setConfirmCancelId(res.id)}
                      className="inline-flex items-center gap-1.5 rounded border border-[#DDE2E8] bg-white px-3.5 py-2 text-xs font-medium tracking-[0.12em] text-[#515F73] hover:border-[#822020] hover:text-[#822020] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      CANCEL
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Past History */}
      <section aria-label="Past ride history" className="mt-10">
        <h2 className="text-xs font-medium tracking-[0.16em] text-[#515F73]">
          PAST HISTORY ({pastRides.length})
        </h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-[#DDE2E8] bg-white">
          {pastRides.length === 0 ? (
            <p className="p-6 text-sm text-[#515F73]">No completed or cancelled trips yet.</p>
          ) : (
            <div className="divide-y divide-[#DDE2E8]">
              {pastRides.map((res) => {
                const vehicle = getVehicle(res.vehicleId);
                const isCancelled = res.status === 'Cancelled';
                return (
                  <div
                    key={res.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-medium text-[#0A1A33]">
                          {vehicle?.name ?? 'Electric Vehicle'}
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
          onConfirm={() => {
            onCancel(confirmCancelId);
            setConfirmCancelId(null);
          }}
          onCancel={() => setConfirmCancelId(null)}
        />
      )}
    </div>
  );
}
