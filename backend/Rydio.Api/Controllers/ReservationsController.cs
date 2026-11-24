using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    public record CreateReservationRequest(string VehicleId, DateTimeOffset StartTime, DateTimeOffset EndTime);
    public record ReturnReservationRequest(string ReturnStationId, DateTimeOffset? ActualReturnTime);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReservationRequest req)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await db.Users.FindAsync(userId);
        if (user is null || !user.Active) return Unauthorized();

        var vehicle = await db.Vehicles.FindAsync(req.VehicleId);
        if (vehicle is null) return NotFound(new { message = "Vehicle not found." });
        if (vehicle.InMaintenance) return BadRequest(new { message = "Vehicle is currently in maintenance." });

        var pricing = PricingService.Calculate(vehicle, req.StartTime, req.EndTime);
        if (!pricing.Valid) return BadRequest(new { message = pricing.Error });

        var now = DateTimeOffset.UtcNow;
        var hasOverlap = await db.Reservations.AnyAsync(r =>
            r.VehicleId == vehicle.Id &&
            (
                (r.Status == "Reserved" && r.StartTime < req.EndTime && req.StartTime < r.EndTime) ||
                (r.Status == "Active" &&
                    (r.StartTime < req.EndTime || now < req.EndTime) &&
                    (req.StartTime < r.EndTime || req.StartTime < now))
            ));

        if (hasOverlap)
            return Conflict(new { message = "This vehicle already has an overlapping reservation in that window." });

        var reservation = new Reservation
        {
            VehicleId = vehicle.Id,
            UserId = user.Id,
            CustomerName = user.Name,
            CustomerEmail = user.Email,
            PickupStationId = vehicle.StationId,
            StartTime = req.StartTime.ToUniversalTime(),
            EndTime = req.EndTime.ToUniversalTime(),
            Status = "Reserved",
            BasePriceMkd = pricing.BasePriceMkd,
            DiscountAppliedMkd = pricing.DiscountAppliedMkd,
            LatePenaltyMkd = 0,
            TotalPriceMkd = pricing.FinalPriceMkd,
        };

        db.Reservations.Add(reservation);
        await db.SaveChangesAsync();

        return Ok(reservation);
    }

    [HttpPost("{id}/pickup")]
    public async Task<IActionResult> PickUp(string id)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound();
        if (!IsOwnerOrAdmin(res)) return Forbid();
        if (res.Status != "Reserved") return BadRequest(new { message = "Only Reserved bookings can be picked up." });

        res.Status = "Active";
        await db.SaveChangesAsync();
        return Ok(res);
    }

    [HttpPost("{id}/return")]
    public async Task<IActionResult> ReturnVehicle(string id, [FromBody] ReturnReservationRequest req)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound();
        if (!IsOwnerOrAdmin(res)) return Forbid();
        if (res.Status != "Active") return BadRequest(new { message = "Only Active rides can be returned." });

        var vehicle = await db.Vehicles.FindAsync(res.VehicleId);
        if (vehicle is null) return NotFound(new { message = "Vehicle not found." });

        var stationExists = await db.Stations.AnyAsync(s => s.Id == req.ReturnStationId);
        if (!stationExists) return BadRequest(new { message = "Invalid drop-off station." });

        var returnTime = (req.ActualReturnTime ?? DateTimeOffset.UtcNow).ToUniversalTime();
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
        if (res is null) return NotFound();
        if (!IsOwnerOrAdmin(res)) return Forbid();
        if (res.Status != "Reserved") return BadRequest(new { message = "Only Reserved bookings can be cancelled." });

        var canManageAll = User.HasClaim(RbacPolicies.PermissionClaimType, RbacPolicies.PermReservationsManage);
        if (!canManageAll && (res.StartTime - DateTimeOffset.UtcNow) < TimeSpan.FromHours(1))
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
}
