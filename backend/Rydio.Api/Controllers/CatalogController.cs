using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rydio.Api.Data;
using Rydio.Api.Security;

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

        var stations = await db.Stations.OrderBy(s => s.Code).ToListAsync();
        var vehicleTypes = await db.VehicleTypes.OrderBy(t => t.Name).ToListAsync();
        var vehiclesQuery = db.Vehicles.AsQueryable();
        if (!canManageFleet) vehiclesQuery = vehiclesQuery.Where(v => !v.InMaintenance);
        var vehicles = await vehiclesQuery.OrderBy(v => v.Code).ToListAsync();

        var busyWindows = await db.Reservations
            .Where(r => r.Status == "Reserved" || r.Status == "Active")
            .Select(r => new { r.VehicleId, r.StartTime, r.EndTime, r.Status })
            .ToListAsync();

        object? currentUser = null;
        var reservations = new List<Models.Reservation>();
        var users = new List<object>();
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

            reservations = canManageReservations
                ? await db.Reservations.OrderByDescending(r => r.CreatedAt).ToListAsync()
                : await db.Reservations
                    .Where(r => r.UserId == liveUser.Id || r.CustomerEmail.ToLower() == liveUser.Email.ToLower())
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

            if (canManageUsers)
            {
                var allUsers = await db.Users
                    .AsNoTracking()
                    .OrderByDescending(x => x.CreatedAt)
                    .ToListAsync();

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
                var baseMonths = await db.MonthlyRevenue.OrderBy(m => m.SortOrder).ToListAsync();
                var monthMap = baseMonths.ToDictionary(
                    m => m.Month,
                    m => new Models.MonthlyRevenueRecord
                    {
                        Month = m.Month,
                        SortOrder = m.SortOrder,
                        RevenueMkd = m.RevenueMkd,
                        Rides = m.Rides,
                    },
                    StringComparer.OrdinalIgnoreCase);

                var nextOrder = baseMonths.Count + 1;
                foreach (var r in reservations.Where(x => x.Status != "Cancelled"))
                {
                    var label = r.StartTime.ToString("MMM", System.Globalization.CultureInfo.InvariantCulture);
                    if (!monthMap.TryGetValue(label, out var bucket))
                    {
                        bucket = new Models.MonthlyRevenueRecord
                        {
                            Month = label,
                            SortOrder = nextOrder++,
                            RevenueMkd = 0,
                            Rides = 0,
                        };
                        monthMap[label] = bucket;
                    }
                    bucket.RevenueMkd += r.TotalPriceMkd + r.LatePenaltyMkd;
                    bucket.Rides += 1;
                }

                monthlyRevenue = monthMap.Values.OrderBy(m => m.SortOrder).ToList();
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
            var busyIds = await db.Reservations
                .Where(r =>
                    (r.Status == "Reserved" && r.StartTime < e && s < r.EndTime) ||
                    (r.Status == "Active" && (r.StartTime < e || now < e) && (s < r.EndTime || s < now)))
                .Select(r => r.VehicleId)
                .Distinct()
                .ToListAsync();

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
