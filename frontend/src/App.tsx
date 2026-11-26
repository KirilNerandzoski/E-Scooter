import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { LeftRail, type NavTab } from './components/LeftRail';
import { RightTelemetry } from './components/RightTelemetry';
import { ReservationModal } from './components/ReservationModal';
import { ReturnModal, type ReturnSettlementResult } from './components/ReturnModal';
import { AuthModal } from './components/AuthModal';
import { HelpModal } from './components/HelpModal';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { StationsPage } from './pages/StationsPage';
import { MyRidesPage } from './pages/MyRidesPage';
import {
  INITIAL_RESERVATIONS,
  INITIAL_STATIONS,
  INITIAL_USERS,
  INITIAL_VEHICLE_TYPES,
  INITIAL_VEHICLES,
} from './data/seedData';
import type {
  AccountRole,
  MonthlyRevenuePoint,
  RbacPermission,
  Reservation,
  ReservationStatus,
  Station,
  UserAccount,
  Vehicle,
  VehicleType,
} from './types/rydio';
import {
  canAccessAdminPanel,
  hasPermission,
  isPrimarySuperAdminEmail,
  normalizeUserRole,
  sanitizeUsersRbac,
} from './utils/rbac';
import {
  buildMonthlyRevenue,
  calculateLatePenalty,
  canCancelReservation,
  createClientReservationId,
  formatWindowDuration,
  getPickupEligibility,
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

const AdminPage = lazy(() => import('./pages/AdminPage'));

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

  // Tracks when station filter was applied transiently via Stations -> "Browse Station Fleet"
  const stationDrilldownRef = useRef(false);

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

  const handleManualStationChange = useCallback((stationId: string) => {
    stationDrilldownRef.current = false;
    setFilterStationId(stationId);
  }, []);

  const setActiveTab = useCallback((next: NavTab) => {
    if (next !== 'catalog' && stationDrilldownRef.current) {
      stationDrilldownRef.current = false;
      setFilterStationId('');
    }
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
      const next = readTabFromHash();
      if (next !== 'catalog' && stationDrilldownRef.current) {
        stationDrilldownRef.current = false;
        setFilterStationId('');
      }
      setActiveTabState(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [localUsers, setLocalUsers] = useState<UserAccount[]>(() =>
    sanitizeUsersRbac(loadState('rydio_users_v1', INITIAL_USERS))
  );
  const [apiUsers, setApiUsers] = useState<UserAccount[]>([]);
  const [apiRegisteredUsersCount, setApiRegisteredUsersCount] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadState<string | null>('rydio_session_uid_v1', null)
  );
  const [apiCurrentUser, setApiCurrentUser] = useState<UserAccount | null>(null);
  const [bootNowMs] = useState(() => Date.now());

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
  const [apiMonthlyRevenue, setApiMonthlyRevenue] = useState<MonthlyRevenuePoint[]>([]);

  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);
  const [bookingWindowOverride, setBookingWindowOverride] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const pendingBookingVehicleRef = useRef<{
    vehicle: Vehicle;
    override: { start: string; end: string } | null;
  } | null>(null);
  const [returningReservation, setReturningReservation] = useState<Reservation | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const handleResetFiltersAndWindow = useCallback(() => {
    stationDrilldownRef.current = false;
    setFilterTypeId('');
    setFilterStationId('');
    const now = new Date();
    const start = new Date(now.getTime() + 15 * 60 * 1000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    setFilterStart(toLocalDateTimeInput(start));
    setFilterEnd(toLocalDateTimeInput(end));
  }, []);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(
      () => {
        setToast(null);
        toastTimerRef.current = null;
      },
      tone === 'error' ? 4800 : 3600
    );
  }, []);

  const syncFromApi = useCallback(async () => {
    if (!isApiConfigured) {
      await Promise.resolve();
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
      setApiCurrentUser(
        data.currentUser
          ? {
              ...data.currentUser,
              role: normalizeUserRole(data.currentUser.email, data.currentUser.role),
            }
          : null
      );
      setApiUsers(sanitizeUsersRbac(data.users));
      setApiRegisteredUsersCount(data.registeredUsersCount ?? data.users.length);
      setApiMonthlyRevenue(data.monthlyRevenue);
      setApiLive(true);
      setSyncStatus('live');
    } catch {
      setApiLive(false);
      setSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (!isApiConfigured) return;
    let active = true;
    void fetchBootstrapData()
      .then((data) => {
        if (!active) return;
        if (!data) {
          setSyncStatus('offline');
          return;
        }
        setStations(data.stations);
        setVehicleTypes(data.vehicleTypes);
        setVehicles(data.vehicles);
        setReservations(data.reservations);
        setBusyWindows(data.busyWindows);
        setApiCurrentUser(
          data.currentUser
            ? {
                ...data.currentUser,
                role: normalizeUserRole(data.currentUser.email, data.currentUser.role),
              }
            : null
        );
        setApiUsers(sanitizeUsersRbac(data.users));
        setApiRegisteredUsersCount(data.registeredUsersCount ?? data.users.length);
        setApiMonthlyRevenue(data.monthlyRevenue);
        setApiLive(true);
        setSyncStatus('live');
      })
      .catch(() => {
        if (!active) return;
        setApiLive(false);
        setSyncStatus('offline');
      });
    return () => {
      active = false;
    };
  }, []);

  const users = useMemo(
    () => (apiLive ? apiUsers : localUsers),
    [apiLive, apiUsers, localUsers]
  );

  const registeredUsersCount = useMemo(
    () => (apiLive ? (apiRegisteredUsersCount ?? apiUsers.length) : localUsers.length),
    [apiLive, apiRegisteredUsersCount, apiUsers.length, localUsers.length]
  );

  const currentUser = useMemo(() => {
    if (apiLive) return apiCurrentUser;
    return localUsers.find((u) => u.id === currentUserId && u.active) ?? null;
  }, [apiLive, apiCurrentUser, localUsers, currentUserId]);

  const monthlyRevenue = useMemo<MonthlyRevenuePoint[]>(() => {
    if (apiLive && apiMonthlyRevenue.length > 0) return apiMonthlyRevenue;
    return buildMonthlyRevenue(reservations);
  }, [apiLive, apiMonthlyRevenue, reservations]);

  useEffect(() => {
    if (apiLive) return;
    window.localStorage.setItem('rydio_users_v1', JSON.stringify(localUsers));
    window.localStorage.setItem('rydio_session_uid_v1', JSON.stringify(currentUserId));
    window.localStorage.setItem('rydio_stations_v1', JSON.stringify(stations));
    window.localStorage.setItem('rydio_types_v1', JSON.stringify(vehicleTypes));
    window.localStorage.setItem('rydio_vehicles_v1', JSON.stringify(vehicles));
    window.localStorage.setItem('rydio_reservations_v1', JSON.stringify(reservations));
  }, [apiLive, localUsers, currentUserId, stations, vehicleTypes, vehicles, reservations]);

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Service action failed unexpectedly.';
      showToast(msg, 'error');
    };

    const onWindowError = (event: ErrorEvent) => {
      if (!event.message || event.message.includes('ResizeObserver')) return;
      showToast(event.message, 'error');
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [showToast]);

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

  const openBookingModal = useCallback(
    (vehicle: Vehicle, overrideWindow?: { start: string; end: string }) => {
      setBookingWindowOverride(overrideWindow ?? null);
      setBookingVehicle(vehicle);
    },
    []
  );

  const restorePendingBooking = useCallback(() => {
    const pending = pendingBookingVehicleRef.current;
    if (pending) {
      pendingBookingVehicleRef.current = null;
      setBookingWindowOverride(pending.override);
      setBookingVehicle(pending.vehicle);
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
    setLocalUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setAuthModalMode(null);
    restorePendingBooking();
    showToast(`Welcome to Rydio, ${newUser.name}!`);
  };

  const handleLogout = async () => {
    if (apiLive) {
      logoutFromApi();
      setApiCurrentUser(null);
      setApiUsers([]);
      setApiRegisteredUsersCount(null);
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

    const fallbackDate = new Date(bootNowMs);
    const checkStart = hasValidWindow ? startIso : fallbackDate.toISOString();
    const checkEnd = hasValidWindow
      ? endIso
      : new Date(bootNowMs + 60 * 60 * 1000).toISOString();

    return vehicles.filter((v) =>
      isVehicleAvailable(v, availabilityReservations, checkStart, checkEnd, fallbackDate)
    ).length;
  }, [vehicles, availabilityReservations, filterStart, filterEnd, bootNowMs]);

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
        ((r.userId && r.userId === currentUser.id) ||
          r.customerEmail.toLowerCase() === currentUser.email.toLowerCase()) &&
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

    const pickupStationName =
      stations.find((s) => s.id === vehicle.stationId)?.name ?? 'Skopje Station';

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
        setBookingWindowOverride(null);
        setBookingVehicle(null);
        setActiveTab('my-rides');
        showToast(`Reserved ${vehicle.name} from ${pickupStationName} (${created.id}).`);
        return true;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Could not create reservation.',
          'error'
        );
        return false;
      }
    }

    if (!isVehicleAvailable(vehicle, reservations, payload.startTime, payload.endTime)) {
      showToast('This vehicle already has an overlapping reservation in that window.', 'error');
      return false;
    }

    const newRes: Reservation = {
      id: createClientReservationId(),
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
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
    setBookingWindowOverride(null);
    setBookingVehicle(null);
    setActiveTab('my-rides');
    showToast(`Reserved ${vehicle.name} from ${pickupStationName} (${newRes.id}).`);
    return true;
  };

  const handlePickUp = async (reservationId: string): Promise<void> => {
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

    const target = reservations.find((r) => r.id === reservationId);
    if (!target) return;
    const isAdminOverride = hasPermission(currentUser, 'reservations:manage');
    const eligibility = getPickupEligibility(target, isAdminOverride, new Date(), reservations);
    if (!eligibility.canPickUp) {
      showToast(eligibility.reason ?? 'Pickup is not open yet.', 'error');
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
    actualReturnTime?: string;
    latePenaltyMkd: number;
  }): Promise<ReturnSettlementResult> => {
    const stationName = stations.find((s) => s.id === payload.returnStationId)?.name ?? 'station';
    if (apiLive) {
      try {
        const settled = await returnReservationInApi({
          reservationId: payload.reservationId,
          returnStationId: payload.returnStationId,
          actualReturnTime: payload.actualReturnTime,
        });
        await syncFromApi();
        showToast(`Vehicle docked at ${stationName}.`);
        return {
          ok: true,
          latePenaltyMkd: settled.latePenaltyMkd,
          totalPriceMkd: settled.totalPriceMkd,
        };
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Return failed.', 'error');
        return { ok: false };
      }
    }

    const target = reservations.find((r) => r.id === payload.reservationId);
    if (!target) return { ok: false };

    const effectiveIso = payload.actualReturnTime ?? new Date().toISOString();
    setReservations((prev) =>
      prev.map((r) =>
        r.id === payload.reservationId
          ? {
              ...r,
              status: 'Completed',
              returnStationId: payload.returnStationId,
              actualReturnTime: effectiveIso,
              latePenaltyMkd: payload.latePenaltyMkd,
            }
          : r
      )
    );
    if (target.vehicleId) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === target.vehicleId ? { ...v, stationId: payload.returnStationId } : v
        )
      );
    }
    showToast(`Vehicle docked at ${stationName}.`);
    return {
      ok: true,
      latePenaltyMkd: payload.latePenaltyMkd,
      totalPriceMkd: target.totalPriceMkd,
    };
  };

  const handleCancelReservation = async (reservationId: string): Promise<void> => {
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

    const target = reservations.find((r) => r.id === reservationId);
    if (!target) return;
    const isAdminOverride = hasPermission(currentUser, 'reservations:manage');
    if (!isAdminOverride && !canCancelReservation(target)) {
      showToast('Cancellation is only allowed up to 1 hour before start time.', 'error');
      return;
    }

    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: 'Cancelled' } : r))
    );
    showToast(`Reservation ${reservationId} cancelled.`);
  };

  // RBAC guard helper — blocks unauthorized mutations and surfaces crimson toast
  const requirePermission = useCallback(
    (perm: RbacPermission): boolean => {
      if (!hasPermission(currentUser, perm)) {
        showToast(
          'Access denied: your account role does not have permission to modify the website.',
          'error'
        );
        return false;
      }
      return true;
    },
    [currentUser, showToast]
  );

  // Admin & SuperAdmin handlers
  const handleToggleMaintenance = async (vehicleId: string): Promise<void> => {
    if (!requirePermission('fleet:manage')) return;
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

  const handleAddVehicle = async (veh: Omit<Vehicle, 'id'>): Promise<boolean> => {
    if (!requirePermission('fleet:manage')) return false;
    const codeNorm = veh.code.trim().toLowerCase();
    const nameNorm = veh.name.trim().toLowerCase();
    if (vehicles.some((v) => v.code.trim().toLowerCase() === codeNorm)) {
      showToast(`Vehicle code "${veh.code.trim()}" is already in use.`, 'error');
      return false;
    }
    if (
      vehicles.some(
        (v) => v.stationId === veh.stationId && v.name.trim().toLowerCase() === nameNorm
      )
    ) {
      showToast(
        `A vehicle named "${veh.name.trim()}" is already docked at this station.`,
        'error'
      );
      return false;
    }

    if (apiLive) {
      try {
        await addVehicleInApi(veh);
        await syncFromApi();
        showToast(`Added ${veh.name} to fleet.`);
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add vehicle.', 'error');
        return false;
      }
    }
    const created: Vehicle = { ...veh, id: `veh-${Date.now()}` };
    setVehicles((prev) => [created, ...prev]);
    showToast(`Added ${created.name} to fleet.`);
    return true;
  };

  const handleUpdateVehicle = async (
    vehicleId: string,
    patch: Partial<Vehicle>
  ): Promise<boolean> => {
    if (!requirePermission('fleet:manage')) return false;
    if (patch.code) {
      const codeNorm = patch.code.trim().toLowerCase();
      if (vehicles.some((v) => v.id !== vehicleId && v.code.trim().toLowerCase() === codeNorm)) {
        showToast(`Vehicle code "${patch.code.trim()}" is already in use.`, 'error');
        return false;
      }
    }
    if (patch.name) {
      const currentVeh = vehicles.find((v) => v.id === vehicleId);
      const targetStation = patch.stationId ?? currentVeh?.stationId ?? '';
      const nameNorm = patch.name.trim().toLowerCase();
      if (
        vehicles.some(
          (v) =>
            v.id !== vehicleId &&
            v.stationId === targetStation &&
            v.name.trim().toLowerCase() === nameNorm
        )
      ) {
        showToast(
          `A vehicle named "${patch.name.trim()}" is already docked at that station.`,
          'error'
        );
        return false;
      }
    }

    if (apiLive) {
      try {
        await updateVehicleInApi(vehicleId, patch);
        await syncFromApi();
        showToast('Vehicle details updated.');
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
        return false;
      }
    }
    setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? { ...v, ...patch } : v)));
    showToast('Vehicle details updated.');
    return true;
  };

  const handleDeleteVehicle = async (vehicleId: string): Promise<void> => {
    if (!requirePermission('fleet:manage')) return;
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
    const hasActiveBooking = reservations.some(
      (r) => r.vehicleId === vehicleId && (r.status === 'Reserved' || r.status === 'Active')
    );
    if (hasActiveBooking) {
      showToast(
        'Cannot delete a vehicle while it has an active or upcoming reservation.',
        'error'
      );
      return;
    }

    // Preserve historical Completed & Cancelled reservations and their display name
    setReservations((prev) =>
      prev.map((r) =>
        r.vehicleId === vehicleId
          ? {
              ...r,
              vehicleName: r.vehicleName || target?.name || 'Retired Vehicle',
              vehicleId: null,
            }
          : r
      )
    );
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    showToast(`Removed ${target?.name ?? 'vehicle'} from fleet.`);
  };

  const handleAddType = async (vt: Omit<VehicleType, 'id'>): Promise<boolean> => {
    if (!requirePermission('types:manage')) return false;
    const nameNorm = vt.name.trim().toLowerCase();
    if (vehicleTypes.some((t) => t.name.trim().toLowerCase() === nameNorm)) {
      showToast(`Vehicle type "${vt.name.trim()}" already exists.`, 'error');
      return false;
    }

    if (apiLive) {
      try {
        await addVehicleTypeInApi(vt);
        await syncFromApi();
        showToast(`Added vehicle type "${vt.name}".`);
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add type.', 'error');
        return false;
      }
    }
    setVehicleTypes((prev) => [...prev, { ...vt, id: `vt-${Date.now()}` }]);
    showToast(`Added vehicle type "${vt.name}".`);
    return true;
  };

  const handleUpdateType = async (
    typeId: string,
    patch: Partial<VehicleType>
  ): Promise<boolean> => {
    if (!requirePermission('types:manage')) return false;
    if (patch.name) {
      const nameNorm = patch.name.trim().toLowerCase();
      if (
        vehicleTypes.some((t) => t.id !== typeId && t.name.trim().toLowerCase() === nameNorm)
      ) {
        showToast(`Vehicle type "${patch.name.trim()}" already exists.`, 'error');
        return false;
      }
    }

    if (apiLive) {
      try {
        await updateVehicleTypeInApi(typeId, patch);
        await syncFromApi();
        showToast('Vehicle type updated.');
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
        return false;
      }
    }
    setVehicleTypes((prev) => prev.map((t) => (t.id === typeId ? { ...t, ...patch } : t)));
    showToast('Vehicle type updated.');
    return true;
  };

  const handleDeleteType = async (typeId: string): Promise<void> => {
    if (!requirePermission('types:manage')) return;
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

  const handleAddStation = async (st: Omit<Station, 'id'>): Promise<boolean> => {
    if (!requirePermission('stations:manage')) return false;
    const codeNorm = st.code.trim().toLowerCase();
    const nameNorm = st.name.trim().toLowerCase();
    if (stations.some((s) => s.code.trim().toLowerCase() === codeNorm)) {
      showToast(`Station code "${st.code.trim()}" is already in use.`, 'error');
      return false;
    }
    if (stations.some((s) => s.name.trim().toLowerCase() === nameNorm)) {
      showToast(`Station "${st.name.trim()}" already exists.`, 'error');
      return false;
    }

    if (apiLive) {
      try {
        await addStationInApi(st);
        await syncFromApi();
        showToast(`Added station "${st.name}".`);
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add station.', 'error');
        return false;
      }
    }
    setStations((prev) => [...prev, { ...st, id: `st-${Date.now()}` }]);
    showToast(`Added station "${st.name}".`);
    return true;
  };

  const handleUpdateStation = async (
    stationId: string,
    patch: Partial<Station>
  ): Promise<boolean> => {
    if (!requirePermission('stations:manage')) return false;
    if (patch.code) {
      const codeNorm = patch.code.trim().toLowerCase();
      if (stations.some((s) => s.id !== stationId && s.code.trim().toLowerCase() === codeNorm)) {
        showToast(`Station code "${patch.code.trim()}" is already in use.`, 'error');
        return false;
      }
    }
    if (patch.name) {
      const nameNorm = patch.name.trim().toLowerCase();
      if (stations.some((s) => s.id !== stationId && s.name.trim().toLowerCase() === nameNorm)) {
        showToast(`Station "${patch.name.trim()}" already exists.`, 'error');
        return false;
      }
    }

    if (apiLive) {
      try {
        await updateStationInApi(stationId, patch);
        await syncFromApi();
        showToast('Station updated.');
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Update failed.', 'error');
        return false;
      }
    }
    setStations((prev) => prev.map((s) => (s.id === stationId ? { ...s, ...patch } : s)));
    showToast('Station updated.');
    return true;
  };

  const handleDeleteStation = async (stationId: string): Promise<void> => {
    if (!requirePermission('stations:manage')) return;
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
  ): Promise<void> => {
    if (!requirePermission('reservations:manage')) return;
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
    const completedAt = new Date();
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id !== reservationId) return r;
        if (status === 'Completed' && !r.actualReturnTime) {
          const veh = r.vehicleId ? vehicles.find((v) => v.id === r.vehicleId) : undefined;
          const autoPenalty =
            r.latePenaltyMkd === 0 && veh
              ? calculateLatePenalty(veh, r.endTime, completedAt).penaltyMkd
              : r.latePenaltyMkd;
          return {
            ...r,
            status,
            actualReturnTime: completedAt.toISOString(),
            returnStationId: r.returnStationId ?? r.pickupStationId,
            latePenaltyMkd: autoPenalty,
          };
        }
        return { ...r, status };
      })
    );
    showToast(`Reservation ${reservationId} marked ${status}.`);
  };

  const handleDeleteReservation = async (reservationId: string): Promise<void> => {
    if (!requirePermission('reservations:delete')) return;
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

  const handleCreateUser = async (
    user: Omit<UserAccount, 'id' | 'createdAt'>
  ): Promise<boolean> => {
    if (!requirePermission('users:manage')) return false;
    const emailNorm = user.email.trim().toLowerCase();
    if (isPrimarySuperAdminEmail(emailNorm) || user.role === 'SuperAdmin') {
      showToast(
        'Only superadmin@rydio.mk can hold the SuperAdmin role. Assign Customer or Admin.',
        'error'
      );
      return false;
    }
    if (users.some((u) => u.email.trim().toLowerCase() === emailNorm)) {
      showToast(`An account with email "${emailNorm}" already exists.`, 'error');
      return false;
    }

    if (apiLive) {
      try {
        await createUserInApi(user);
        await syncFromApi();
        showToast(`Created ${user.role} account for ${user.name}.`);
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create user.', 'error');
        return false;
      }
    }
    let passwordHash: string | undefined;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(user.password)
      );
      passwordHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    const created: UserAccount = {
      ...user,
      password: '',
      passwordHash,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setLocalUsers((prev) => [...prev, created]);
    showToast(`Created ${created.role} account for ${created.name}.`);
    return true;
  };

  const handleUpdateUserRole = async (userId: string, nextRole: AccountRole): Promise<void> => {
    if (!requirePermission('roles:assign')) return;
    const target = users.find((u) => u.id === userId);
    if (target && isPrimarySuperAdminEmail(target.email)) {
      showToast('The primary SuperAdmin account role cannot be modified.', 'error');
      return;
    }
    if (nextRole === 'SuperAdmin') {
      showToast('Only superadmin@rydio.mk can hold the SuperAdmin role.', 'error');
      return;
    }
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
    setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    showToast(`Updated user role to ${nextRole}.`);
  };

  const handleToggleUserActive = async (userId: string): Promise<void> => {
    if (!requirePermission('users:manage')) return;
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (isPrimarySuperAdminEmail(target.email)) {
      showToast('The primary SuperAdmin account cannot be suspended.', 'error');
      return;
    }
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
    setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)));
    showToast(target.active ? `Suspended ${target.name}.` : `Reactivated ${target.name}.`);
  };

  const handleDeleteUser = async (userId: string): Promise<void> => {
    if (!requirePermission('users:manage')) return;
    const target = users.find((u) => u.id === userId);
    if (target && isPrimarySuperAdminEmail(target.email)) {
      showToast('The primary SuperAdmin account cannot be deleted.', 'error');
      return;
    }
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
    setLocalUsers((prev) => prev.filter((u) => u.id !== userId));
    showToast('User account deleted.');
  };

  const handleResetSystemData = async () => {
    if (!requirePermission('fleet:manage')) return;
    if (apiLive) {
      await syncFromApi();
      showToast('Synced latest state from .NET 10 PostgreSQL API.');
      return;
    }
    setStations(INITIAL_STATIONS);
    setVehicleTypes(INITIAL_VEHICLE_TYPES);
    setVehicles(INITIAL_VEHICLES);
    setReservations(INITIAL_RESERVATIONS);
    setLocalUsers(sanitizeUsersRbac(INITIAL_USERS));
    showToast('System demo data restored to defaults.');
  };

  const returningVehicle =
    returningReservation && returningReservation.vehicleId
      ? vehicles.find((v) => v.id === returningReservation.vehicleId)
      : undefined;

  const isPrivileged = canAccessAdminPanel(currentUser);
  const canSimulateLateReturn = !apiLive || hasPermission(currentUser, 'reservations:manage');
  const showTelemetry = activeTab !== 'admin' && activeTab !== 'my-rides';

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (authModalMode || bookingVehicle || returningReservation || helpOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('home');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('catalog');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('stations');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('my-rides');
        } else if (e.key === '5' && isPrivileged) {
          e.preventDefault();
          setActiveTab('admin');
        }
        return;
      }

      if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [
    authModalMode,
    bookingVehicle,
    returningReservation,
    helpOpen,
    isPrivileged,
    setActiveTab,
  ]);

  return (
    <div className="washi-surface min-h-screen text-indigo-depth">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-indigo-depth focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:tracking-[0.12em] focus:text-surface-pure"
      >
        SKIP TO MAIN CONTENT
      </a>

      <LeftRail
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={(mode) => setAuthModalMode(mode)}
        onOpenHelp={() => setHelpOpen(true)}
        onLogout={() => void handleLogout()}
        activeStationsCount={stations.length}
        freeFleetCount={freeNowCount}
        activeRideCount={myActiveCount}
      />

      {syncStatus === 'connecting' && (
        <>
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 border-b border-mist bg-white/95 px-4 py-1.5 text-[11px] font-medium text-dilute-ink lg:hidden"
          >
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-indigo-depth" />
            <span>Connecting to Rydio server…</span>
          </div>
          <div
            role="status"
            aria-live="polite"
            className={`fixed top-3 z-20 hidden items-center gap-2 rounded-full border border-mist bg-white/95 px-3 py-1.5 text-[11px] font-medium text-dilute-ink shadow-sm backdrop-blur lg:flex ${
              showTelemetry ? 'right-4 xl:right-[144px]' : 'right-4'
            }`}
          >
            <Loader2 className="h-3 w-3 animate-spin text-indigo-depth" />
            Connecting to Rydio server…
          </div>
        </>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={`focus:outline-none ${showTelemetry ? 'lg:pl-[196px] xl:pr-[128px]' : 'lg:pl-[196px]'}`}
      >
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
            onChangeStation={handleManualStationChange}
            onChangeStart={setFilterStart}
            onChangeEnd={setFilterEnd}
            onFindRides={() => setActiveTab('catalog')}
            onViewStations={() => setActiveTab('stations')}
            onResetFilters={handleResetFiltersAndWindow}
            onSelectVehicle={openBookingModal}
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
            onChangeStation={handleManualStationChange}
            onChangeStart={setFilterStart}
            onChangeEnd={setFilterEnd}
            onResetFilters={handleResetFiltersAndWindow}
            onSelectVehicle={openBookingModal}
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
              stationDrilldownRef.current = true;
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
            onPickUp={handlePickUp}
            onOpenReturn={(res) => setReturningReservation(res)}
            onCancel={handleCancelReservation}
          />
        )}

        {activeTab === 'admin' && isPrivileged && currentUser && (
          <Suspense
            fallback={
              <div className="flex min-h-[50vh] items-center justify-center px-6 py-20 text-xs font-medium tracking-[0.14em] text-dilute-ink">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-depth" />
                LOADING OPERATIONS CONSOLE…
              </div>
            }
          >
            <AdminPage
              currentUser={currentUser}
              apiLive={apiLive}
              users={users}
              registeredUsersCount={registeredUsersCount}
              vehicles={vehicles}
              vehicleTypes={vehicleTypes}
              stations={stations}
              reservations={reservations}
              monthlyRevenue={monthlyRevenue}
              onShowError={(msg) => showToast(msg, 'error')}
              onToggleMaintenance={handleToggleMaintenance}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicle={handleUpdateVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              onAddType={handleAddType}
              onUpdateType={handleUpdateType}
              onDeleteType={handleDeleteType}
              onAddStation={handleAddStation}
              onUpdateStation={handleUpdateStation}
              onDeleteStation={handleDeleteStation}
              onAdminSetReservationStatus={handleAdminSetReservationStatus}
              onDeleteReservation={handleDeleteReservation}
              onCreateUser={handleCreateUser}
              onUpdateUserRole={handleUpdateUserRole}
              onToggleUserActive={handleToggleUserActive}
              onDeleteUser={handleDeleteUser}
              onResetSystemData={handleResetSystemData}
            />
          </Suspense>
        )}

        {activeTab === 'admin' && (!isPrivileged || !currentUser) && (
          <div className="mx-auto max-w-[680px] px-4 py-16 text-center sm:px-6 sm:py-24">
            <h1 className="font-display text-2xl font-light text-indigo-depth">
              Restricted by Role-Based Access Control
            </h1>
            <p className="mt-2 text-sm text-dilute-ink">
              {currentUser
                ? `Your account (${currentUser.email}) has the ${currentUser.role} role, which can browse the catalog and manage personal rides only. Website and fleet modifications are restricted.`
                : 'Sign in with the SuperAdmin account to manage fleet vehicles, stations, reservations, and user roles.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!currentUser && (
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="min-h-[42px] rounded-md bg-indigo-depth px-5 py-2.5 text-xs font-medium tracking-[0.12em] text-white transition hover:bg-ink-current"
                >
                  SIGN IN
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="min-h-[42px] rounded-md border border-mist bg-white px-5 py-2.5 text-xs font-medium tracking-[0.12em] text-indigo-depth transition hover:border-indigo-depth"
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
          initialStart={bookingWindowOverride?.start ?? filterStart}
          initialEnd={bookingWindowOverride?.end ?? filterEnd}
          reservations={availabilityReservations}
          currentUser={currentUser}
          onRequireAuth={(mode) => {
            pendingBookingVehicleRef.current = {
              vehicle: bookingVehicle,
              override: bookingWindowOverride,
            };
            setBookingVehicle(null);
            setAuthModalMode(mode);
          }}
          onConfirm={handleConfirmReservation}
          onClose={() => {
            setBookingWindowOverride(null);
            setBookingVehicle(null);
          }}
        />
      )}

      {returningReservation && returningVehicle && (
        <ReturnModal
          reservation={returningReservation}
          vehicle={returningVehicle}
          stations={stations}
          canSimulateLateReturn={canSimulateLateReturn}
          onConfirmReturn={handleConfirmReturn}
          onClose={() => setReturningReservation(null)}
        />
      )}

      {helpOpen && (
        <HelpModal canAccessAdmin={isPrivileged} onClose={() => setHelpOpen(false)} />
      )}

      <div
        role={toast?.tone === 'error' ? 'alert' : 'status'}
        aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={`pb-safe pointer-events-none fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-6 sm:max-w-md ${
          showTelemetry ? 'sm:right-6 xl:right-[144px]' : 'sm:right-6'
        }`}
      >
        {toast && (
          <div
            className={`rydio-toast-enter pointer-events-auto flex items-center gap-2.5 rounded-md border px-4 py-3 text-xs font-medium text-surface-pure shadow-xl ${
              toast.tone === 'error'
                ? 'border-status-danger-text bg-status-danger-text'
                : 'border-indigo-depth bg-indigo-depth'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-surface-pure/90" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-basin-tint" />
            )}
            <span className="flex-1 break-words">{toast.message}</span>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="ml-1 inline-flex min-h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded text-surface-pure/80 hover:text-surface-pure"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
