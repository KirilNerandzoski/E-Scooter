using Microsoft.EntityFrameworkCore;
using Rydio.Api.Models;
using Rydio.Api.Security;

namespace Rydio.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(RydioDbContext db)
    {
        await db.Database.EnsureCreatedAsync();

        if (db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            await EnsurePostgresSchemaEvolutionAsync(db);
        }

        if (!await db.Stations.AnyAsync())
        {
            db.Stations.AddRange(
                new Station { Id = "st-plostad", Code = "SKP-01", Name = "Plostad Makedonija", District = "Centar", Address = "Kej 13 Noemvri, Riverfront Dock", Capacity = 14 },
                new Station { Id = "st-park", Code = "SKP-02", Name = "Gradski Park", District = "Centar", Address = "Ilinden Blvd, Main Park Gate", Capacity = 12 },
                new Station { Id = "st-debar", Code = "SKP-03", Name = "Debar Maalo", District = "Centar", Address = "Boemska St, North Plaza", Capacity = 10 },
                new Station { Id = "st-eastgate", Code = "SKP-04", Name = "East Gate", District = "Gazi Baba", Address = "Belasica 2, West Mobility Hub", Capacity = 12 },
                new Station { Id = "st-karpos", Code = "SKP-05", Name = "Karpos 3", District = "Karpos", Address = "Partizanski Odredi, City Mall Bay", Capacity = 10 },
                new Station { Id = "st-aerodrom", Code = "SKP-06", Name = "Aerodrom", District = "Aerodrom", Address = "Jane Sandanski Blvd, Capitol Bay", Capacity = 10 }
            );
            await db.SaveChangesAsync();
        }

        if (!await db.VehicleTypes.AnyAsync())
        {
            db.VehicleTypes.AddRange(
                new VehicleType { Id = "vt-scooter", Name = "E-Scooter", Description = "Lightweight urban commuter electric scooter for swift city hops.", DefaultHourlyRateMkd = 180, FullDayDiscountPercent = 20 },
                new VehicleType { Id = "vt-ebike", Name = "E-Bike", Description = "Pedal-assist electric city bicycle built for longer riverfront rides.", DefaultHourlyRateMkd = 220, FullDayDiscountPercent = 20 }
            );
            await db.SaveChangesAsync();
        }

        if (!await db.Vehicles.AnyAsync())
        {
            db.Vehicles.AddRange(
                new Vehicle { Id = "veh-s1-pro", Code = "RYD-S01", Name = "Rydio S1 Pro", TypeId = "vt-scooter", StationId = "st-plostad", HourlyRateMkd = 180, FullDayRateMkd = 950, BatteryPercent = 96, RangeKm = 48, MaxSpeedKmh = 25, InMaintenance = false, Featured = true },
                new Vehicle { Id = "veh-city-ebike", Code = "RYD-B01", Name = "Rydio City E-Bike", TypeId = "vt-ebike", StationId = "st-park", HourlyRateMkd = 220, FullDayRateMkd = 1200, BatteryPercent = 92, RangeKm = 65, MaxSpeedKmh = 25, InMaintenance = false },
                new Vehicle { Id = "veh-lite-01", Code = "RYD-S02", Name = "Rydio Lite Scooter", TypeId = "vt-scooter", StationId = "st-debar", HourlyRateMkd = 150, FullDayRateMkd = 800, BatteryPercent = 89, RangeKm = 35, MaxSpeedKmh = 22, InMaintenance = false },
                new Vehicle { Id = "veh-cargo-ebike", Code = "RYD-B02", Name = "Rydio Cargo E-Bike", TypeId = "vt-ebike", StationId = "st-eastgate", HourlyRateMkd = 260, FullDayRateMkd = 1450, BatteryPercent = 84, RangeKm = 58, MaxSpeedKmh = 25, InMaintenance = false },
                new Vehicle { Id = "veh-s1-air", Code = "RYD-S03", Name = "Rydio S1 Air", TypeId = "vt-scooter", StationId = "st-plostad", HourlyRateMkd = 160, FullDayRateMkd = 850, BatteryPercent = 91, RangeKm = 40, MaxSpeedKmh = 25, InMaintenance = false },
                new Vehicle { Id = "veh-tourer-ebike", Code = "RYD-B03", Name = "Rydio Vardar Tourer", TypeId = "vt-ebike", StationId = "st-karpos", HourlyRateMkd = 240, FullDayRateMkd = 1320, BatteryPercent = 95, RangeKm = 72, MaxSpeedKmh = 25, InMaintenance = false },
                new Vehicle { Id = "veh-commuter-s04", Code = "RYD-S04", Name = "Rydio Metro Glide", TypeId = "vt-scooter", StationId = "st-aerodrom", HourlyRateMkd = 170, FullDayRateMkd = 900, BatteryPercent = 78, RangeKm = 42, MaxSpeedKmh = 25, InMaintenance = false },
                new Vehicle { Id = "veh-step-ebike", Code = "RYD-B04", Name = "Rydio Step-Through", TypeId = "vt-ebike", StationId = "st-plostad", HourlyRateMkd = 210, FullDayRateMkd = 1150, BatteryPercent = 87, RangeKm = 60, MaxSpeedKmh = 25, InMaintenance = false },
                new Vehicle { Id = "veh-s1-service", Code = "RYD-S05", Name = "Rydio S1 Pro #05", TypeId = "vt-scooter", StationId = "st-park", HourlyRateMkd = 180, FullDayRateMkd = 950, BatteryPercent = 42, RangeKm = 48, MaxSpeedKmh = 25, InMaintenance = true }
            );
            await db.SaveChangesAsync();
        }

        if (!await db.Users.AnyAsync())
        {
            db.Users.AddRange(
                new User
                {
                    Id = "usr-superadmin",
                    Name = "Rydio SuperAdmin",
                    Email = RbacPolicies.SuperAdminEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("SuperAdmin123!"),
                    Role = RbacPolicies.RoleSuperAdmin,
                    Active = true,
                },
                new User
                {
                    Id = "usr-kiril",
                    Name = "Kiril Petrov",
                    Email = "kiril@rydio.mk",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                    Role = RbacPolicies.RoleCustomer,
                    Active = true,
                }
            );
            await db.SaveChangesAsync();
        }
        else
        {
            // Enforce RBAC invariants on existing databases:
            // 1. Ensure primary SuperAdmin (superadmin@rydio.mk) exists, is Active, and holds SuperAdmin.
            var superAdmin = await db.Users.FirstOrDefaultAsync(u =>
                u.Email.ToLower() == RbacPolicies.SuperAdminEmail);

            if (superAdmin is null)
            {
                db.Users.Add(new User
                {
                    Id = "usr-superadmin",
                    Name = "Rydio SuperAdmin",
                    Email = RbacPolicies.SuperAdminEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("SuperAdmin123!"),
                    Role = RbacPolicies.RoleSuperAdmin,
                    Active = true,
                });
            }
            else
            {
                superAdmin.Role = RbacPolicies.RoleSuperAdmin;
                superAdmin.Active = true;
            }

            // 2. Demote any non-primary account that previously held SuperAdmin back to Customer.
            var extraSuperAdmins = await db.Users
                .Where(u => u.Role == RbacPolicies.RoleSuperAdmin &&
                            u.Email.ToLower() != RbacPolicies.SuperAdminEmail)
                .ToListAsync();

            foreach (var u in extraSuperAdmins)
            {
                u.Role = RbacPolicies.RoleCustomer;
            }

            await db.SaveChangesAsync();
        }

        if (!await db.MonthlyRevenue.AnyAsync())
        {
            db.MonthlyRevenue.AddRange(
                new MonthlyRevenueRecord { Month = "Jun", SortOrder = 1, RevenueMkd = 68400, Rides = 112 },
                new MonthlyRevenueRecord { Month = "Jul", SortOrder = 2, RevenueMkd = 94200, Rides = 158 },
                new MonthlyRevenueRecord { Month = "Aug", SortOrder = 3, RevenueMkd = 112800, Rides = 194 },
                new MonthlyRevenueRecord { Month = "Sep", SortOrder = 4, RevenueMkd = 104500, Rides = 176 },
                new MonthlyRevenueRecord { Month = "Oct", SortOrder = 5, RevenueMkd = 86900, Rides = 143 },
                new MonthlyRevenueRecord { Month = "Nov", SortOrder = 6, RevenueMkd = 91300, Rides = 151 }
            );
            await db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Safely upgrades pre-existing PostgreSQL deployments where EnsureCreatedAsync was previously used:
    /// adds Reservations.VehicleName, makes Reservations.VehicleId nullable, switches FK from CASCADE to SET NULL,
    /// and ensures unique indexes on Vehicles.Name and Stations.Name.
    /// </summary>
    private static async Task EnsurePostgresSchemaEvolutionAsync(RydioDbContext db)
    {
        const string sql = """
            ALTER TABLE "Reservations" ADD COLUMN IF NOT EXISTS "VehicleName" text NOT NULL DEFAULT '';

            UPDATE "Reservations" r
            SET "VehicleName" = v."Name"
            FROM "Vehicles" v
            WHERE r."VehicleId" = v."Id"
              AND (r."VehicleName" IS NULL OR r."VehicleName" = '');

            ALTER TABLE "Reservations" ALTER COLUMN "VehicleId" DROP NOT NULL;

            DO $$
            DECLARE
                fk_name text;
            BEGIN
                FOR fk_name IN
                    SELECT c.conname
                    FROM pg_constraint c
                    WHERE c.conrelid = '"Reservations"'::regclass
                      AND c.confrelid = '"Vehicles"'::regclass
                      AND c.contype = 'f'
                      AND c.confdeltype <> 'n'
                LOOP
                    EXECUTE format('ALTER TABLE "Reservations" DROP CONSTRAINT %I', fk_name);
                END LOOP;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint c
                    WHERE c.conrelid = '"Reservations"'::regclass
                      AND c.confrelid = '"Vehicles"'::regclass
                      AND c.contype = 'f'
                      AND c.confdeltype = 'n'
                ) THEN
                    ALTER TABLE "Reservations"
                        ADD CONSTRAINT "FK_Reservations_Vehicles_VehicleId"
                        FOREIGN KEY ("VehicleId") REFERENCES "Vehicles" ("Id") ON DELETE SET NULL;
                END IF;
            END $$;

            DO $$
            BEGIN
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Vehicles_Name" ON "Vehicles" ("Name");
            EXCEPTION WHEN unique_violation THEN
                RAISE WARNING 'Skipped IX_Vehicles_Name creation due to pre-existing duplicate rows.';
            END $$;

            DO $$
            BEGIN
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Stations_Name" ON "Stations" ("Name");
            EXCEPTION WHEN unique_violation THEN
                RAISE WARNING 'Skipped IX_Stations_Name creation due to pre-existing duplicate rows.';
            END $$;

            CREATE INDEX IF NOT EXISTS "IX_Reservations_VehicleId_Status_StartTime_EndTime"
                ON "Reservations" ("VehicleId", "Status", "StartTime", "EndTime");
            """;

        await db.Database.ExecuteSqlRawAsync(sql);
    }
}
