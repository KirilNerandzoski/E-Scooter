-- Rydio (Skopje Electric Scooters & E-Bikes) — Full Supabase PostgreSQL Schema
-- Includes: Profiles & Roles (Customer / Admin / SuperAdmin), Stations, Vehicle Types,
-- Vehicles, Reservations with DB-level overlap exclusion & 7-day max constraint,
-- Atomic RPCs (reserve, pickup, return with 1.5x late penalty, cancel with 1h cutoff),
-- Row-Level Security (RLS), and Skopje seed data.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'Customer' CHECK (role IN ('Customer', 'Admin', 'SuperAdmin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Automatically create a profile row on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text := 'Customer';
  display_name text;
BEGIN
  IF lower(NEW.email) IN ('superadmin@rydio.mk', 'kiril.nerandz99@gmail.com') THEN
    assigned_role := 'SuperAdmin';
  END IF;

  display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, name, email, role, active)
  VALUES (NEW.id, display_name, lower(NEW.email), assigned_role, true)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role helper functions (SECURITY DEFINER avoids recursive RLS lookups)
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('Admin', 'SuperAdmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND active = true
      AND role = 'SuperAdmin'
  );
$$;

-- 2. STATIONS
CREATE TABLE IF NOT EXISTS public.stations (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  district text NOT NULL,
  address text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. VEHICLE TYPES
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  default_hourly_rate_mkd integer NOT NULL CHECK (default_hourly_rate_mkd > 0),
  full_day_discount_percent integer NOT NULL DEFAULT 20 CHECK (full_day_discount_percent BETWEEN 0 AND 90),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. VEHICLES
CREATE TABLE IF NOT EXISTS public.vehicles (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type_id text NOT NULL REFERENCES public.vehicle_types(id) ON DELETE RESTRICT,
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
  hourly_rate_mkd integer NOT NULL CHECK (hourly_rate_mkd > 0),
  full_day_rate_mkd integer NOT NULL CHECK (full_day_rate_mkd > 0),
  battery_percent integer NOT NULL DEFAULT 100 CHECK (battery_percent BETWEEN 0 AND 100),
  range_km integer NOT NULL DEFAULT 45 CHECK (range_km > 0),
  max_speed_kmh integer NOT NULL DEFAULT 25 CHECK (max_speed_kmh > 0),
  in_maintenance boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. RESERVATIONS (with DB-level 7-day max & non-overlapping exclusion constraint)
CREATE TABLE IF NOT EXISTS public.reservations (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  pickup_station_id text NOT NULL REFERENCES public.stations(id),
  return_station_id text REFERENCES public.stations(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  actual_return_time timestamptz,
  status text NOT NULL DEFAULT 'Reserved' CHECK (status IN ('Reserved', 'Active', 'Completed', 'Cancelled')),
  base_price_mkd integer NOT NULL DEFAULT 0,
  discount_applied_mkd integer NOT NULL DEFAULT 0,
  late_penalty_mkd integer NOT NULL DEFAULT 0,
  total_price_mkd integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_valid_window CHECK (end_time > start_time),
  CONSTRAINT reservations_max_7_days CHECK (end_time <= start_time + interval '7 days'),
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('Reserved', 'Active'))
);

-- 6. HISTORICAL MONTHLY REVENUE (for Admin dashboard reporting)
CREATE TABLE IF NOT EXISTS public.monthly_revenue_history (
  month text PRIMARY KEY,
  sort_order integer NOT NULL,
  revenue_mkd integer NOT NULL DEFAULT 0,
  rides integer NOT NULL DEFAULT 0
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_revenue_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "SuperAdmin can update any profile" ON public.profiles;
CREATE POLICY "SuperAdmin can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "SuperAdmin can delete non-self profiles" ON public.profiles;
CREATE POLICY "SuperAdmin can delete non-self profiles"
  ON public.profiles FOR DELETE
  USING (public.is_superadmin() AND id <> auth.uid());

-- Stations policies (public read, admin write)
DROP POLICY IF EXISTS "Anyone can read stations" ON public.stations;
CREATE POLICY "Anyone can read stations"
  ON public.stations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage stations" ON public.stations;
CREATE POLICY "Admins manage stations"
  ON public.stations FOR ALL
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

-- Vehicle types policies (public read, admin write)
DROP POLICY IF EXISTS "Anyone can read vehicle_types" ON public.vehicle_types;
CREATE POLICY "Anyone can read vehicle_types"
  ON public.vehicle_types FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admins manage vehicle_types"
  ON public.vehicle_types FOR ALL
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

-- Vehicles policies (public reads non-maintenance; admins read & manage all)
DROP POLICY IF EXISTS "Public reads active catalog vehicles" ON public.vehicles;
CREATE POLICY "Public reads active catalog vehicles"
  ON public.vehicles FOR SELECT
  USING (in_maintenance = false OR public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "Admins manage vehicles" ON public.vehicles;
CREATE POLICY "Admins manage vehicles"
  ON public.vehicles FOR ALL
  USING (public.is_admin_or_superadmin())
  WITH CHECK (public.is_admin_or_superadmin());

-- Reservations policies
DROP POLICY IF EXISTS "Users read own reservations or admins read all" ON public.reservations;
CREATE POLICY "Users read own reservations or admins read all"
  ON public.reservations FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "Authenticated users create own reservations" ON public.reservations;
CREATE POLICY "Authenticated users create own reservations"
  ON public.reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own reservations or admins update all" ON public.reservations;
CREATE POLICY "Users update own reservations or admins update all"
  ON public.reservations FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin_or_superadmin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin());

DROP POLICY IF EXISTS "SuperAdmin can delete reservations" ON public.reservations;
CREATE POLICY "SuperAdmin can delete reservations"
  ON public.reservations FOR DELETE
  USING (public.is_superadmin());

-- Monthly revenue history (public/admin read)
DROP POLICY IF EXISTS "Admins read monthly revenue" ON public.monthly_revenue_history;
CREATE POLICY "Admins read monthly revenue"
  ON public.monthly_revenue_history FOR SELECT
  USING (public.is_admin_or_superadmin());

-- ============================================================================
-- RPC FUNCTIONS (Business Rules Enforced on Server / PostgreSQL)
-- ============================================================================

-- Public availability windows (returns only vehicle_id + time range, no PII)
CREATE OR REPLACE FUNCTION public.get_busy_windows()
RETURNS TABLE (
  vehicle_id text,
  start_time timestamptz,
  end_time timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.vehicle_id, r.start_time, r.end_time, r.status
  FROM public.reservations r
  WHERE r.status IN ('Reserved', 'Active');
$$;

-- Atomic vehicle return with 1.5x late penalty + station relocation
CREATE OR REPLACE FUNCTION public.complete_reservation_return(
  p_reservation_id text,
  p_return_station_id text,
  p_actual_return_time timestamptz DEFAULT now()
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.reservations;
  v_veh public.vehicles;
  v_overdue_secs double precision;
  v_late_hours integer := 0;
  v_penalty integer := 0;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_res.user_id <> auth.uid() AND NOT public.is_admin_or_superadmin() THEN
    RAISE EXCEPTION 'Not authorized to return this reservation';
  END IF;

  IF v_res.status <> 'Active' THEN
    RAISE EXCEPTION 'Only Active reservations can be returned';
  END IF;

  SELECT * INTO v_veh FROM public.vehicles WHERE id = v_res.vehicle_id;

  v_overdue_secs := EXTRACT(EPOCH FROM (p_actual_return_time - v_res.end_time));
  IF v_overdue_secs > 0 THEN
    v_late_hours := CEIL(v_overdue_secs / 3600.0);
    v_penalty := ROUND(v_late_hours * v_veh.hourly_rate_mkd * 1.5);
  END IF;

  UPDATE public.reservations
  SET
    status = 'Completed',
    return_station_id = p_return_station_id,
    actual_return_time = p_actual_return_time,
    late_penalty_mkd = v_penalty
  WHERE id = p_reservation_id
  RETURNING * INTO v_res;

  UPDATE public.vehicles
  SET station_id = p_return_station_id
  WHERE id = v_res.vehicle_id;

  RETURN v_res;
END;
$$;

-- Customer cancellation enforcing the 1-hour cutoff
CREATE OR REPLACE FUNCTION public.cancel_customer_reservation(p_reservation_id text)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.reservations;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF v_res.user_id <> auth.uid() AND NOT public.is_admin_or_superadmin() THEN
    RAISE EXCEPTION 'Not authorized to cancel this reservation';
  END IF;

  IF v_res.status <> 'Reserved' THEN
    RAISE EXCEPTION 'Only Reserved bookings can be cancelled';
  END IF;

  IF NOT public.is_admin_or_superadmin() AND (v_res.start_time - now()) < interval '1 hour' THEN
    RAISE EXCEPTION 'Cancellation is only permitted up to 1 hour before start time';
  END IF;

  UPDATE public.reservations
  SET status = 'Cancelled'
  WHERE id = p_reservation_id
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

-- ============================================================================
-- SEED DATA (Skopje Stations, Vehicle Types, Fleet, Historical Revenue)
-- ============================================================================
INSERT INTO public.stations (id, code, name, district, address, capacity) VALUES
  ('st-plostad', 'SKP-01', 'Plostad Makedonija', 'Centar', 'Kej 13 Noemvri, Riverfront Dock', 14),
  ('st-park', 'SKP-02', 'Gradski Park', 'Centar', 'Ilinden Blvd, Main Park Gate', 12),
  ('st-debar', 'SKP-03', 'Debar Maalo', 'Centar', 'Boemska St, North Plaza', 10),
  ('st-eastgate', 'SKP-04', 'East Gate', 'Gazi Baba', 'Belasica 2, West Mobility Hub', 12),
  ('st-karpos', 'SKP-05', 'Karpos 3', 'Karpos', 'Partizanski Odredi, City Mall Bay', 10),
  ('st-aerodrom', 'SKP-06', 'Aerodrom', 'Aerodrom', 'Jane Sandanski Blvd, Capitol Bay', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vehicle_types (id, name, description, default_hourly_rate_mkd, full_day_discount_percent) VALUES
  ('vt-scooter', 'E-Scooter', 'Lightweight urban commuter electric scooter for swift city hops.', 180, 20),
  ('vt-ebike', 'E-Bike', 'Pedal-assist electric city bicycle built for longer riverfront rides.', 220, 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vehicles (id, code, name, type_id, station_id, hourly_rate_mkd, full_day_rate_mkd, battery_percent, range_km, max_speed_kmh, in_maintenance, featured) VALUES
  ('veh-s1-pro', 'RYD-S01', 'Rydio S1 Pro', 'vt-scooter', 'st-plostad', 180, 950, 96, 48, 25, false, true),
  ('veh-city-ebike', 'RYD-B01', 'Rydio City E-Bike', 'vt-ebike', 'st-park', 220, 1200, 92, 65, 25, false, false),
  ('veh-lite-01', 'RYD-S02', 'Rydio Lite Scooter', 'vt-scooter', 'st-debar', 150, 800, 89, 35, 22, false, false),
  ('veh-cargo-ebike', 'RYD-B02', 'Rydio Cargo E-Bike', 'vt-ebike', 'st-eastgate', 260, 1450, 84, 58, 25, false, false),
  ('veh-s1-air', 'RYD-S03', 'Rydio S1 Air', 'vt-scooter', 'st-plostad', 160, 850, 91, 40, 25, false, false),
  ('veh-tourer-ebike', 'RYD-B03', 'Rydio Vardar Tourer', 'vt-ebike', 'st-karpos', 240, 1320, 95, 72, 25, false, false),
  ('veh-commuter-s04', 'RYD-S04', 'Rydio Metro Glide', 'vt-scooter', 'st-aerodrom', 170, 900, 78, 42, 25, false, false),
  ('veh-step-ebike', 'RYD-B04', 'Rydio Step-Through', 'vt-ebike', 'st-plostad', 210, 1150, 87, 60, 25, false, false),
  ('veh-s1-service', 'RYD-S05', 'Rydio S1 Pro #05', 'vt-scooter', 'st-park', 180, 950, 42, 48, 25, true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.monthly_revenue_history (month, sort_order, revenue_mkd, rides) VALUES
  ('Jun', 1, 68400, 112),
  ('Jul', 2, 94200, 158),
  ('Aug', 3, 112800, 194),
  ('Sep', 4, 104500, 176),
  ('Oct', 5, 86900, 143),
  ('Nov', 6, 91300, 151)
ON CONFLICT (month) DO NOTHING;
