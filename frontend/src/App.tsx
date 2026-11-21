import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MonthlyRevenuePoint,
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
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  addStationInDb,
  addVehicleInDb,
  addVehicleTypeInDb,
  adminSetReservationStatusInDb,
  cancelReservationInDb,
  createReservationInDb,
  deleteProfileInDb,
  deleteReservationInDb,
  deleteStationInDb,
  deleteVehicleInDb,
  deleteVehicleTypeInDb,
  fetchBootstrapData,
  pickUpReservationInDb,
  returnReservationInDb,
  signOutFromSupabase,
  signUpWithSupabase,
  toggleProfileActiveInDb,
  updateProfileRoleInDb,
  updateVehicleInDb,
} from './services/rydioApi';

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
  const [supabaseLive, setSupabaseLive] = useState(false);

  const [users, setUsers] = useState<UserAccount[]>(() =>
    loadState('rydio_users_v1', INITIAL_USERS)
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadState<string | null>('rydio_session_uid_v1', null)
  );
  const [supabaseCurrentUser, setSupabaseCurrentUser] = useState<UserAccount | null>(null);

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
  const [busyWindows, setBusyWindows] = useState<
    { vehicleId: string; startTime: string; endTime: string; status: ReservationStatus }[]
  >([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenuePoint[]>(
    HISTORICAL_MONTHLY_REVENUE
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

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  const syncFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const data = await fetchBootstrapData();
      if (!data) return;
      setStations(data.stations);
      setVehicleTypes(data.vehicleTypes);
      setVehicles(data.vehicles);
      setReservations(data.reservations);
      setBusyWindows(data.busyWindows);
      setSupabaseCurrentUser(data.currentUser);
      if (data.users.length > 0) setUsers(data.users);
      if (data.monthlyRevenue.length > 0) setMonthlyRevenue(data.monthlyRevenue);
      setSupabaseLive(true);
    } catch {
      // Keep local seed fallback if migration has not yet been applied
      setSupabaseLive(false);
    }
  }, []);

  useEffect(() => {
    void syncFromSupabase();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncFromSupabase();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [syncFromSupabase]);

  const currentUser = useMemo(() => {
    if (supabaseLive) return supabaseCurrentUser;
    return users.find((u) => u.id === currentUserId && u.active) ?? null;
  }, [supabaseLive, supabaseCurrentUser, users, currentUserId]);

  // Persist local fallback state only when not running live on Supabase
  useEffect(() => {
    if (supabaseLive) return;
    window.localStorage.setItem('rydio_users_v1', JSON.stringify(users));
    window.localStorage.setItem('rydio_session_uid_v1', JSON.stringify(currentUserId));
    window.localStorage.setItem('rydio_stations_v1', JSON.stringify(stations));
    window.localStorage.setItem('rydio_types_v1', JSON.stringify(vehicleTypes));
    window.localStorage.setItem('rydio_vehicles_v1', JSON.stringify(vehicles));
    window.localStorage.setItem('rydio_reservations_v1', JSON.stringify(reservations));
  }, [supabaseLive, users, currentUserId, stations, vehicleTypes, vehicles, reservations]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Combined reservations used for public availability checks (respects busyWindows in Supabase mode)
  const availabilityReservations = useMemo<Reservation[]>(() => {
    if (!supabaseLive) return reservations;
    return busyWindows.map((b, idx) => ({
      id: `busy-${idx}`,
      vehicleId: b.vehicleId,
      customerName: '',
      customerEmail: '',
      pickupStationId: '',
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      basePriceMkd: 0,
      discountAppliedMkd: 0,
      latePenaltyMkd: 0,
      totalPriceMkd: 0,
      createdAt: b.startTime,
    }));
  }, [supabaseLive, reservations, busyWindows]);

  const handleSupabaseAuthSuccess = async () => {
    await syncFromSupabase();
    setAuthModalMode(null);
    showToast('Signed in to Rydio.');
  };

  const handleLocalLoginSuccess = (user: UserAccount) => {
    setCurrentUserId(user.id);
    setAuthModalMode(null);
    showToast(`Signed in as ${user.name} (${user.role}).`);
  };

  const handleLocalRegisterSuccess = (newUser: UserAccount) => {
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setAuthModalMode(null);
    showToast(`Welcome to Rydio, ${newUser.name}!`);
  };

  const handleLogout = async () => {
    if (supabaseLive) {
      await signOutFromSupabase();
      setSupabaseCurrentUser(null);
      await syncFromSupabase();
    } else {
      setCurrentUserId(null);
    }
    if (activeTab === 'admin') setActiveTab('home');
    showToast('Signed out.');
  };

  const freeNowCount = useMemo(() => {
    const nowIso = new Date().toISOString();
    const soonIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return vehicles.filter((v) =>
      isVehicleAvailable(v, availabilityReservations, nowIso, soonIso)
    ).length;
  }, [vehicles, availabilityReservations]);

  const windowFreeCount = useMemo(() => {
    const startIso = toSafeIso(filterStart);
    const endIso = toSafeIso(filterEnd);
    return vehicles.filter((v) => {
      if (v.inMaintenance) return false;
      if (filterTypeId && v.typeId !== filterTypeId) return false;
      if (filterStationId && v.stationId !== filterStationId) return false;
      return isVehicleAvailable(v, availabilityReservations, startIso, endIso);
    }).length;
  }, [
    vehicles,
    availabilityReservations,
    filterTypeId,
    filterStationId,
    filterStart,
    filterEnd,
  ]);

  const windowDurationLabel = useMemo(
    () => formatWindowDuration(filterStart, filterEnd),
    [filterStart, filterEnd]
  );

  const selectedStationLabel = useMemo(() => {
    if (!filterStationId) return 'All Skopje';
    return stations.find((s) => s.id === filterStationId)?.name ?? 'All Skopje';
  }, [filterStationId, stations]);

  const activeRidesCount = useMemo(
    () => availabilityReservations.filter((r) => r.status === 'Active').length,
    [availabilityReservations]
  );

  const myActiveCount = useMemo(() => {
    if (!currentUser) return 0;
    return reservations.filter(
      (r) =>
        r.customerEmail.toLowerCase() === currentUser.email.toLowerCase() &&
        (r.status === 'Active' || r.status === 'Reserved')
    ).length;
  }, [reservations, currentUser]);

  const handleConfirmReservation = async (payload: {
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

    const bookingId = `RES-${Math.floor(1050 + Math.random() * 8900)}`;

    if (supabaseLive) {
      try {
        await createReservationInDb({
          id: bookingId,
          vehicleId: vehicle.id,
          userId: currentUser.id,
          customerName: currentUser.name,
          customerEmail: currentUser.email,
          pickupStationId: vehicle.stationId,
          startTime: payload.startTime,
          endTime: payload.endTime,
          basePriceMkd: payload.basePriceMkd,
          discountAppliedMkd: payload.discountAppliedMkd,
          totalPriceMkd: payload.totalPriceMkd,
        });
        await syncFromSupabase();
        setBookingVehicle(null);
        setActiveTab('my-rides');
        showToast(`Reserved ${vehicle.name} (${bookingId}).`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create reservation.');
      }
      return;
    }

    const newRes: Reservation = {
      id: bookingId,
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

  const handlePickUp = async (reservationId: string) => {
    if (supabaseLive) {
      try {
        await pickUpReservationInDb(reservationId);
        await syncFromSupabase();
        showToast(`Vehicle picked up — reservation ${reservationId} is now Active.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Pickup failed.');
      }
      return;
    }
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: 'Active' } : r))
    );
    showToast(`Vehicle picked up — reservation ${reservationId} is now Active.`);
  };

  const handleConfirmReturn = async (payload: {
    reservationId: string;
    returnStationId: string;
    actualReturnTime: string;
    latePenaltyMkd: number;
  }) => {
    const stationName = stations.find((s) => s.id === payload.returnStationId)?.name ?? 'station';
    if (supabaseLive) {
      try {
        await returnReservationInDb({
          reservationId: payload.reservationId,
          returnStationId: payload.returnStationId,
          actualReturnTime: payload.actualReturnTime,
        });
        await syncFromSupabase();
        showToast(`Vehicle docked at ${stationName}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Return failed.');
      }
      return;
    }

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
    showToast(`Vehicle docked at ${stationName}.`);
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (supabaseLive) {
      try {
        await cancelReservationInDb(reservationId);
        await syncFromSupabase();
        showToast(`Reservation ${reservationId} cancelled.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Cancellation failed.');
      }
      return;
    }
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: 'Cancelled' } : r))
    );
    showToast(`Reservation ${reservationId} cancelled.`);
  };

  // Admin & SuperAdmin handlers
  const handleToggleMaintenance = async (vehicleId: string) => {
    const target = vehicles.find((v) => v.id === vehicleId);
    if (!target) return;
    if (supabaseLive) {
      try {
        await updateVehicleInDb(vehicleId, { inMaintenance: !target.inMaintenance });
        await syncFromSupabase();
        showToast(
          target.inMaintenance
            ? `${target.name} restored to public catalog.`
            : `${target.name} moved to service (hidden from catalog).`
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.');
      }
      return;
    }
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, inMaintenance: !v.inMaintenance } : v))
    );
    showToast(
      target.inMaintenance
        ? `${target.name} restored to public catalog.`
        : `${target.name} moved to service (hidden from catalog).`
    );
  };

  const handleAddVehicle = async (veh: Omit<Vehicle, 'id'>) => {
    const created: Vehicle = { ...veh, id: `veh-${Date.now()}` };
    if (supabaseLive) {
      try {
        await addVehicleInDb(created);
        await syncFromSupabase();
        showToast(`Added ${created.name} to fleet.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add vehicle.');
      }
      return;
    }
    setVehicles((prev) => [created, ...prev]);
    showToast(`Added ${created.name} to fleet.`);
  };

  const handleUpdateVehicle = async (vehicleId: string, patch: Partial<Vehicle>) => {
    if (supabaseLive) {
      try {
        await updateVehicleInDb(vehicleId, patch);
        await syncFromSupabase();
        showToast('Vehicle details updated.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.');
      }
      return;
    }
    setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? { ...v, ...patch } : v)));
    showToast('Vehicle details updated.');
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const target = vehicles.find((v) => v.id === vehicleId);
    if (supabaseLive) {
      try {
        await deleteVehicleInDb(vehicleId);
        await syncFromSupabase();
        showToast(`Removed ${target?.name ?? 'vehicle'} from fleet.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.');
      }
      return;
    }
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    showToast(`Removed ${target?.name ?? 'vehicle'} from fleet.`);
  };

  const handleAddType = async (vt: Omit<VehicleType, 'id'>) => {
    const created: VehicleType = { ...vt, id: `vt-${Date.now()}` };
    if (supabaseLive) {
      try {
        await addVehicleTypeInDb(created);
        await syncFromSupabase();
        showToast(`Added vehicle type "${created.name}".`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add type.');
      }
      return;
    }
    setVehicleTypes((prev) => [...prev, created]);
    showToast(`Added vehicle type "${created.name}".`);
  };

  const handleDeleteType = async (typeId: string) => {
    const inUse = vehicles.some((v) => v.typeId === typeId);
    if (inUse) {
      showToast('Cannot delete type while vehicles are still assigned to it.');
      return;
    }
    if (supabaseLive) {
      try {
        await deleteVehicleTypeInDb(typeId);
        await syncFromSupabase();
        showToast('Vehicle type deleted.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.');
      }
      return;
    }
    setVehicleTypes((prev) => prev.filter((t) => t.id !== typeId));
    showToast('Vehicle type deleted.');
  };

  const handleAddStation = async (st: Omit<Station, 'id'>) => {
    const created: Station = { ...st, id: `st-${Date.now()}` };
    if (supabaseLive) {
      try {
        await addStationInDb(created);
        await syncFromSupabase();
        showToast(`Added station "${created.name}".`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add station.');
      }
      return;
    }
    setStations((prev) => [...prev, created]);
    showToast(`Added station "${created.name}".`);
  };

  const handleDeleteStation = async (stationId: string) => {
    const hasDocked = vehicles.some((v) => v.stationId === stationId);
    if (hasDocked) {
      showToast('Move docked vehicles to another station before deleting this station.');
      return;
    }
    if (supabaseLive) {
      try {
        await deleteStationInDb(stationId);
        await syncFromSupabase();
        showToast('Station deleted.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.');
      }
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== stationId));
    showToast('Station deleted.');
  };

  const handleAdminSetReservationStatus = async (
    reservationId: string,
    status: ReservationStatus
  ) => {
    if (supabaseLive) {
      try {
        await adminSetReservationStatusInDb(reservationId, status);
        await syncFromSupabase();
        showToast(`Reservation ${reservationId} marked ${status}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Status update failed.');
      }
      return;
    }
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    showToast(`Reservation ${reservationId} marked ${status}.`);
  };

  const handleDeleteReservation = async (reservationId: string) => {
    if (supabaseLive) {
      try {
        await deleteReservationInDb(reservationId);
        await syncFromSupabase();
        showToast(`Reservation ${reservationId} removed.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.');
      }
      return;
    }
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    showToast(`Reservation ${reservationId} removed.`);
  };

  const handleCreateUser = async (user: Omit<UserAccount, 'id' | 'createdAt'>) => {
    if (supabaseLive) {
      try {
        await signUpWithSupabase(user.name, user.email, user.password);
        await syncFromSupabase();
        showToast(`Created account for ${user.name}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create user.');
      }
      return;
    }
    const created: UserAccount = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, created]);
    showToast(`Created ${created.role} account for ${created.name}.`);
  };

  const handleUpdateUserRole = async (userId: string, nextRole: AccountRole) => {
    if (supabaseLive) {
      try {
        await updateProfileRoleInDb(userId, nextRole);
        await syncFromSupabase();
        showToast(`Updated user role to ${nextRole}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Role update failed.');
      }
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    showToast(`Updated user role to ${nextRole}.`);
  };

  const handleToggleUserActive = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (supabaseLive) {
      try {
        await toggleProfileActiveInDb(userId, !target.active);
        await syncFromSupabase();
        showToast(target.active ? `Suspended ${target.name}.` : `Reactivated ${target.name}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.');
      }
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)));
    showToast(target.active ? `Suspended ${target.name}.` : `Reactivated ${target.name}.`);
  };

  const handleDeleteUser = async (userId: string) => {
    if (supabaseLive) {
      try {
        await deleteProfileInDb(userId);
        await syncFromSupabase();
        showToast('User profile deleted.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.');
      }
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    showToast('User account deleted.');
  };

  const handleResetSystemData = () => {
    if (supabaseLive) {
      void syncFromSupabase();
      showToast('Synced latest state from Supabase PostgreSQL.');
      return;
    }
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
        onLogout={() => void handleLogout()}
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
            reservations={availabilityReservations}
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
            reservations={availabilityReservations}
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
            reservations={availabilityReservations}
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
            onPickUp={(id) => void handlePickUp(id)}
            onOpenReturn={(res) => setReturningReservation(res)}
            onCancel={(id) => void handleCancelReservation(id)}
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
            monthlyRevenue={monthlyRevenue}
            onToggleMaintenance={(id) => void handleToggleMaintenance(id)}
            onAddVehicle={(v) => void handleAddVehicle(v)}
            onUpdateVehicle={(id, p) => void handleUpdateVehicle(id, p)}
            onDeleteVehicle={(id) => void handleDeleteVehicle(id)}
            onAddType={(vt) => void handleAddType(vt)}
            onDeleteType={(id) => void handleDeleteType(id)}
            onAddStation={(st) => void handleAddStation(st)}
            onDeleteStation={(id) => void handleDeleteStation(id)}
            onAdminSetReservationStatus={(id, st) => void handleAdminSetReservationStatus(id, st)}
            onDeleteReservation={(id) => void handleDeleteReservation(id)}
            onCreateUser={(u) => void handleCreateUser(u)}
            onUpdateUserRole={(id, r) => void handleUpdateUserRole(id, r)}
            onToggleUserActive={(id) => void handleToggleUserActive(id)}
            onDeleteUser={(id) => void handleDeleteUser(id)}
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
          useSupabaseAuth={supabaseLive}
          users={users}
          onSupabaseAuthSuccess={handleSupabaseAuthSuccess}
          onLocalLoginSuccess={handleLocalLoginSuccess}
          onLocalRegisterSuccess={handleLocalRegisterSuccess}
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
          reservations={availabilityReservations}
          currentUser={currentUser}
          onRequireAuth={(mode) => setAuthModalMode(mode)}
          onConfirm={(p) => void handleConfirmReservation(p)}
          onClose={() => setBookingVehicle(null)}
        />
      )}

      {returningReservation && returningVehicle && (
        <ReturnModal
          reservation={returningReservation}
          vehicle={returningVehicle}
          stations={stations}
          onConfirmReturn={(p) => void handleConfirmReturn(p)}
          onClose={() => setReturningReservation(null)}
        />
      )}

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
