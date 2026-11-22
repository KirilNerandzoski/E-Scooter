using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rydio.Api.Data;

namespace Rydio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CatalogController(RydioDbContext db) : ControllerBase
{
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Bootstrap()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var role = User.FindFirstValue(ClaimTypes.Role);
        var isPrivileged = role is "Admin" or "SuperAdmin";

        var stations = await db.Stations.OrderBy(s => s.Code).ToListAsync();
        var vehicleTypes = await db.VehicleTypes.OrderBy(t => t.Name).ToListAsync();
        var vehiclesQuery = db.Vehicles.AsQueryable();
        if (!isPrivileged) vehiclesQuery = vehiclesQuery.Where(v => !v.InMaintenance);
        var vehicles = await vehiclesQuery.OrderBy(v => v.Code).ToListAsync();

        var busyWindows = await db.Reservations
            .Where(r => r.Status == "Reserved" || r.Status == "Active")
            .Select(r => new { r.VehicleId, r.StartTime, r.EndTime, r.Status })
            .ToListAsync();

        object? currentUser = null;
        var reservations = new List<Models.Reservation>();
        var users = new List<object>();
        var monthlyRevenue = new List<Models.MonthlyRevenueRecord>();

        if (!string.IsNullOrEmpty(userId))
        {
            var u = await db.Users.FindAsync(userId);
            if (u is not null && u.Active)
            {
                currentUser = new { u.Id, u.Name, u.Email, u.Role, u.Active, u.CreatedAt };
                reservations = isPrivileged
                    ? await db.Reservations.OrderByDescending(r => r.CreatedAt).ToListAsync()
                    : await db.Reservations
                        .Where(r => r.UserId == userId || r.CustomerEmail == u.Email)
                        .OrderByDescending(r => r.CreatedAt)
                        .ToListAsync();

                if (isPrivileged)
                {
                    users = await db.Users
                        .OrderByDescending(x => x.CreatedAt)
                        .Select(x => (object)new { x.Id, x.Name, x.Email, x.Role, x.Active, x.CreatedAt })
                        .ToListAsync();

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
            var busyIds = await db.Reservations
                .Where(r => (r.Status == "Reserved" || r.Status == "Active") &&
                            r.StartTime < end.Value && start.Value < r.EndTime)
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
