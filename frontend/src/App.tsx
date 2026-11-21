import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LeftRail, type NavTab } from './components/LeftRail';
import { RightTelemetry } from './components/RightTelemetry';
import { ReservationModal } from './components/ReservationModal';
import { ReturnModal } from './components/ReturnModal';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { StationsPage } from './pages/StationsPage';
import { MyRidesPage } from './pages/MyRidesPage';
import { AdminPage } from './pages/AdminPage';
import {
  HISTORICAL_MONTHLY_REVENUE,
  INITIAL_RESERVATIONS,
  INITIAL_STATIONS,
  INITIAL_USERS,
  INITIAL_VEHICLE_TYPES,
  INITIAL_VEHICLES,
} from './data/seedData';
import type {
  AccountRole,
  Reservation,
  ReservationStatus,
  Station,
  UserAccount,
  Vehicle,
  VehicleType,
} from './types/rydio';
import {
  formatWindowDuration,
  isVehicleAvailable,
  toLocalDateTimeInput,
  toSafeIso,
} from './utils/pricing';

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  const [users, setUsers] = useState<UserAccount[]>(() =>
    loadState('rydio_users_v1', INITIAL_USERS)
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadState<string | null>('rydio_session_uid_v1', null)
  );

  const [stations, setStations] = useState<Station[]>(() =>
    loadState('rydio_stations_v1', INITIAL_STATIONS)
  );
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(() =>
    loadState('rydio_types_v1', INITIAL_VEHICLE_TYPES)
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>(() =>
    loadState('rydio_vehicles_v1', INITIAL_VEHICLES)
  );
  const [reservations, setReservations] = useState<Reservation[]>(() =>
    loadState('rydio_reservations_v1', INITIAL_RESERVATIONS)
  );

  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);

  const [filterTypeId, setFilterTypeId] = useState('');
  const [filterStationId, setFilterStationId] = useState('');
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toLocalDateTimeInput(d);
  });
  const [filterEnd, setFilterEnd] = useState(() => {
    const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toLocalDateTimeInput(d);
  });

  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);
  const [returningReservation, setReturningReservation] = useState<Reservation | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId && u.active) ?? null,
    [users, currentUserId]
  );

  useEffect(() => {
    window.localStorage.setItem('rydio_users_v1', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    window.localStorage.setItem('rydio_session_uid_v1', JSON.stringify(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    window.localStorage.setItem('rydio_stations_v1', JSON.stringify(stations));
  }, [stations]);

  useEffect(() => {
    window.localStorage.setItem('rydio_types_v1', JSON.stringify(vehicleTypes));
  }, [vehicleTypes]);

  useEffect(() => {
    window.localStorage.setItem('rydio_vehicles_v1', JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    window.localStorage.setItem('rydio_reservations_v1', JSON.stringify(reservations));
  }, [reservations]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3600);
  };

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUserId(user.id);
    setAuthModalMode(null);
    showToast(`Signed in as ${user.name} (${user.role}).`);
  };

  const handleRegisterSuccess = (newUser: UserAccount) => {
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setAuthModalMode(null);
    showToast(`Welcome to Rydio, ${newUser.name}!`);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    if (activeTab === 'admin') setActiveTab('home');
    showToast('Signed out.');
  };

  const freeNowCount = useMemo(() => {
    const nowIso = new Date().toISOString();
    const soonIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return vehicles.filter((v) => isVehicleAvailable(v, reservations, nowIso, soonIso)).length;
  }, [vehicles, reservations]);

  const windowFreeCount = useMemo(() => {
    const startIso = toSafeIso(filterStart);
    const endIso = toSafeIso(filterEnd);
    return vehicles.filter((v) => {
      if (v.inMaintenance) return false;
      if (filterTypeId && v.typeId !== filterTypeId) return false;
      if (filterStationId && v.stationId !== filterStationId) return false;
      return isVehicleAvailable(v, reservations, startIso, endIso);
    }).length;
  }, [vehicles, reservations, filterTypeId, filterStationId, filterStart, filterEnd]);

  const windowDurationLabel = useMemo(
    () => formatWindowDuration(filterStart, filterEnd),
    [filterStart, filterEnd]
  );

  const selectedStationLabel = useMemo(() => {
    if (!filterStationId) return 'All Skopje';
    return stations.find((s) => s.id === filterStationId)?.name ?? 'All Skopje';
  }, [filterStationId, stations]);

  const activeRidesCount = useMemo(
    () => reservations.filter((r) => r.status === 'Active').length,
    [reservations]
  );

  const myActiveCount = useMemo(() => {
    if (!currentUser) return 0;
    return reservations.filter(
      (r) =>
        r.customerEmail.toLowerCase() === currentUser.email.toLowerCase() &&
        (r.status === 'Active' || r.status === 'Reserved')
    ).length;
  }, [reservations, currentUser]);

  const handleConfirmReservation = (payload: {
    vehicleId: string;
    startTime: string;
    endTime: string;
    basePriceMkd: number;
    discountAppliedMkd: number;
    totalPriceMkd: number;
  }) => {
    if (!currentUser) return;
    const vehicle = vehicles.find((v) => v.id === payload.vehicleId);
    if (!vehicle) return;

    const newRes: Reservation = {
      id: `RES-${Math.floor(1050 + Math.random() * 8900)}`,
      vehicleId: vehicle.id,
      customerName: currentUser.name,
      customerEmail: currentUser.email,
      pickupStationId: vehicle.stationId,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: 'Reserved',
      basePriceMkd: payload.basePriceMkd,
      discountAppliedMkd: payload.discountAppliedMkd,
      latePenaltyMkd: 0,
      totalPriceMkd: payload.totalPriceMkd,
      createdAt: new Date().toISOString(),
    };

    setReservations((prev) => [newRes, ...prev]);
    setBookingVehicle(null);
    setActiveTab('my-rides');
    showToast(`Reserved ${vehicle.name} (${newRes.id}).`);
  };

  const handlePickUp = (reservationId: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: 'Active' } : r))
    );
    showToast(`Vehicle picked up — reservation ${reservationId} is now Active.`);
  };

  const handleConfirmReturn = (payload: {
    reservationId: string;
    returnStationId: string;
    actualReturnTime: string;
    latePenaltyMkd: number;
  }) => {
    const target = reservations.find((r) => r.id === payload.reservationId);
    if (!target) return;

    setReservations((prev) =>
      prev.map((r) =>
        r.id === payload.reservationId
          ? {
              ...r,
              status: 'Completed',
              returnStationId: payload.returnStationId,
              actualReturnTime: payload.actualReturnTime,
              latePenaltyMkd: payload.latePenaltyMkd,
            }
          : r
      )
    );

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === target.vehicleId ? { ...v, stationId: payload.returnStationId } : v
      )
    );

    const stationName = stations.find((s) => s.id === payload.returnStationId)?.name ?? 'station';
    showToast(`Vehicle docked at ${stationName}.`);
  };

  const handleCancelReservation = (reservationId: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: 'Cancelled' } : r))
    );
    showToast(`Reservation ${reservationId} cancelled.`);
  };

  // Admin & SuperAdmin handlers with orphan protection + toast feedback
  const handleToggleMaintenance = (vehicleId: string) => {
    const target = vehicles.find((v) => v.id === vehicleId);
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, inMaintenance: !v.inMaintenance } : v))
    );
    if (target) {
      showToast(
        target.inMaintenance
          ? `${target.name} restored to public catalog.`
          : `${target.name} moved to service (hidden from catalog).`
      );
    }
  };

  const handleAddVehicle = (veh: Omit<Vehicle, 'id'>) => {
    const created: Vehicle = { ...veh, id: `veh-${Date.now()}` };
    setVehicles((prev) => [created, ...prev]);
    showToast(`Added ${created.name} to fleet.`);
  };

  const handleUpdateVehicle = (vehicleId: string, patch: Partial<Vehicle>) => {
    setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? { ...v, ...patch } : v)));
    showToast('Vehicle details updated.');
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    const target = vehicles.find((v) => v.id === vehicleId);
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    showToast(`Removed ${target?.name ?? 'vehicle'} from fleet.`);
  };

  const handleAddType = (vt: Omit<VehicleType, 'id'>) => {
    setVehicleTypes((prev) => [...prev, { ...vt, id: `vt-${Date.now()}` }]);
    showToast(`Added vehicle type "${vt.name}".`);
  };

  const handleDeleteType = (typeId: string) => {
    const inUse = vehicles.some((v) => v.typeId === typeId);
    if (inUse) {
      showToast('Cannot delete type while vehicles are still assigned to it.');
      return;
    }
    setVehicleTypes((prev) => prev.filter((t) => t.id !== typeId));
    showToast('Vehicle type deleted.');
  };

  const handleAddStation = (st: Omit<Station, 'id'>) => {
    setStations((prev) => [...prev, { ...st, id: `st-${Date.now()}` }]);
    showToast(`Added station "${st.name}".`);
  };

  const handleDeleteStation = (stationId: string) => {
    const hasDocked = vehicles.some((v) => v.stationId === stationId);
    if (hasDocked) {
      showToast('Move docked vehicles to another station before deleting this station.');
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== stationId));
    showToast('Station deleted.');
  };

  const handleAdminSetReservationStatus = (reservationId: string, status: ReservationStatus) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    showToast(`Reservation ${reservationId} marked ${status}.`);
  };

  const handleDeleteReservation = (reservationId: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    showToast(`Reservation ${reservationId} removed.`);
  };

  const handleCreateUser = (user: Omit<UserAccount, 'id' | 'createdAt'>) => {
    const created: UserAccount = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, created]);
    showToast(`Created ${created.role} account for ${created.name}.`);
  };

  const handleUpdateUserRole = (userId: string, nextRole: AccountRole) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    showToast(`Updated user role to ${nextRole}.`);
  };

  const handleToggleUserActive = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)));
    if (target) {
      showToast(target.active ? `Suspended ${target.name}.` : `Reactivated ${target.name}.`);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    showToast('User account deleted.');
  };

  const handleResetSystemData = () => {
    setStations(INITIAL_STATIONS);
    setVehicleTypes(INITIAL_VEHICLE_TYPES);
    setVehicles(INITIAL_VEHICLES);
    setReservations(INITIAL_RESERVATIONS);
    setUsers(INITIAL_USERS);
    setCurrentUserId('usr-superadmin');
    showToast('System demo data restored to defaults.');
  };

  const returningVehicle = returningReservation
    ? vehicles.find((v) => v.id === returningReservation.vehicleId)
    : undefined;

  const isPrivileged =
    currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

  return (
    <div className="washi-surface min-h-screen text-[#0A1A33]">
      <LeftRail
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={(mode) => setAuthModalMode(mode)}
        onLogout={handleLogout}
        activeStationsCount={stations.length}
        freeFleetCount={freeNowCount}
        activeRideCount={myActiveCount}
      />

      <main className="lg:pl-[196px] xl:pr-[128px]">
        {activeTab === 'home' && (
          <HomePage
            vehicles={vehicles}
            vehicleTypes={vehicleTypes}
            stations={stations}
            reservations={reservations}
            filterTypeId={filterTypeId}
            filterStationId={filterStationId}
            filterStart={filterStart}
            filterEnd={filterEnd}
            onChangeType={setFilterTypeId}
            onChangeStation={setFilterStationId}
            onChangeStart={setFilterStart}
            onChangeEnd={setFilterEnd}
            onFindRides={() => setActiveTab('catalog')}
            onViewStations={() => setActiveTab('stations')}
            onSelectVehicle={(v) => setBookingVehicle(v)}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogPage
            vehicles={vehicles}
            vehicleTypes={vehicleTypes}
            stations={stations}
            reservations={reservations}
            filterTypeId={filterTypeId}
            filterStationId={filterStationId}
            filterStart={filterStart}
            filterEnd={filterEnd}
            onChangeType={setFilterTypeId}
            onChangeStation={setFilterStationId}
            onChangeStart={setFilterStart}
            onChangeEnd={setFilterEnd}
            onSelectVehicle={(v) => setBookingVehicle(v)}
          />
        )}

        {activeTab === 'stations' && (
          <StationsPage
            stations={stations}
            vehicles={vehicles}
            reservations={reservations}
            filterStart={filterStart}
            filterEnd={filterEnd}
            onBrowseStation={(stationId) => {
              setFilterStationId(stationId);
              setActiveTab('catalog');
            }}
          />
        )}

        {activeTab === 'my-rides' && (
          <MyRidesPage
            currentUser={currentUser}
            reservations={reservations}
            vehicles={vehicles}
            stations={stations}
            onOpenAuth={(mode) => setAuthModalMode(mode)}
            onPickUp={handlePickUp}
            onOpenReturn={(res) => setReturningReservation(res)}
            onCancel={handleCancelReservation}
          />
        )}

        {activeTab === 'admin' && isPrivileged && currentUser && (
          <AdminPage
            currentUser={currentUser}
            users={users}
            vehicles={vehicles}
            vehicleTypes={vehicleTypes}
            stations={stations}
            reservations={reservations}
            monthlyRevenue={HISTORICAL_MONTHLY_REVENUE}
            onToggleMaintenance={handleToggleMaintenance}
            onAddVehicle={handleAddVehicle}
            onUpdateVehicle={handleUpdateVehicle}
            onDeleteVehicle={handleDeleteVehicle}
            onAddType={handleAddType}
            onDeleteType={handleDeleteType}
            onAddStation={handleAddStation}
            onDeleteStation={handleDeleteStation}
            onAdminSetReservationStatus={handleAdminSetReservationStatus}
            onDeleteReservation={handleDeleteReservation}
            onCreateUser={handleCreateUser}
            onUpdateUserRole={handleUpdateUserRole}
            onToggleUserActive={handleToggleUserActive}
            onDeleteUser={handleDeleteUser}
            onResetSystemData={handleResetSystemData}
          />
        )}
      </main>

      <RightTelemetry
        windowDurationLabel={windowDurationLabel}
        windowFreeCount={windowFreeCount}
        selectedStationLabel={selectedStationLabel}
        activeRidesCount={activeRidesCount}
      />

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          users={users}
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
          onClose={() => setAuthModalMode(null)}
        />
      )}

      {bookingVehicle && (
        <ReservationModal
          vehicle={bookingVehicle}
          vehicleType={vehicleTypes.find((t) => t.id === bookingVehicle.typeId)}
          station={stations.find((s) => s.id === bookingVehicle.stationId)}
          initialStart={filterStart}
          initialEnd={filterEnd}
          reservations={reservations}
          currentUser={currentUser}
          onRequireAuth={(mode) => setAuthModalMode(mode)}
          onConfirm={handleConfirmReservation}
          onClose={() => setBookingVehicle(null)}
        />
      )}

      {returningReservation && returningVehicle && (
        <ReturnModal
          reservation={returningReservation}
          vehicle={returningVehicle}
          stations={stations}
          onConfirmReturn={handleConfirmReturn}
          onClose={() => setReturningReservation(null)}
        />
      )}

      {/* Persistently mounted polite live region for screen-reader toast announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-6 right-6 z-50"
      >
        {toast && (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-md border border-[#0A1A33] bg-[#0A1A33] px-4 py-3 text-xs font-medium text-white shadow-xl">
            <CheckCircle2 className="h-4 w-4 text-[#C4D2E8]" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
