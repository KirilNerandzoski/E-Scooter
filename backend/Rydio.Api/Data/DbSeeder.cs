using Microsoft.EntityFrameworkCore;
using Rydio.Api.Models;

namespace Rydio.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(RydioDbContext db)
    {
        await db.Database.EnsureCreatedAsync();

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
                    Email = "superadmin@rydio.mk",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("SuperAdmin123!"),
                    Role = "SuperAdmin",
                    Active = true,
                },
                new User
                {
                    Id = "usr-kiril",
                    Name = "Kiril Petrov",
                    Email = "kiril@rydio.mk",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Customer123!"),
                    Role = "Customer",
                    Active = true,
                }
            );
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
}
