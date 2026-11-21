import { supabase } from '../lib/supabase';
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

// DB Row Mappers (snake_case <-> camelCase)
function mapStation(row: Record<string, unknown>): Station {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    district: String(row.district),
    address: String(row.address),
    capacity: Number(row.capacity),
  };
}

function mapVehicleType(row: Record<string, unknown>): VehicleType {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    defaultHourlyRateMkd: Number(row.default_hourly_rate_mkd),
    fullDayDiscountPercent: Number(row.full_day_discount_percent),
  };
}

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    typeId: String(row.type_id),
    stationId: String(row.station_id),
    hourlyRateMkd: Number(row.hourly_rate_mkd),
    fullDayRateMkd: Number(row.full_day_rate_mkd),
    batteryPercent: Number(row.battery_percent),
    rangeKm: Number(row.range_km),
    maxSpeedKmh: Number(row.max_speed_kmh),
    inMaintenance: Boolean(row.in_maintenance),
    featured: Boolean(row.featured),
  };
}

function mapReservation(row: Record<string, unknown>): Reservation {
  return {
    id: String(row.id),
    vehicleId: String(row.vehicle_id),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    pickupStationId: String(row.pickup_station_id),
    returnStationId: row.return_station_id ? String(row.return_station_id) : undefined,
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    actualReturnTime: row.actual_return_time ? String(row.actual_return_time) : undefined,
    status: String(row.status) as ReservationStatus,
    basePriceMkd: Number(row.base_price_mkd),
    discountAppliedMkd: Number(row.discount_applied_mkd),
    latePenaltyMkd: Number(row.late_penalty_mkd),
    totalPriceMkd: Number(row.total_price_mkd),
    createdAt: String(row.created_at),
  };
}

function mapProfile(row: Record<string, unknown>): UserAccount {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    password: '',
    role: String(row.role) as AccountRole,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

export interface BootstrapPayload {
  stations: Station[];
  vehicleTypes: VehicleType[];
  vehicles: Vehicle[];
  reservations: Reservation[];
  busyWindows: { vehicleId: string; startTime: string; endTime: string; status: ReservationStatus }[];
  users: UserAccount[];
  monthlyRevenue: MonthlyRevenuePoint[];
  currentUser: UserAccount | null;
}

export async function fetchBootstrapData(): Promise<BootstrapPayload | null> {
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user ?? null;

  let currentUser: UserAccount | null = null;
  if (authUser) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileRow) {
      currentUser = mapProfile(profileRow);
    }
  }

  const [stationsRes, typesRes, vehiclesRes, busyRes] = await Promise.all([
    supabase.from('stations').select('*').order('code'),
    supabase.from('vehicle_types').select('*').order('name'),
    supabase.from('vehicles').select('*').order('code'),
    supabase.rpc('get_busy_windows'),
  ]);

  if (stationsRes.error || typesRes.error || vehiclesRes.error) {
    throw new Error(
      stationsRes.error?.message ||
        typesRes.error?.message ||
        vehiclesRes.error?.message ||
        'Failed to load fleet data from Supabase'
    );
  }

  const busyWindows = Array.isArray(busyRes.data)
    ? busyRes.data.map((row: Record<string, unknown>) => ({
        vehicleId: String(row.vehicle_id),
        startTime: String(row.start_time),
        endTime: String(row.end_time),
        status: String(row.status) as ReservationStatus,
      }))
    : [];

  let reservations: Reservation[] = [];
  let users: UserAccount[] = [];
  let monthlyRevenue: MonthlyRevenuePoint[] = [];

  if (currentUser) {
    const resQuery = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    if (!resQuery.error && resQuery.data) {
      reservations = resQuery.data.map(mapReservation);
    }

    if (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin') {
      const [profilesRes, revRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('monthly_revenue_history').select('*').order('sort_order'),
      ]);
      if (!profilesRes.error && profilesRes.data) {
        users = profilesRes.data.map(mapProfile);
      }
      if (!revRes.error && revRes.data) {
        monthlyRevenue = revRes.data.map((r: Record<string, unknown>) => ({
          month: String(r.month),
          revenueMkd: Number(r.revenue_mkd),
          rides: Number(r.rides),
        }));
      }
    }
  }

  return {
    stations: (stationsRes.data ?? []).map(mapStation),
    vehicleTypes: (typesRes.data ?? []).map(mapVehicleType),
    vehicles: (vehiclesRes.data ?? []).map(mapVehicle),
    reservations,
    busyWindows,
    users,
    monthlyRevenue,
    currentUser,
  };
}

// AUTH
export async function signInWithSupabase(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUpWithSupabase(name: string, email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);
  return { needsEmailConfirm: !data.session };
}

export async function signOutFromSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// RESERVATIONS
export async function createReservationInDb(payload: {
  id: string;
  vehicleId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  pickupStationId: string;
  startTime: string;
  endTime: string;
  basePriceMkd: number;
  discountAppliedMkd: number;
  totalPriceMkd: number;
}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('reservations').insert({
    id: payload.id,
    vehicle_id: payload.vehicleId,
    user_id: payload.userId,
    customer_name: payload.customerName,
    customer_email: payload.customerEmail,
    pickup_station_id: payload.pickupStationId,
    start_time: payload.startTime,
    end_time: payload.endTime,
    status: 'Reserved',
    base_price_mkd: payload.basePriceMkd,
    discount_applied_mkd: payload.discountAppliedMkd,
    late_penalty_mkd: 0,
    total_price_mkd: payload.totalPriceMkd,
  });
  if (error) throw new Error(error.message);
}

export async function pickUpReservationInDb(reservationId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'Active' })
    .eq('id', reservationId);
  if (error) throw new Error(error.message);
}

export async function returnReservationInDb(payload: {
  reservationId: string;
  returnStationId: string;
  actualReturnTime: string;
}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('complete_reservation_return', {
    p_reservation_id: payload.reservationId,
    p_return_station_id: payload.returnStationId,
    p_actual_return_time: payload.actualReturnTime,
  });
  if (error) throw new Error(error.message);
}

export async function cancelReservationInDb(reservationId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('cancel_customer_reservation', {
    p_reservation_id: reservationId,
  });
  if (error) throw new Error(error.message);
}

export async function adminSetReservationStatusInDb(
  reservationId: string,
  status: ReservationStatus
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', reservationId);
  if (error) throw new Error(error.message);
}

export async function deleteReservationInDb(reservationId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
  if (error) throw new Error(error.message);
}

// ADMIN FLEET CRUD
export async function addVehicleInDb(vehicle: Vehicle) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('vehicles').insert({
    id: vehicle.id,
    code: vehicle.code,
    name: vehicle.name,
    type_id: vehicle.typeId,
    station_id: vehicle.stationId,
    hourly_rate_mkd: vehicle.hourlyRateMkd,
    full_day_rate_mkd: vehicle.fullDayRateMkd,
    battery_percent: vehicle.batteryPercent,
    range_km: vehicle.rangeKm,
    max_speed_kmh: vehicle.maxSpeedKmh,
    in_maintenance: vehicle.inMaintenance,
    featured: Boolean(vehicle.featured),
  });
  if (error) throw new Error(error.message);
}

export async function updateVehicleInDb(vehicleId: string, patch: Partial<Vehicle>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const dbPatch: Record<string, unknown> = {};
  if (patch.stationId !== undefined) dbPatch.station_id = patch.stationId;
  if (patch.hourlyRateMkd !== undefined) dbPatch.hourly_rate_mkd = patch.hourlyRateMkd;
  if (patch.fullDayRateMkd !== undefined) dbPatch.full_day_rate_mkd = patch.fullDayRateMkd;
  if (patch.batteryPercent !== undefined) dbPatch.battery_percent = patch.batteryPercent;
  if (patch.inMaintenance !== undefined) dbPatch.in_maintenance = patch.inMaintenance;

  const { error } = await supabase.from('vehicles').update(dbPatch).eq('id', vehicleId);
  if (error) throw new Error(error.message);
}

export async function deleteVehicleInDb(vehicleId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
  if (error) throw new Error(error.message);
}

export async function addVehicleTypeInDb(vt: VehicleType) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('vehicle_types').insert({
    id: vt.id,
    name: vt.name,
    description: vt.description,
    default_hourly_rate_mkd: vt.defaultHourlyRateMkd,
    full_day_discount_percent: vt.fullDayDiscountPercent,
  });
  if (error) throw new Error(error.message);
}

export async function deleteVehicleTypeInDb(typeId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('vehicle_types').delete().eq('id', typeId);
  if (error) throw new Error(error.message);
}

export async function addStationInDb(station: Station) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('stations').insert({
    id: station.id,
    code: station.code,
    name: station.name,
    district: station.district,
    address: station.address,
    capacity: station.capacity,
  });
  if (error) throw new Error(error.message);
}

export async function deleteStationInDb(stationId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('stations').delete().eq('id', stationId);
  if (error) throw new Error(error.message);
}

// SUPERADMIN PROFILE MANAGEMENT
export async function updateProfileRoleInDb(userId: string, role: AccountRole) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function toggleProfileActiveInDb(userId: string, active: boolean) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('profiles').update({ active }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function deleteProfileInDb(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw new Error(error.message);
}
