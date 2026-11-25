using System.Collections.Concurrent;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Rydio.Api.Data;
using Rydio.Api.Models;
using Rydio.Api.Security;
using Rydio.Api.Services;

namespace Rydio.Api.Controllers;

[ApiController]
[Authorize(Policy = RbacPolicies.PolicyOwnReservations)]
[Route("api/[controller]")]
public class ReservationsController(RydioDbContext db) : ControllerBase
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> VehicleLocks = new();

    public record CreateReservationRequest(string VehicleId, DateTimeOffset StartTime, DateTimeOffset EndTime);
    public record ReturnReservationRequest(string ReturnStationId, DateTimeOffset? ActualReturnTime);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReservationRequest req, CancellationToken cancellationToken)
    {
        var vehicleId = req.VehicleId?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(vehicleId))
            return BadRequest(new { message = "Vehicle identifier is required." });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await db.Users.FindAsync([userId], cancellationToken);
        if (user is null || !user.Active) return Unauthorized();

        // Reject unknown vehicle IDs before allocating a per-vehicle lock entry
        var vehicleExists = await db.Vehicles
            .AsNoTracking()
            .AnyAsync(v => v.Id == vehicleId, cancellationToken);
        if (!vehicleExists)
            return NotFound(new { message = "Vehicle not found." });

        var vehicleLock = VehicleLocks.GetOrAdd(vehicleId, _ => new SemaphoreSlim(1, 1));
        await vehicleLock.WaitAsync(cancellationToken);
        try
        {
            var isNpgsql = db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;
            await using var tx = isNpgsql
                ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
                : null;

            var vehicle = await db.Vehicles
                .Include(v => v.Type)
                .FirstOrDefaultAsync(v => v.Id == vehicleId, cancellationToken);

            if (vehicle is null) return NotFound(new { message = "Vehicle not found." });
            if (vehicle.InMaintenance) return BadRequest(new { message = "Vehicle is currently in maintenance." });

            var startUtc = req.StartTime.ToUniversalTime();
            var endUtc = req.EndTime.ToUniversalTime();

            var pricing = PricingService.Calculate(vehicle, startUtc, endUtc);
            if (!pricing.Valid) return BadRequest(new { message = pricing.Error });

            var now = DateTimeOffset.UtcNow;
            var activeGraceEnd = now.AddHours(1);

            var existingCandidates = await db.Reservations
                .AsNoTracking()
                .Where(r => r.VehicleId == vehicle.Id && (r.Status == "Reserved" || r.Status == "Active"))
                .Select(r => new { r.Status, r.StartTime, r.EndTime })
                .ToListAsync(cancellationToken);

            var hasOverlap = existingCandidates.Any(r =>
            {
                if (r.Status == "Active")
                {
                    var effStart = r.StartTime < now ? r.StartTime : now;
                    var effEnd = r.EndTime > activeGraceEnd ? r.EndTime : activeGraceEnd;
                    return startUtc < effEnd && effStart < endUtc;
                }
                return startUtc < r.EndTime && r.StartTime < endUtc;
            });

            if (hasOverlap)
                return Conflict(new { message = "This vehicle already has an overlapping reservation in that window." });

            var reservation = new Reservation
            {
                VehicleId = vehicle.Id,
                VehicleName = vehicle.Name,
                UserId = user.Id,
                CustomerName = user.Name,
                CustomerEmail = user.Email,
                PickupStationId = vehicle.StationId,
                StartTime = startUtc,
                EndTime = endUtc,
                Status = "Reserved",
                BasePriceMkd = pricing.BasePriceMkd,
                DiscountAppliedMkd = pricing.DiscountAppliedMkd,
                LatePenaltyMkd = 0,
                TotalPriceMkd = pricing.FinalPriceMkd,
            };

            db.Reservations.Add(reservation);
            await db.SaveChangesAsync(cancellationToken);
            if (tx is not null)
                await tx.CommitAsync(cancellationToken);

            return Ok(reservation);
        }
        catch (Exception ex) when (IsSerializationConflict(ex))
        {
            return Conflict(new { message = "This vehicle was just reserved by another rider. Please choose another slot or vehicle." });
        }
        finally
        {
            vehicleLock.Release();
        }
    }

    [HttpPost("{id}/pickup")]
    public async Task<IActionResult> PickUp(string id)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound(new { message = "Reservation not found." });
        if (!IsOwnerOrAdmin(res)) return Forbid();

        var canManageAll = User.HasClaim(RbacPolicies.PermissionClaimType, RbacPolicies.PermReservationsManage);
        var pickupCheck = PricingService.ValidatePickupWindow(res, DateTimeOffset.UtcNow, canManageAll);
        if (!pickupCheck.Allowed)
            return BadRequest(new { message = pickupCheck.Error });

        var vehicle = !string.IsNullOrEmpty(res.VehicleId)
            ? await db.Vehicles.FindAsync(res.VehicleId)
            : null;
        if (vehicle is null)
            return NotFound(new { message = "Vehicle for this reservation is no longer in the fleet." });

        if (vehicle.InMaintenance && !canManageAll)
            return BadRequest(new { message = "This vehicle is currently in maintenance and cannot be picked up." });

        var alreadyActiveOutOnRoad = await db.Reservations.AnyAsync(
            r => r.Id != res.Id && r.VehicleId == vehicle.Id && r.Status == "Active");
        if (alreadyActiveOutOnRoad)
            return Conflict(new { message = "This vehicle has not yet been returned from a prior active ride." });

        res.Status = "Active";
        await db.SaveChangesAsync();
        return Ok(res);
    }

    [HttpPost("{id}/return")]
    public async Task<IActionResult> ReturnVehicle(string id, [FromBody] ReturnReservationRequest req)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound(new { message = "Reservation not found." });
        if (!IsOwnerOrAdmin(res)) return Forbid();
        if (res.Status != "Active") return BadRequest(new { message = "Only Active rides can be returned." });

        var vehicle = !string.IsNullOrEmpty(res.VehicleId)
            ? await db.Vehicles.FindAsync(res.VehicleId)
            : null;
        if (vehicle is null) return NotFound(new { message = "Vehicle not found." });

        var stationExists = await db.Stations.AnyAsync(s => s.Id == req.ReturnStationId);
        if (!stationExists) return BadRequest(new { message = "Invalid drop-off station." });

        // Security invariant: Customers strictly use authoritative server UTC time so they cannot spoof ActualReturnTime
        // to bypass the 1.5x late return penalty. Only Admin/SuperAdmin can supply a simulated return timestamp.
        var canSimulateTime = User.HasClaim(RbacPolicies.PermissionClaimType, RbacPolicies.PermReservationsManage);
        var returnTime = canSimulateTime && req.ActualReturnTime.HasValue
            ? req.ActualReturnTime.Value.ToUniversalTime()
            : DateTimeOffset.UtcNow;

        var penalty = PricingService.CalculateLatePenalty(vehicle, res.EndTime, returnTime);

        res.Status = "Completed";
        res.ReturnStationId = req.ReturnStationId;
        res.ActualReturnTime = returnTime;
        res.LatePenaltyMkd = penalty;
        vehicle.StationId = req.ReturnStationId;

        await db.SaveChangesAsync();
        return Ok(res);
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound(new { message = "Reservation not found." });
        if (!IsOwnerOrAdmin(res)) return Forbid();
        if (res.Status != "Reserved") return BadRequest(new { message = "Only Reserved bookings can be cancelled." });

        var canManageAll = User.HasClaim(RbacPolicies.PermissionClaimType, RbacPolicies.PermReservationsManage);
        if (!PricingService.CanCancelReservation(res, DateTimeOffset.UtcNow, canManageAll))
            return BadRequest(new { message = "Cancellation is only allowed up to 1 hour before start time." });

        res.Status = "Cancelled";
        await db.SaveChangesAsync();
        return Ok(res);
    }

    private bool IsOwnerOrAdmin(Reservation res)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = User.FindFirstValue(ClaimTypes.Email);
        var canManageAll = User.HasClaim(RbacPolicies.PermissionClaimType, RbacPolicies.PermReservationsManage);
        return canManageAll ||
               (!string.IsNullOrEmpty(userId) && res.UserId == userId) ||
               (!string.IsNullOrEmpty(email) && string.Equals(res.CustomerEmail, email, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsSerializationConflict(Exception ex)
    {
        var pgEx = ex as PostgresException ?? ex.InnerException as PostgresException;
        return pgEx?.SqlState is PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected;
    }
}
