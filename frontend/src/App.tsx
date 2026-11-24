import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
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
import {
  addStationInApi,
  addVehicleInApi,
  addVehicleTypeInApi,
  adminSetReservationStatusInApi,
  cancelReservationInApi,
  createReservationInApi,
  createUserInApi,
  deleteReservationInApi,
  deleteStationInApi,
  deleteUserInApi,
  deleteVehicleInApi,
  deleteVehicleTypeInApi,
  fetchBootstrapData,
  isApiConfigured,
  logoutFromApi,
  pickUpReservationInApi,
  returnReservationInApi,
  updateStationInApi,
  updateUserActiveInApi,
  updateUserRoleInApi,
  updateVehicleInApi,
  updateVehicleTypeInApi,
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

const VALID_TABS: NavTab[] = ['home', 'catalog', 'stations', 'my-rides', 'admin'];

function readTabFromHash(): NavTab {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#\/?/, '') as NavTab;
  return VALID_TABS.includes(raw) ? raw : 'home';
}

export function App() {
  const [activeTab, setActiveTabState] = useState<NavTab>(() => readTabFromHash());
  const [apiLive, setApiLive] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'live' | 'offline'>(
    isApiConfigured ? 'connecting' : 'offline'
  );

  const setActiveTab = useCallback((next: NavTab) => {
    setActiveTabState(next);
    if (typeof window !== 'undefined') {
      const targetHash = `#${next}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTabState(readTabFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [users, setUsers] = useState<UserAccount[]>(() =>
    loadState('rydio_users_v1', INITIAL_USERS)
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadState<string | null>('rydio_session_uid_v1', null)
  );
  const [apiCurrentUser, setApiCurrentUser] = useState<UserAccount | null>(null);

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
  const pendingBookingVehicleRef = useRef<Vehicle | null>(null);
  const [returningReservation, setReturningReservation] = useState<Reservation | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, tone === 'error' ? 4800 : 3600);
  }, []);

  const syncFromApi = useCallback(async () => {
    if (!isApiConfigured) {
      setSyncStatus('offline');
      return;
    }
    try {
      const data = await fetchBootstrapData();
      if (!data) {
        setSyncStatus('offline');
        return;
      }
      setStations(data.stations);
      setVehicleTypes(data.vehicleTypes);
      setVehicles(data.vehicles);
      setReservations(data.reservations);
      setBusyWindows(data.busyWindows);
      setApiCurrentUser(data.currentUser);
      if (data.users.length > 0) setUsers(data.users);
      if (data.monthlyRevenue.length > 0) setMonthlyRevenue(data.monthlyRevenue);
      setApiLive(true);
      setSyncStatus('live');
    } catch {
      setApiLive(false);
      setSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    void syncFromApi();
  }, [syncFromApi]);

  const currentUser = useMemo(() => {
    if (apiLive) return apiCurrentUser;
    return users.find((u) => u.id === currentUserId && u.active) ?? null;
  }, [apiLive, apiCurrentUser, users, currentUserId]);

  useEffect(() => {
    if (apiLive) return;
    window.localStorage.setItem('rydio_users_v1', JSON.stringify(users));
    window.localStorage.setItem('rydio_session_uid_v1', JSON.stringify(currentUserId));
    window.localStorage.setItem('rydio_stations_v1', JSON.stringify(stations));
    window.localStorage.setItem('rydio_types_v1', JSON.stringify(vehicleTypes));
    window.localStorage.setItem('rydio_vehicles_v1', JSON.stringify(vehicles));
    window.localStorage.setItem('rydio_reservations_v1', JSON.stringify(reservations));
  }, [apiLive, users, currentUserId, stations, vehicleTypes, vehicles, reservations]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const availabilityReservations = useMemo<Reservation[]>(() => {
    if (!apiLive) return reservations;
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
  }, [apiLive, reservations, busyWindows]);

  const restorePendingBooking = useCallback(() => {
    const pending = pendingBookingVehicleRef.current;
    if (pending) {
      pendingBookingVehicleRef.current = null;
      setBookingVehicle(pending);
    }
  }, []);

  const handleApiAuthSuccess = async (user: UserAccount) => {
    setApiCurrentUser(user);
    await syncFromApi();
    setAuthModalMode(null);
    restorePendingBooking();
    showToast(`Signed in as ${user.name} (${user.role}).`);
  };

  const handleLocalLoginSuccess = (user: UserAccount) => {
    setCurrentUserId(user.id);
    setAuthModalMode(null);
    restorePendingBooking();
    showToast(`Signed in as ${user.name} (${user.role}).`);
  };

  const handleLocalRegisterSuccess = (newUser: UserAccount) => {
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setAuthModalMode(null);
    restorePendingBooking();
    showToast(`Welcome to Rydio, ${newUser.name}!`);
  };

  const handleLogout = async () => {
    if (apiLive) {
      logoutFromApi();
      setApiCurrentUser(null);
      await syncFromApi();
    } else {
      setCurrentUserId(null);
    }
    if (activeTab === 'admin') setActiveTab('home');
    showToast('Signed out.');
  };

  const freeNowCount = useMemo(() => {
    const startIso = toSafeIso(filterStart);
    const endIso = toSafeIso(filterEnd);
    const hasValidWindow =
      startIso !== null &&
      endIso !== null &&
      new Date(endIso).getTime() > new Date(startIso).getTime();

    const checkStart = hasValidWindow ? startIso : new Date().toISOString();
    const checkEnd = hasValidWindow
      ? endIso
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return vehicles.filter((v) =>
      isVehicleAvailable(v, availabilityReservations, checkStart, checkEnd)
    ).length;
  }, [vehicles, availabilityReservations, filterStart, filterEnd]);

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
  }): Promise<boolean> => {
    if (!currentUser) return false;
    const vehicle = vehicles.find((v) => v.id === payload.vehicleId);
    if (!vehicle) return false;

    if (apiLive) {
      try {
        const created = await createReservationInApi({
          vehicleId: vehicle.id,
          startTime: payload.startTime,
          endTime: payload.endTime,
        });
        await syncFromApi();
        setFilterStart(toLocalDateTimeInput(new Date(payload.startTime)));
        setFilterEnd(toLocalDateTimeInput(new Date(payload.endTime)));
        setBookingVehicle(null);
        setActiveTab('my-rides');
        showToast(`Reserved ${vehicle.name} (${created.id}).`);
        return true;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Could not create reservation.',
          'error'
        );
        return false;
      }
    }

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
    setFilterStart(toLocalDateTimeInput(new Date(payload.startTime)));
    setFilterEnd(toLocalDateTimeInput(new Date(payload.endTime)));
    setBookingVehicle(null);
    setActiveTab('my-rides');
    showToast(`Reserved ${vehicle.name} (${newRes.id}).`);
    return true;
  };

  const handlePickUp = async (reservationId: string) => {
    if (apiLive) {
      try {
        await pickUpReservationInApi(reservationId);
        await syncFromApi();
        showToast(`Vehicle picked up — reservation ${reservationId} is now Active.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Pickup failed.', 'error');
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
  }): Promise<boolean> => {
    const stationName = stations.find((s) => s.id === payload.returnStationId)?.name ?? 'station';
    if (apiLive) {
      try {
        await returnReservationInApi({
          reservationId: payload.reservationId,
          returnStationId: payload.returnStationId,
          actualReturnTime: payload.actualReturnTime,
        });
        await syncFromApi();
        showToast(`Vehicle docked at ${stationName}.`);
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Return failed.', 'error');
        return false;
      }
    }

    const target = reservations.find((r) => r.id === payload.reservationId);
    if (!target) return false;

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
    return true;
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (apiLive) {
      try {
        await cancelReservationInApi(reservationId);
        await syncFromApi();
        showToast(`Reservation ${reservationId} cancelled.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Cancellation failed.', 'error');
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
    if (apiLive) {
      try {
        await updateVehicleInApi(vehicleId, { inMaintenance: !target.inMaintenance });
        await syncFromApi();
        showToast(
          target.inMaintenance
            ? `${target.name} restored to public catalog.`
            : `${target.name} moved to service (hidden from catalog).`
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
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
    if (apiLive) {
      try {
        await addVehicleInApi(veh);
        await syncFromApi();
        showToast(`Added ${veh.name} to fleet.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add vehicle.', 'error');
      }
      return;
    }
    const created: Vehicle = { ...veh, id: `veh-${Date.now()}` };
    setVehicles((prev) => [created, ...prev]);
    showToast(`Added ${created.name} to fleet.`);
  };

  const handleUpdateVehicle = async (vehicleId: string, patch: Partial<Vehicle>) => {
    if (apiLive) {
      try {
        await updateVehicleInApi(vehicleId, patch);
        await syncFromApi();
        showToast('Vehicle details updated.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
      }
      return;
    }
    setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? { ...v, ...patch } : v)));
    showToast('Vehicle details updated.');
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const target = vehicles.find((v) => v.id === vehicleId);
    if (apiLive) {
      try {
        await deleteVehicleInApi(vehicleId);
        await syncFromApi();
        showToast(`Removed ${target?.name ?? 'vehicle'} from fleet.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
      }
      return;
    }
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    showToast(`Removed ${target?.name ?? 'vehicle'} from fleet.`);
  };

  const handleAddType = async (vt: Omit<VehicleType, 'id'>) => {
    if (apiLive) {
      try {
        await addVehicleTypeInApi(vt);
        await syncFromApi();
        showToast(`Added vehicle type "${vt.name}".`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add type.', 'error');
      }
      return;
    }
    setVehicleTypes((prev) => [...prev, { ...vt, id: `vt-${Date.now()}` }]);
    showToast(`Added vehicle type "${vt.name}".`);
  };

  const handleUpdateType = async (typeId: string, patch: Partial<VehicleType>) => {
    if (apiLive) {
      try {
        await updateVehicleTypeInApi(typeId, patch);
        await syncFromApi();
        showToast('Vehicle type updated.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
      }
      return;
    }
    setVehicleTypes((prev) => prev.map((t) => (t.id === typeId ? { ...t, ...patch } : t)));
    showToast('Vehicle type updated.');
  };

  const handleDeleteType = async (typeId: string) => {
    const inUse = vehicles.some((v) => v.typeId === typeId);
    if (inUse) {
      showToast('Cannot delete type while vehicles are still assigned to it.', 'error');
      return;
    }
    if (apiLive) {
      try {
        await deleteVehicleTypeInApi(typeId);
        await syncFromApi();
        showToast('Vehicle type deleted.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
      }
      return;
    }
    setVehicleTypes((prev) => prev.filter((t) => t.id !== typeId));
    showToast('Vehicle type deleted.');
  };

  const handleAddStation = async (st: Omit<Station, 'id'>) => {
    if (apiLive) {
      try {
        await addStationInApi(st);
        await syncFromApi();
        showToast(`Added station "${st.name}".`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add station.', 'error');
      }
      return;
    }
    setStations((prev) => [...prev, { ...st, id: `st-${Date.now()}` }]);
    showToast(`Added station "${st.name}".`);
  };

  const handleUpdateStation = async (stationId: string, patch: Partial<Station>) => {
    if (apiLive) {
      try {
        await updateStationInApi(stationId, patch);
        await syncFromApi();
        showToast('Station updated.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
      }
      return;
    }
    setStations((prev) => prev.map((s) => (s.id === stationId ? { ...s, ...patch } : s)));
    showToast('Station updated.');
  };

  const handleDeleteStation = async (stationId: string) => {
    const hasDocked = vehicles.some((v) => v.stationId === stationId);
    if (hasDocked) {
      showToast('Move docked vehicles to another station before deleting this station.', 'error');
      return;
    }
    if (apiLive) {
      try {
        await deleteStationInApi(stationId);
        await syncFromApi();
        showToast('Station deleted.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
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
    if (apiLive) {
      try {
        await adminSetReservationStatusInApi(reservationId, status);
        await syncFromApi();
        showToast(`Reservation ${reservationId} marked ${status}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
      }
      return;
    }
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status } : r))
    );
    showToast(`Reservation ${reservationId} marked ${status}.`);
  };

  const handleDeleteReservation = async (reservationId: string) => {
    if (apiLive) {
      try {
        await deleteReservationInApi(reservationId);
        await syncFromApi();
        showToast(`Reservation ${reservationId} removed.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
      }
      return;
    }
    setReservations((prev) => prev.filter((r) => r.id !== reservationId));
    showToast(`Reservation ${reservationId} removed.`);
  };

  const handleCreateUser = async (user: Omit<UserAccount, 'id' | 'createdAt'>) => {
    if (apiLive) {
      try {
        await createUserInApi(user);
        await syncFromApi();
        showToast(`Created ${user.role} account for ${user.name}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create user.', 'error');
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
    if (apiLive) {
      try {
        await updateUserRoleInApi(userId, nextRole);
        await syncFromApi();
        showToast(`Updated user role to ${nextRole}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Role update failed.', 'error');
      }
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    showToast(`Updated user role to ${nextRole}.`);
  };

  const handleToggleUserActive = async (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (apiLive) {
      try {
        await updateUserActiveInApi(userId, !target.active);
        await syncFromApi();
        showToast(target.active ? `Suspended ${target.name}.` : `Reactivated ${target.name}.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
      }
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)));
    showToast(target.active ? `Suspended ${target.name}.` : `Reactivated ${target.name}.`);
  };

  const handleDeleteUser = async (userId: string) => {
    if (apiLive) {
      try {
        await deleteUserInApi(userId);
        await syncFromApi();
        showToast('User account deleted.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
      }
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    showToast('User account deleted.');
  };

  const handleResetSystemData = () => {
    if (apiLive) {
      void syncFromApi();
      showToast('Synced latest state from .NET 10 PostgreSQL API.');
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
  const showTelemetry = activeTab !== 'admin' && activeTab !== 'my-rides';

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

      {syncStatus === 'connecting' && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-3 z-40 flex items-center gap-2 rounded-full border border-[#DDE4EE] bg-white/95 px-3 py-1.5 text-[11px] font-medium text-[#5A6A82] shadow-sm backdrop-blur ${
            showTelemetry ? 'right-4 xl:right-[144px]' : 'right-4'
          }`}
        >
          <Loader2 className="h-3 w-3 animate-spin text-[#0A1A33]" />
          Connecting to Rydio server…
        </div>
      )}

      <main className={showTelemetry ? 'lg:pl-[196px] xl:pr-[128px]' : 'lg:pl-[196px]'}>
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
            onBrowseCatalog={() => setActiveTab('catalog')}
            onPickUp={(id) => void handlePickUp(id)}
            onOpenReturn={(res) => setReturningReservation(res)}
            onCancel={(id) => void handleCancelReservation(id)}
          />
        )}

        {activeTab === 'admin' && isPrivileged && currentUser && (
          <AdminPage
            currentUser={currentUser}
            apiLive={apiLive}
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
            onUpdateType={(id, p) => void handleUpdateType(id, p)}
            onDeleteType={(id) => void handleDeleteType(id)}
            onAddStation={(st) => void handleAddStation(st)}
            onUpdateStation={(id, p) => void handleUpdateStation(id, p)}
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

        {activeTab === 'admin' && (!isPrivileged || !currentUser) && (
          <div className="mx-auto max-w-[680px] px-6 py-24 text-center">
            <h1 className="font-display text-2xl font-light text-[#0A1A33]">
              Administrator access required
            </h1>
            <p className="mt-2 text-sm text-[#5A6A82]">
              Sign in with an Admin or SuperAdmin account to manage fleet vehicles, stations, and
              revenue reports.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAuthModalMode('login')}
                className="rounded-md bg-[#0A1A33] px-5 py-2.5 text-xs font-medium tracking-[0.12em] text-white transition hover:bg-[#13294B]"
              >
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="rounded-md border border-[#DDE4EE] bg-white px-5 py-2.5 text-xs font-medium tracking-[0.12em] text-[#0A1A33] transition hover:border-[#0A1A33]"
              >
                BACK TO HOME
              </button>
            </div>
          </div>
        )}
      </main>

      {showTelemetry && (
        <RightTelemetry
          windowDurationLabel={windowDurationLabel}
          windowFreeCount={windowFreeCount}
          selectedStationLabel={selectedStationLabel}
          activeRidesCount={activeRidesCount}
        />
      )}

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          useRemoteApi={apiLive}
          users={users}
          onApiAuthSuccess={handleApiAuthSuccess}
          onLocalLoginSuccess={handleLocalLoginSuccess}
          onLocalRegisterSuccess={handleLocalRegisterSuccess}
          onClose={() => {
            setAuthModalMode(null);
            restorePendingBooking();
          }}
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
          onRequireAuth={(mode) => {
            pendingBookingVehicleRef.current = bookingVehicle;
            setBookingVehicle(null);
            setAuthModalMode(mode);
          }}
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

      <div
        role={toast?.tone === 'error' ? 'alert' : 'status'}
        aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={`pointer-events-none fixed bottom-6 z-50 ${
          showTelemetry ? 'right-6 xl:right-[144px]' : 'right-6'
        }`}
      >
        {toast && (
          <div
            className={`pointer-events-auto flex items-center gap-2.5 rounded-md border px-4 py-3 text-xs font-medium text-white shadow-xl ${
              toast.tone === 'error'
                ? 'border-[#991B1B] bg-[#991B1B]'
                : 'border-[#0A1A33] bg-[#0A1A33]'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-white/90" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#C4D2E8]" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
