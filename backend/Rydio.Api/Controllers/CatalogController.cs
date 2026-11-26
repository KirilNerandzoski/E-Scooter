using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rydio.Api.Data;
using Rydio.Api.Security;
using Rydio.Api.Services;

namespace Rydio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CatalogController(RydioDbContext db) : ControllerBase
{
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Bootstrap()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Models.User? liveUser = null;
        string? effectiveRole = null;

        if (!string.IsNullOrEmpty(userId))
        {
            var found = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
            if (found is not null && found.Active)
            {
                liveUser = found;
                effectiveRole = RbacPolicies.NormalizeRole(found.Email, found.Role);
            }
        }

        var canManageFleet = RbacPolicies.HasPermission(effectiveRole, RbacPolicies.PermFleetManage);
        var canManageReservations = RbacPolicies.HasPermission(effectiveRole, RbacPolicies.PermReservationsManage);
        var canViewReports = RbacPolicies.HasPermission(effectiveRole, RbacPolicies.PermReportsView);
        var canManageUsers = RbacPolicies.HasPermission(effectiveRole, RbacPolicies.PermUsersManage);

        var stations = await db.Stations.AsNoTracking().OrderBy(s => s.Code).ToListAsync();
        var vehicleTypes = await db.VehicleTypes.AsNoTracking().OrderBy(t => t.Name).ToListAsync();
        var vehiclesQuery = db.Vehicles.AsNoTracking().AsQueryable();
        if (!canManageFleet) vehiclesQuery = vehiclesQuery.Where(v => !v.InMaintenance);
        var vehicles = await vehiclesQuery.OrderBy(v => v.Code).ToListAsync();

        var busyWindows = await db.Reservations
            .AsNoTracking()
            .Where(r => r.VehicleId != null && (r.Status == "Reserved" || r.Status == "Active"))
            .Select(r => new { VehicleId = r.VehicleId!, r.StartTime, r.EndTime, r.Status })
            .ToListAsync();

        object? currentUser = null;
        var reservations = new List<Models.Reservation>();
        var users = new List<object>();
        int? registeredUsersCount = null;
        var monthlyRevenue = new List<Models.MonthlyRevenueRecord>();

        if (liveUser is not null && effectiveRole is not null)
        {
            currentUser = new
            {
                liveUser.Id,
                liveUser.Name,
                liveUser.Email,
                Role = effectiveRole,
                Permissions = RbacPolicies.GetPermissionsForRole(effectiveRole),
                liveUser.Active,
                liveUser.CreatedAt
            };

            var rawReservations = canManageReservations
                ? await db.Reservations.AsNoTracking().ToListAsync()
                : await db.Reservations
                    .AsNoTracking()
                    .Where(r => r.UserId == liveUser.Id || r.CustomerEmail.ToLower() == liveUser.Email.ToLower())
                    .ToListAsync();
            reservations = rawReservations.OrderByDescending(r => r.CreatedAt).ToList();

            if (canManageUsers)
            {
                var allUsers = (await db.Users.AsNoTracking().ToListAsync())
                    .OrderByDescending(x => x.CreatedAt)
                    .ToList();

                users = allUsers
                    .Select(x =>
                    {
                        var normRole = RbacPolicies.NormalizeRole(x.Email, x.Role);
                        return (object)new
                        {
                            x.Id,
                            x.Name,
                            x.Email,
                            Role = normRole,
                            Permissions = RbacPolicies.GetPermissionsForRole(normRole),
                            x.Active,
                            x.CreatedAt
                        };
                    })
                    .ToList();
            }

            if (canViewReports)
            {
                registeredUsersCount = canManageUsers ? users.Count : await db.Users.CountAsync();
                var allCompletedReservations = canManageReservations
                    ? reservations
                    : await db.Reservations.AsNoTracking().Where(r => r.Status == "Completed").ToListAsync();
                monthlyRevenue = PricingService.BuildMonthlyRevenue(allCompletedReservations);
            }
        }

        return Ok(new
        {
            stations,
            vehicleTypes,
            vehicles,
            reservations,
            busyWindows,
            users,
            registeredUsersCount,
            monthlyRevenue,
            currentUser
        });
    }

    [HttpGet("/api/vehicles")]
    public async Task<IActionResult> GetAvailableVehicles(
        [FromQuery] string? typeId,
        [FromQuery] string? stationId,
        [FromQuery] DateTimeOffset? start,
        [FromQuery] DateTimeOffset? end,
        [FromQuery] string sort = "asc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 6)
    {
        var query = db.Vehicles.Where(v => !v.InMaintenance);
        if (!string.IsNullOrWhiteSpace(typeId)) query = query.Where(v => v.TypeId == typeId);
        if (!string.IsNullOrWhiteSpace(stationId)) query = query.Where(v => v.StationId == stationId);

        if (start.HasValue && end.HasValue && end > start)
        {
            var s = start.Value.ToUniversalTime();
            var e = end.Value.ToUniversalTime();
            var now = DateTimeOffset.UtcNow;
            var activeGraceEnd = now.AddHours(1);

            var candidates = await db.Reservations
                .AsNoTracking()
                .Where(r => r.VehicleId != null && (r.Status == "Reserved" || r.Status == "Active"))
                .Select(r => new { VehicleId = r.VehicleId!, r.Status, r.StartTime, r.EndTime })
                .ToListAsync();

            var busyIds = candidates
                .Where(r =>
                {
                    if (r.Status == "Active")
                    {
                        var effStart = r.StartTime < now ? r.StartTime : now;
                        var effEnd = r.EndTime > activeGraceEnd ? r.EndTime : activeGraceEnd;
                        return s < effEnd && effStart < e;
                    }
                    return s < r.EndTime && r.StartTime < e;
                })
                .Select(r => r.VehicleId)
                .Distinct()
                .ToList();

            query = query.Where(v => !busyIds.Contains(v.Id));
        }

        query = sort.Equals("desc", StringComparison.OrdinalIgnoreCase)
            ? query.OrderByDescending(v => v.HourlyRateMkd)
            : query.OrderBy(v => v.HourlyRateMkd);

        var total = await query.CountAsync();
        var items = await query
            .Skip((Math.Max(1, page) - 1) * Math.Clamp(pageSize, 1, 50))
            .Take(Math.Clamp(pageSize, 1, 50))
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }
}
