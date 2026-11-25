using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Rydio.Api.Controllers;
using Rydio.Api.Data;
using Rydio.Api.Models;
using Rydio.Api.Security;
using Rydio.Api.Services;
using Xunit;

namespace Rydio.Tests;

public sealed class RydioBackendTests : IDisposable
{
    private readonly SqliteConnection _connection;

    public RydioBackendTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private RydioDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<RydioDbContext>()
            .UseSqlite(_connection)
            .Options;
        return new RydioDbContext(options);
    }

    private async Task<RydioDbContext> CreateSeededDbAsync()
    {
        var db = CreateDbContext();
        await DbSeeder.SeedAsync(db);
        return db;
    }

    private static void AttachUser(ControllerBase controller, User user)
    {
        var effectiveRole = RbacPolicies.NormalizeRole(user.Email, user.Role);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, effectiveRole),
        };
        foreach (var perm in RbacPolicies.GetPermissionsForRole(effectiveRole))
        {
            claims.Add(new Claim(RbacPolicies.PermissionClaimType, perm));
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")),
            },
        };
    }

    [Fact]
    public void Pricing_EnforcesPastStart_ZeroDuration_7DayMax_AndFullDayCap()
    {
        var now = new DateTimeOffset(2026, 11, 25, 10, 0, 0, TimeSpan.Zero);
        var vehicle = new Vehicle
        {
            Id = "veh-1",
            HourlyRateMkd = 180,
            FullDayRateMkd = 950,
        };

        // Past start (>5 min ago) rejected
        var past = PricingService.Calculate(vehicle, now.AddMinutes(-10), now.AddHours(2), now);
        Assert.False(past.Valid);
        Assert.Contains("past", past.Error!, StringComparison.OrdinalIgnoreCase);

        // End <= Start rejected
        var zero = PricingService.Calculate(vehicle, now.AddHours(1), now.AddHours(1), now);
        Assert.False(zero.Valid);

        // > 7 days (169 hours) rejected
        var tooLong = PricingService.Calculate(vehicle, now.AddHours(1), now.AddHours(170), now);
        Assert.False(tooLong.Valid);
        Assert.Contains("7 days", tooLong.Error!, StringComparison.OrdinalIgnoreCase);

        // Exact 7 days (168 hours) allowed and capped at 7 * 950 = 6650 MKD
        var maxValid = PricingService.Calculate(vehicle, now.AddHours(1), now.AddHours(169), now);
        Assert.True(maxValid.Valid);
        Assert.Equal(168 * 180, maxValid.BasePriceMkd);
        Assert.Equal(7 * 950, maxValid.FinalPriceMkd);
        Assert.True(maxValid.DiscountAppliedMkd > 0);

        // 3 hours -> 540 MKD, no discount
        var shortRide = PricingService.Calculate(vehicle, now.AddHours(1), now.AddHours(4), now);
        Assert.True(shortRide.Valid);
        Assert.Equal(540, shortRide.FinalPriceMkd);
        Assert.Equal(0, shortRide.DiscountAppliedMkd);

        // 6 hours -> 6 * 180 = 1080 > 950 cap -> capped at 950 MKD
        var cappedRide = PricingService.Calculate(vehicle, now.AddHours(1), now.AddHours(7), now);
        Assert.True(cappedRide.Valid);
        Assert.Equal(1080, cappedRide.BasePriceMkd);
        Assert.Equal(950, cappedRide.FinalPriceMkd);
        Assert.Equal(130, cappedRide.DiscountAppliedMkd);
    }

    [Fact]
    public void LatePenalty_Applies1Point5xCeilingHourlyRate_OnlyWhenOverdue()
    {
        var vehicle = new Vehicle { HourlyRateMkd = 200 };
        var bookedEnd = new DateTimeOffset(2026, 11, 25, 14, 0, 0, TimeSpan.Zero);

        Assert.Equal(0, PricingService.CalculateLatePenalty(vehicle, bookedEnd, bookedEnd.AddMinutes(-5)));
        Assert.Equal(0, PricingService.CalculateLatePenalty(vehicle, bookedEnd, bookedEnd));
        // 15 minutes late -> ceil to 1 hour -> 1 * 200 * 1.5 = 300 MKD
        Assert.Equal(300, PricingService.CalculateLatePenalty(vehicle, bookedEnd, bookedEnd.AddMinutes(15)));
        // 2 hours 10 minutes late -> ceil to 3 hours -> 3 * 200 * 1.5 = 900 MKD
        Assert.Equal(900, PricingService.CalculateLatePenalty(vehicle, bookedEnd, bookedEnd.AddMinutes(130)));
    }

    [Fact]
    public void ReservationId_UsesHighEntropyHexScheme_WithZeroCollisions()
    {
        var ids = Enumerable.Range(0, 5000).Select(_ => Reservation.CreateNewId()).ToList();
        Assert.All(ids, id =>
        {
            Assert.StartsWith("RES-", id);
            Assert.Equal(12, id.Length);
        });
        Assert.Equal(5000, ids.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public async Task OverlapAndConcurrentBooking_PreventsDoubleBooking_OnSameVehicle()
    {
        await using var seedDb = await CreateSeededDbAsync();
        var kiril = await seedDb.Users.FirstAsync(u => u.Email == "kiril@rydio.mk");
        var start = DateTimeOffset.UtcNow.AddHours(2);
        var end = start.AddHours(3);

        // Fire two simultaneous reservation requests on two separate DbContexts sharing the same DB
        var task1 = Task.Run(async () =>
        {
            await using var db1 = CreateDbContext();
            var ctrl1 = new ReservationsController(db1);
            AttachUser(ctrl1, kiril);
            return await ctrl1.Create(new("veh-s1-pro", start, end), CancellationToken.None);
        });

        var task2 = Task.Run(async () =>
        {
            await using var db2 = CreateDbContext();
            var ctrl2 = new ReservationsController(db2);
            AttachUser(ctrl2, kiril);
            return await ctrl2.Create(new("veh-s1-pro", start.AddHours(1), end.AddHours(1)), CancellationToken.None);
        });

        var results = await Task.WhenAll(task1, task2);
        var winningOk = Assert.Single(results.OfType<OkObjectResult>());
        Assert.Single(results.OfType<ConflictObjectResult>());
        var winningRes = Assert.IsType<Reservation>(winningOk.Value);

        // Non-overlapping adjacent window [winningRes.EndTime, winningRes.EndTime + 2h) succeeds cleanly
        await using var db3 = CreateDbContext();
        var ctrl3 = new ReservationsController(db3);
        AttachUser(ctrl3, kiril);
        var adjacent = await ctrl3.Create(
            new("veh-s1-pro", winningRes.EndTime, winningRes.EndTime.AddHours(2)),
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(adjacent);
    }

    [Fact]
    public async Task PickupWindow_BlocksPrematureAndExpiredCustomerPickup_AllowsWithin30MinutesOrAdmin()
    {
        await using var db = await CreateSeededDbAsync();
        var kiril = await db.Users.FirstAsync(u => u.Email == "kiril@rydio.mk");
        var superAdmin = await db.Users.FirstAsync(u => u.Email == RbacPolicies.SuperAdminEmail);

        var farFutureRes = new Reservation
        {
            VehicleId = "veh-s1-pro",
            VehicleName = "Rydio S1 Pro",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddHours(4),
            EndTime = DateTimeOffset.UtcNow.AddHours(6),
            Status = "Reserved",
            TotalPriceMkd = 360,
        };
        var nearStartRes = new Reservation
        {
            VehicleId = "veh-city-ebike",
            VehicleName = "Rydio City E-Bike",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-park",
            StartTime = DateTimeOffset.UtcNow.AddMinutes(15),
            EndTime = DateTimeOffset.UtcNow.AddHours(2),
            Status = "Reserved",
            TotalPriceMkd = 440,
        };
        var expiredRes = new Reservation
        {
            VehicleId = "veh-lite-01",
            VehicleName = "Rydio Lite Scooter",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-debar",
            StartTime = DateTimeOffset.UtcNow.AddHours(-3),
            EndTime = DateTimeOffset.UtcNow.AddMinutes(-5),
            Status = "Reserved",
            TotalPriceMkd = 450,
        };
        db.Reservations.AddRange(farFutureRes, nearStartRes, expiredRes);
        await db.SaveChangesAsync();

        var ctrl = new ReservationsController(db);
        AttachUser(ctrl, kiril);

        // Customer blocked 4h before start
        Assert.IsType<BadRequestObjectResult>(await ctrl.PickUp(farFutureRes.Id));
        // Customer blocked after EndTime
        Assert.IsType<BadRequestObjectResult>(await ctrl.PickUp(expiredRes.Id));
        // Customer allowed 15m before start
        Assert.IsType<OkObjectResult>(await ctrl.PickUp(nearStartRes.Id));
        Assert.Equal("Active", nearStartRes.Status);

        // SuperAdmin override can activate early
        AttachUser(ctrl, superAdmin);
        Assert.IsType<OkObjectResult>(await ctrl.PickUp(farFutureRes.Id));
        Assert.Equal("Active", farFutureRes.Status);
    }

    [Fact]
    public async Task ReturnVehicle_PreventsCustomerTimestampSpoofing_AndRelocatesStation()
    {
        await using var db = await CreateSeededDbAsync();
        var kiril = await db.Users.FirstAsync(u => u.Email == "kiril@rydio.mk");
        var superAdmin = await db.Users.FirstAsync(u => u.Email == RbacPolicies.SuperAdminEmail);

        // Overdue active reservation (ended 2 hours ago on 180 MKD/hr scooter -> 2 * 180 * 1.5 = 540+ MKD penalty)
        var overdueRes = new Reservation
        {
            VehicleId = "veh-s1-pro",
            VehicleName = "Rydio S1 Pro",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddHours(-5),
            EndTime = DateTimeOffset.UtcNow.AddMinutes(-90),
            Status = "Active",
            BasePriceMkd = 540,
            TotalPriceMkd = 540,
        };
        db.Reservations.Add(overdueRes);
        await db.SaveChangesAsync();

        var ctrl = new ReservationsController(db);
        AttachUser(ctrl, kiril);

        // Customer attempts to spoof ActualReturnTime to BEFORE EndTime to dodge the 1.5x late penalty!
        var spoofedTime = overdueRes.EndTime.AddMinutes(-10);
        var result = await ctrl.ReturnVehicle(overdueRes.Id, new("st-aerodrom", spoofedTime));
        var ok = Assert.IsType<OkObjectResult>(result);
        var settled = Assert.IsType<Reservation>(ok.Value);

        // Server ignored spoofed timestamp and charged 2h * 180 * 1.5 = 540 MKD penalty, relocating vehicle
        Assert.Equal("Completed", settled.Status);
        Assert.Equal(540, settled.LatePenaltyMkd);
        Assert.Equal("st-aerodrom", (await db.Vehicles.FindAsync("veh-s1-pro"))!.StationId);

        // Admin/SuperAdmin CAN simulate late return timestamp for evaluation
        var adminTestRes = new Reservation
        {
            VehicleId = "veh-city-ebike",
            VehicleName = "Rydio City E-Bike",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-park",
            StartTime = DateTimeOffset.UtcNow.AddHours(-1),
            EndTime = DateTimeOffset.UtcNow.AddHours(1),
            Status = "Active",
            BasePriceMkd = 440,
            TotalPriceMkd = 440,
        };
        db.Reservations.Add(adminTestRes);
        await db.SaveChangesAsync();

        AttachUser(ctrl, superAdmin);
        var adminReturn = await ctrl.ReturnVehicle(adminTestRes.Id, new("st-park", adminTestRes.EndTime.AddHours(2)));
        var adminSettled = Assert.IsType<Reservation>(Assert.IsType<OkObjectResult>(adminReturn).Value);
        Assert.Equal(660, adminSettled.LatePenaltyMkd); // 2h * 220 * 1.5 = 660 MKD
    }

    [Fact]
    public async Task Cancellation_Enforces1HourCutoffForCustomer_AllowsAbove1Hour()
    {
        await using var db = await CreateSeededDbAsync();
        var kiril = await db.Users.FirstAsync(u => u.Email == "kiril@rydio.mk");

        var tooClose = new Reservation
        {
            VehicleId = "veh-s1-pro",
            VehicleName = "Rydio S1 Pro",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddMinutes(45),
            EndTime = DateTimeOffset.UtcNow.AddHours(3),
            Status = "Reserved",
            TotalPriceMkd = 360,
        };
        var allowed = new Reservation
        {
            VehicleId = "veh-city-ebike",
            VehicleName = "Rydio City E-Bike",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-park",
            StartTime = DateTimeOffset.UtcNow.AddMinutes(75),
            EndTime = DateTimeOffset.UtcNow.AddHours(4),
            Status = "Reserved",
            TotalPriceMkd = 660,
        };
        db.Reservations.AddRange(tooClose, allowed);
        await db.SaveChangesAsync();

        var ctrl = new ReservationsController(db);
        AttachUser(ctrl, kiril);

        Assert.IsType<BadRequestObjectResult>(await ctrl.Cancel(tooClose.Id));
        Assert.Equal("Reserved", tooClose.Status);

        Assert.IsType<OkObjectResult>(await ctrl.Cancel(allowed.Id));
        Assert.Equal("Cancelled", allowed.Status);
    }

    [Fact]
    public async Task DeleteVehicle_BlocksActiveOrReserved_AndPreservesHistoricalCompletedReservations()
    {
        await using var db = await CreateSeededDbAsync();
        var superAdmin = await db.Users.FirstAsync(u => u.Email == RbacPolicies.SuperAdminEmail);
        var kiril = await db.Users.FirstAsync(u => u.Email == "kiril@rydio.mk");

        var completedRes = new Reservation
        {
            VehicleId = "veh-lite-01",
            VehicleName = "Rydio Lite Scooter",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-debar",
            ReturnStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddDays(-2),
            EndTime = DateTimeOffset.UtcNow.AddDays(-2).AddHours(2),
            ActualReturnTime = DateTimeOffset.UtcNow.AddDays(-2).AddHours(2),
            Status = "Completed",
            BasePriceMkd = 300,
            TotalPriceMkd = 300,
        };
        var upcomingRes = new Reservation
        {
            VehicleId = "veh-s1-pro",
            VehicleName = "Rydio S1 Pro",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddHours(4),
            EndTime = DateTimeOffset.UtcNow.AddHours(6),
            Status = "Reserved",
            TotalPriceMkd = 360,
        };
        db.Reservations.AddRange(completedRes, upcomingRes);
        await db.SaveChangesAsync();

        var adminCtrl = new AdminController(db);
        AttachUser(adminCtrl, superAdmin);

        // Cannot delete vehicle with upcoming Reserved booking
        Assert.IsType<ConflictObjectResult>(await adminCtrl.DeleteVehicle("veh-s1-pro"));

        // Deleting vehicle with Completed reservation succeeds AND preserves the historical reservation + revenue
        Assert.IsType<NoContentResult>(await adminCtrl.DeleteVehicle("veh-lite-01"));
        Assert.Null(await db.Vehicles.FindAsync("veh-lite-01"));

        var preserved = await db.Reservations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == completedRes.Id);
        Assert.NotNull(preserved);
        Assert.Null(preserved!.VehicleId);
        Assert.Equal("Rydio Lite Scooter", preserved.VehicleName);
        Assert.Equal(300, preserved.TotalPriceMkd);
    }

    [Fact]
    public async Task TypeTariffWiring_And_MonthlyRevenueAnalytics_WorkCorrectly()
    {
        await using var db = await CreateSeededDbAsync();
        var superAdmin = await db.Users.FirstAsync(u => u.Email == RbacPolicies.SuperAdminEmail);
        var adminCtrl = new AdminController(db);
        AttachUser(adminCtrl, superAdmin);

        // Create type with DefaultHourlyRateMkd = 250 and FullDayDiscountPercent = 25%
        var typeRes = await adminCtrl.AddType(new("Cargo Trike", "Heavy-duty cargo electric trike", 250, 25));
        var createdType = Assert.IsType<VehicleType>(Assert.IsType<OkObjectResult>(typeRes).Value);

        // Add vehicle without specifying HourlyRateMkd/FullDayRateMkd -> inherits 250/hr and 24 * 250 * 0.75 = 4500/day
        var vehRes = await adminCtrl.AddVehicle(new("RYD-T01", "Rydio Cargo Trike", createdType.Id, "st-plostad"));
        var createdVeh = Assert.IsType<Vehicle>(Assert.IsType<OkObjectResult>(vehRes).Value);
        Assert.Equal(250, createdVeh.HourlyRateMkd);
        Assert.Equal(4500, createdVeh.FullDayRateMkd);

        // Monthly revenue excludes Reserved & Cancelled and orders months chronologically
        var baseline = new List<MonthlyRevenueRecord>
        {
            new() { Month = "Oct", SortOrder = 202610, RevenueMkd = 10000, Rides = 10 },
            new() { Month = "Nov", SortOrder = 202611, RevenueMkd = 20000, Rides = 20 },
        };
        var sampleReservations = new List<Reservation>
        {
            // Earned in Jan 2027 (inserted first to test chronological sorting!)
            new()
            {
                Status = "Completed",
                StartTime = new DateTimeOffset(2027, 1, 10, 12, 0, 0, TimeSpan.Zero),
                ActualReturnTime = new DateTimeOffset(2027, 1, 10, 14, 0, 0, TimeSpan.Zero),
                TotalPriceMkd = 500,
                LatePenaltyMkd = 150,
            },
            // Earned in Dec 2026
            new()
            {
                Status = "Active",
                StartTime = new DateTimeOffset(2026, 12, 5, 9, 0, 0, TimeSpan.Zero),
                TotalPriceMkd = 800,
            },
            // Unstarted Reserved booking in Dec 2026 -> MUST NOT be counted as earned revenue
            new()
            {
                Status = "Reserved",
                StartTime = new DateTimeOffset(2026, 12, 20, 9, 0, 0, TimeSpan.Zero),
                TotalPriceMkd = 9999,
            },
            // Cancelled booking -> MUST NOT be counted
            new()
            {
                Status = "Cancelled",
                StartTime = new DateTimeOffset(2026, 11, 15, 9, 0, 0, TimeSpan.Zero),
                TotalPriceMkd = 5000,
            },
        };

        var revenue = PricingService.BuildMonthlyRevenue(
            baseline,
            sampleReservations,
            new DateTimeOffset(2026, 11, 25, 0, 0, 0, TimeSpan.Zero));

        Assert.Equal(["Oct", "Nov", "Dec", "Jan"], revenue.Select(r => r.Month).ToArray());
        Assert.Equal(20000, revenue.Single(r => r.Month == "Nov").RevenueMkd);
        Assert.Equal(800, revenue.Single(r => r.Month == "Dec").RevenueMkd);
        Assert.Equal(650, revenue.Single(r => r.Month == "Jan").RevenueMkd);
    }

    [Fact]
    public async Task RbacInvariants_EnforceCustomerRegistration_SingletonSuperAdmin_AndRoleBoundaries()
    {
        await using var db = await CreateSeededDbAsync();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var authCtrl = new AuthController(db, new JwtService(config));

        // 1. Newly registered user strictly starts as Customer
        var regRes = await authCtrl.Register(new("Ana Rider", "ana@example.mk", "Secret123!"));
        Assert.IsType<OkObjectResult>(regRes);
        var ana = await db.Users.SingleAsync(u => u.Email == "ana@example.mk");
        Assert.Equal(RbacPolicies.RoleCustomer, ana.Role);

        // 2. Registering with superadmin@rydio.mk is blocked
        var reservedReg = await authCtrl.Register(new("Fake Admin", RbacPolicies.SuperAdminEmail, "Secret123!"));
        Assert.IsType<ConflictObjectResult>(reservedReg);

        // 3. Non-primary account holding SuperAdmin in raw DB normalizes to Customer
        Assert.Equal(RbacPolicies.RoleCustomer, RbacPolicies.NormalizeRole("intruder@example.mk", "SuperAdmin"));
        Assert.Equal(RbacPolicies.RoleSuperAdmin, RbacPolicies.NormalizeRole("SUPERADMIN@RYDIO.MK", "Customer"));

        // 4. Primary SuperAdmin cannot be demoted, suspended, or deleted; cannot promote anyone else to SuperAdmin
        var superAdmin = await db.Users.SingleAsync(u => u.Email == RbacPolicies.SuperAdminEmail);
        var adminCtrl = new AdminController(db);
        AttachUser(adminCtrl, superAdmin);

        Assert.IsType<BadRequestObjectResult>(await adminCtrl.UpdateUserRole(ana.Id, new("SuperAdmin")));
        Assert.IsType<BadRequestObjectResult>(await adminCtrl.UpdateUserRole(superAdmin.Id, new("Customer")));
        Assert.IsType<BadRequestObjectResult>(await adminCtrl.UpdateUserActive(superAdmin.Id, new(false)));
        Assert.IsType<BadRequestObjectResult>(await adminCtrl.DeleteUser(superAdmin.Id));

        // 5. SuperAdmin CAN delegate Admin to Ana, and Admin does NOT get users:manage or reservations:delete
        Assert.IsType<OkObjectResult>(await adminCtrl.UpdateUserRole(ana.Id, new("Admin")));
        var adminPerms = RbacPolicies.GetPermissionsForRole(RbacPolicies.RoleAdmin);
        Assert.Contains(RbacPolicies.PermFleetManage, adminPerms);
        Assert.DoesNotContain(RbacPolicies.PermUsersManage, adminPerms);
        Assert.DoesNotContain(RbacPolicies.PermReservationsDelete, adminPerms);
    }

    [Fact]
    public async Task PickUp_BlocksSimultaneousActiveUnreturnedVehicle_And_AdminCompleteAppliesOverduePenalty()
    {
        await using var db = await CreateSeededDbAsync();
        var kiril = await db.Users.FirstAsync(u => u.Email == "kiril@rydio.mk");
        var superAdmin = await db.Users.FirstAsync(u => u.Email == RbacPolicies.SuperAdminEmail);

        // Rider A still has veh-s1-pro out on an overdue Active ride
        var overdueActive = new Reservation
        {
            VehicleId = "veh-s1-pro",
            VehicleName = "Rydio S1 Pro",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddHours(-4),
            EndTime = DateTimeOffset.UtcNow.AddMinutes(-90),
            Status = "Active",
            BasePriceMkd = 360,
            TotalPriceMkd = 360,
        };
        // Next slot on the same physical scooter
        var nextReserved = new Reservation
        {
            VehicleId = "veh-s1-pro",
            VehicleName = "Rydio S1 Pro",
            UserId = kiril.Id,
            CustomerName = kiril.Name,
            CustomerEmail = kiril.Email,
            PickupStationId = "st-plostad",
            StartTime = DateTimeOffset.UtcNow.AddMinutes(10),
            EndTime = DateTimeOffset.UtcNow.AddHours(2),
            Status = "Reserved",
            BasePriceMkd = 360,
            TotalPriceMkd = 360,
        };
        db.Reservations.AddRange(overdueActive, nextReserved);
        await db.SaveChangesAsync();

        var resCtrl = new ReservationsController(db);
        AttachUser(resCtrl, kiril);

        // Cannot pick up while prior Active ride is still unreturned on the road
        Assert.IsType<ConflictObjectResult>(await resCtrl.PickUp(nextReserved.Id));

        // Admin marks overdueActive Completed -> calculates 2h * 180 * 1.5 = 540 MKD late penalty
        var adminCtrl = new AdminController(db);
        AttachUser(adminCtrl, superAdmin);
        var completeRes = await adminCtrl.SetReservationStatus(overdueActive.Id, new("Completed"));
        var settled = Assert.IsType<Reservation>(Assert.IsType<OkObjectResult>(completeRes).Value);
        Assert.Equal("Completed", settled.Status);
        Assert.Equal(540, settled.LatePenaltyMkd);

        // Now nextReserved CAN be picked up cleanly
        Assert.IsType<OkObjectResult>(await resCtrl.PickUp(nextReserved.Id));
    }

    [Fact]
    public async Task FullHttpPipeline_EnforcesJwtRbac_Json404OnUnknownApi_AndDelegatedAdminUserCount()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<RydioDbContext>>();
                services.RemoveAll<IDbContextOptionsConfiguration<RydioDbContext>>();
                services.AddDbContext<RydioDbContext>(opt => opt.UseSqlite(_connection));
            });
        });

        using var client = factory.CreateClient();

        // 1. /health returns 200 OK JSON
        var health = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);

        // 2. Unknown /api/* route returns 404 JSON (never 200 HTML SPA fallback)
        var unknownApi = await client.GetAsync("/api/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, unknownApi.StatusCode);
        Assert.Equal("application/json", unknownApi.Content.Headers.ContentType?.MediaType);

        // 3. Customer sign-in succeeds, blocked with 403 FORBIDDEN from modifying fleet, 404 on bogus vehicleId
        var custLogin = await client.PostAsJsonAsync("/api/auth/login", new { email = "kiril@rydio.mk", password = "Customer123!" });
        Assert.Equal(HttpStatusCode.OK, custLogin.StatusCode);
        var custBody = await custLogin.Content.ReadFromJsonAsync<JsonElement>();
        var custToken = custBody.GetProperty("token").GetString()!;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", custToken);
        var forbiddenAdmin = await client.PostAsJsonAsync("/api/admin/stations", new
        {
            code = "SKP-99",
            name = "Unauthorized Dock",
            district = "Centar",
            address = "Test",
            capacity = 8,
        });
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenAdmin.StatusCode);

        var bogusVeh = await client.PostAsJsonAsync("/api/reservations", new
        {
            vehicleId = "bogus-nonexistent-id",
            startTime = DateTimeOffset.UtcNow.AddHours(2),
            endTime = DateTimeOffset.UtcNow.AddHours(4),
        });
        Assert.Equal(HttpStatusCode.NotFound, bogusVeh.StatusCode);

        // Whitespace-padded valid vehicleId succeeds via HTTP pipeline
        var validRes = await client.PostAsJsonAsync("/api/reservations", new
        {
            vehicleId = "  veh-step-ebike  ",
            startTime = DateTimeOffset.UtcNow.AddHours(3),
            endTime = DateTimeOffset.UtcNow.AddHours(5),
        });
        Assert.Equal(HttpStatusCode.OK, validRes.StatusCode);

        // 4. SuperAdmin creates a delegated Admin -> delegated Admin gets registeredUsersCount without PII users array
        var saLogin = await client.PostAsJsonAsync("/api/auth/login", new { email = RbacPolicies.SuperAdminEmail, password = "SuperAdmin123!" });
        var saToken = (await saLogin.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", saToken);

        var createDelegated = await client.PostAsJsonAsync("/api/admin/users", new
        {
            name = "Delegated Ops",
            email = "ops@rydio.mk",
            password = "AdminPassword123!",
            role = "Admin",
        });
        Assert.Equal(HttpStatusCode.OK, createDelegated.StatusCode);

        var opsLogin = await client.PostAsJsonAsync("/api/auth/login", new { email = "ops@rydio.mk", password = "AdminPassword123!" });
        var opsToken = (await opsLogin.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", opsToken);

        var opsBootstrap = await client.GetFromJsonAsync<JsonElement>("/api/catalog/bootstrap");
        Assert.Equal(0, opsBootstrap.GetProperty("users").GetArrayLength());
        Assert.Equal(3, opsBootstrap.GetProperty("registeredUsersCount").GetInt32());
    }
}
