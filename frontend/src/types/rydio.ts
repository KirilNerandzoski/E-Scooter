export type UserRole = 'Guest' | 'Customer' | 'Admin' | 'SuperAdmin';

export type AccountRole = 'Customer' | 'Admin' | 'SuperAdmin';

export type RbacPermission =
  | 'catalog:read'
  | 'reservations:own'
  | 'reports:view'
  | 'fleet:manage'
  | 'types:manage'
  | 'stations:manage'
  | 'reservations:manage'
  | 'reservations:delete'
  | 'users:manage'
  | 'roles:assign';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: AccountRole;
  permissions?: RbacPermission[];
  active: boolean;
  createdAt: string;
}

export type ReservationStatus = 'Reserved' | 'Active' | 'Completed' | 'Cancelled';

export interface Station {
  id: string;
  code: string;
  name: string;
  district: string;
  address: string;
  capacity: number;
}

export interface VehicleType {
  id: string;
  name: string;
  description: string;
  defaultHourlyRateMkd: number;
  fullDayDiscountPercent: number;
}

export interface Vehicle {
  id: string;
  code: string;
  name: string;
  typeId: string;
  stationId: string;
  hourlyRateMkd: number;
  fullDayRateMkd: number;
  batteryPercent: number;
  rangeKm: number;
  maxSpeedKmh: number;
  inMaintenance: boolean;
  featured?: boolean;
}

export interface Reservation {
  id: string;
  vehicleId: string | null;
  vehicleName?: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  pickupStationId: string;
  returnStationId?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  actualReturnTime?: string; // ISO string
  status: ReservationStatus;
  basePriceMkd: number;
  discountAppliedMkd: number;
  latePenaltyMkd: number;
  totalPriceMkd: number;
  createdAt: string;
}

export interface PriceBreakdown {
  valid: boolean;
  error?: string;
  totalHours: number;
  fullDays: number;
  remainingHours: number;
  basePriceMkd: number;
  discountAppliedMkd: number;
  finalPriceMkd: number;
  hasFullDayDiscount: boolean;
}

export interface MonthlyRevenuePoint {
  month: string;
  sortOrder?: number;
  revenueMkd: number;
  rides: number;
}
