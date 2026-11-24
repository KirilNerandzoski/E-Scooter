import type {
  AccountRole,
  MonthlyRevenuePoint,
  Reservation,
  ReservationStatus,
  Station,
  UserAccount,
  Vehicle,
  VehicleType,
} from '../types/rydio';

const ENV_API = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');
// In production served directly by .NET 10 (same origin), use relative /api paths.
const API_BASE = ENV_API || (import.meta.env.PROD ? '' : '');
const TOKEN_KEY = 'rydio_jwt_token_v1';

export const isApiConfigured = Boolean(ENV_API) || import.meta.env.PROD;

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured) throw new Error('API URL not configured.');
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error('Service unreachable — check your connection or wait a moment and retry.');
  }

  if (!res.ok) {
    let message =
      res.status === 401
        ? 'Your session has expired. Please sign in again.'
        : res.status === 403
          ? 'You do not have permission to perform this action.'
          : res.status === 409
            ? 'Duplicate entry conflicts with an existing record.'
            : `Service request failed (${res.status}).`;

    try {
      const body = (await res.json()) as {
        message?: string;
        detail?: string;
        title?: string;
        errors?: Record<string, string[]>;
      };
      if (body.message) {
        message = body.message;
      } else if (body.errors) {
        const firstErr = Object.values(body.errors).flat()[0];
        if (firstErr) message = firstErr;
      } else if (body.detail) {
        message = body.detail;
      } else if (body.title && !body.title.startsWith('One or more validation')) {
        message = body.title;
      }
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface BootstrapPayload {
  stations: Station[];
  vehicleTypes: VehicleType[];
  vehicles: Vehicle[];
  reservations: Reservation[];
  busyWindows: {
    vehicleId: string;
    startTime: string;
    endTime: string;
    status: ReservationStatus;
  }[];
  users: UserAccount[];
  monthlyRevenue: MonthlyRevenuePoint[];
  currentUser: UserAccount | null;
}

export async function fetchBootstrapData(): Promise<BootstrapPayload | null> {
  if (!isApiConfigured) return null;
  return apiFetch<BootstrapPayload>('/api/catalog/bootstrap');
}

// AUTH
export async function loginWithApi(email: string, password: string): Promise<UserAccount> {
  const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setStoredToken(res.token);
  return res.user;
}

export async function registerWithApi(
  name: string,
  email: string,
  password: string
): Promise<UserAccount> {
  const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setStoredToken(res.token);
  return res.user;
}

export function logoutFromApi() {
  setStoredToken(null);
}

// RESERVATIONS
export async function createReservationInApi(payload: {
  vehicleId: string;
  startTime: string;
  endTime: string;
}) {
  return apiFetch<Reservation>('/api/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function pickUpReservationInApi(reservationId: string) {
  return apiFetch<Reservation>(`/api/reservations/${reservationId}/pickup`, {
    method: 'POST',
  });
}

export async function returnReservationInApi(payload: {
  reservationId: string;
  returnStationId: string;
  actualReturnTime: string;
}) {
  return apiFetch<Reservation>(`/api/reservations/${payload.reservationId}/return`, {
    method: 'POST',
    body: JSON.stringify({
      returnStationId: payload.returnStationId,
      actualReturnTime: payload.actualReturnTime,
    }),
  });
}

export async function cancelReservationInApi(reservationId: string) {
  return apiFetch<Reservation>(`/api/reservations/${reservationId}/cancel`, {
    method: 'POST',
  });
}

// ADMIN FLEET & RESERVATIONS
export async function addVehicleInApi(vehicle: Omit<Vehicle, 'id'>) {
  return apiFetch<Vehicle>('/api/admin/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicle),
  });
}

export async function updateVehicleInApi(vehicleId: string, patch: Partial<Vehicle>) {
  return apiFetch<Vehicle>(`/api/admin/vehicles/${vehicleId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteVehicleInApi(vehicleId: string) {
  return apiFetch<void>(`/api/admin/vehicles/${vehicleId}`, { method: 'DELETE' });
}

export async function addVehicleTypeInApi(vt: Omit<VehicleType, 'id'>) {
  return apiFetch<VehicleType>('/api/admin/types', {
    method: 'POST',
    body: JSON.stringify(vt),
  });
}

export async function updateVehicleTypeInApi(typeId: string, patch: Partial<VehicleType>) {
  return apiFetch<VehicleType>(`/api/admin/types/${typeId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteVehicleTypeInApi(typeId: string) {
  return apiFetch<void>(`/api/admin/types/${typeId}`, { method: 'DELETE' });
}

export async function addStationInApi(station: Omit<Station, 'id'>) {
  return apiFetch<Station>('/api/admin/stations', {
    method: 'POST',
    body: JSON.stringify(station),
  });
}

export async function updateStationInApi(stationId: string, patch: Partial<Station>) {
  return apiFetch<Station>(`/api/admin/stations/${stationId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteStationInApi(stationId: string) {
  return apiFetch<void>(`/api/admin/stations/${stationId}`, { method: 'DELETE' });
}

export async function adminSetReservationStatusInApi(
  reservationId: string,
  status: ReservationStatus
) {
  return apiFetch<Reservation>(`/api/admin/reservations/${reservationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteReservationInApi(reservationId: string) {
  return apiFetch<void>(`/api/admin/reservations/${reservationId}`, { method: 'DELETE' });
}

// SUPERADMIN USERS
export async function createUserInApi(user: Omit<UserAccount, 'id' | 'createdAt'>) {
  return apiFetch<UserAccount>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function updateUserRoleInApi(userId: string, role: AccountRole) {
  return apiFetch<UserAccount>(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function updateUserActiveInApi(userId: string, active: boolean) {
  return apiFetch<UserAccount>(`/api/admin/users/${userId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

export async function deleteUserInApi(userId: string) {
  return apiFetch<void>(`/api/admin/users/${userId}`, { method: 'DELETE' });
}
