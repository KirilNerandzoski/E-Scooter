using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rydio.Api.Data;
using Rydio.Api.Models;

namespace Rydio.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
[Route("api/[controller]")]
public class AdminController(RydioDbContext db) : ControllerBase
{
    public record CreateVehicleRequest(
        string Code,
        string Name,
        string TypeId,
        string StationId,
        int HourlyRateMkd,
        int FullDayRateMkd,
        int BatteryPercent = 100,
        int RangeKm = 50,
        int MaxSpeedKmh = 25);

    public record UpdateVehicleRequest(
        string? StationId,
        int? HourlyRateMkd,
        int? FullDayRateMkd,
        int? BatteryPercent,
        bool? InMaintenance);

    public record CreateTypeRequest(string Name, string Description, int DefaultHourlyRateMkd, int FullDayDiscountPercent = 20);
    public record CreateStationRequest(string Code, string Name, string District, string Address, int Capacity);
    public record UpdateReservationStatusRequest(string Status);
    public record CreateUserRequest(string Name, string Email, string Password, string Role);
    public record UpdateUserRoleRequest(string Role);
    public record UpdateUserActiveRequest(bool Active);

    // VEHICLES
    [HttpPost("vehicles")]
    public async Task<IActionResult> AddVehicle([FromBody] CreateVehicleRequest req)
    {
        var vehicle = new Vehicle
        {
            Code = req.Code.Trim(),
            Name = req.Name.Trim(),
            TypeId = req.TypeId,
            StationId = req.StationId,
            HourlyRateMkd = req.HourlyRateMkd,
            FullDayRateMkd = req.FullDayRateMkd,
            BatteryPercent = Math.Clamp(req.BatteryPercent, 0, 100),
            RangeKm = req.RangeKm,
            MaxSpeedKmh = req.MaxSpeedKmh,
            InMaintenance = false,
        };
        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync();
        return Ok(vehicle);
    }

    [HttpPatch("vehicles/{id}")]
    public async Task<IActionResult> UpdateVehicle(string id, [FromBody] UpdateVehicleRequest req)
    {
        var vehicle = await db.Vehicles.FindAsync(id);
        if (vehicle is null) return NotFound();

        if (req.StationId is not null) vehicle.StationId = req.StationId;
        if (req.HourlyRateMkd.HasValue) vehicle.HourlyRateMkd = req.HourlyRateMkd.Value;
        if (req.FullDayRateMkd.HasValue) vehicle.FullDayRateMkd = req.FullDayRateMkd.Value;
        if (req.BatteryPercent.HasValue) vehicle.BatteryPercent = Math.Clamp(req.BatteryPercent.Value, 0, 100);
        if (req.InMaintenance.HasValue) vehicle.InMaintenance = req.InMaintenance.Value;

        await db.SaveChangesAsync();
        return Ok(vehicle);
    }

    [HttpDelete("vehicles/{id}")]
    public async Task<IActionResult> DeleteVehicle(string id)
    {
        var vehicle = await db.Vehicles.FindAsync(id);
        if (vehicle is null) return NotFound();
        db.Vehicles.Remove(vehicle);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // VEHICLE TYPES
    [HttpPost("types")]
    public async Task<IActionResult> AddType([FromBody] CreateTypeRequest req)
    {
        var vt = new VehicleType
        {
            Name = req.Name.Trim(),
            Description = req.Description.Trim(),
            DefaultHourlyRateMkd = req.DefaultHourlyRateMkd,
            FullDayDiscountPercent = req.FullDayDiscountPercent,
        };
        db.VehicleTypes.Add(vt);
        await db.SaveChangesAsync();
        return Ok(vt);
    }

    [HttpDelete("types/{id}")]
    public async Task<IActionResult> DeleteType(string id)
    {
        if (await db.Vehicles.AnyAsync(v => v.TypeId == id))
            return BadRequest(new { message = "Cannot delete type while vehicles are still assigned to it." });

        var vt = await db.VehicleTypes.FindAsync(id);
        if (vt is null) return NotFound();
        db.VehicleTypes.Remove(vt);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // STATIONS
    [HttpPost("stations")]
    public async Task<IActionResult> AddStation([FromBody] CreateStationRequest req)
    {
        var st = new Station
        {
            Code = req.Code.Trim(),
            Name = req.Name.Trim(),
            District = req.District.Trim(),
            Address = req.Address.Trim(),
            Capacity = Math.Max(1, req.Capacity),
        };
        db.Stations.Add(st);
        await db.SaveChangesAsync();
        return Ok(st);
    }

    [HttpDelete("stations/{id}")]
    public async Task<IActionResult> DeleteStation(string id)
    {
        if (await db.Vehicles.AnyAsync(v => v.StationId == id))
            return BadRequest(new { message = "Move docked vehicles to another station before deleting this station." });

        var st = await db.Stations.FindAsync(id);
        if (st is null) return NotFound();
        db.Stations.Remove(st);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // RESERVATIONS OVERRIDE
    [HttpPatch("reservations/{id}/status")]
    public async Task<IActionResult> SetReservationStatus(string id, [FromBody] UpdateReservationStatusRequest req)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound();
        if (req.Status is not ("Reserved" or "Active" or "Completed" or "Cancelled"))
            return BadRequest(new { message = "Invalid status." });

        res.Status = req.Status;
        await db.SaveChangesAsync();
        return Ok(res);
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpDelete("reservations/{id}")]
    public async Task<IActionResult> DeleteReservation(string id)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound();
        db.Reservations.Remove(res);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // SUPERADMIN USERS & ROLES
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with that email already exists." });

        if (req.Role is not ("Customer" or "Admin" or "SuperAdmin"))
            return BadRequest(new { message = "Invalid role." });

        var user = new User
        {
            Name = req.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = req.Role,
            Active = true,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new { user.Id, user.Name, user.Email, user.Role, user.Active, user.CreatedAt });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPatch("users/{id}/role")]
    public async Task<IActionResult> UpdateUserRole(string id, [FromBody] UpdateUserRoleRequest req)
    {
        var selfId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == selfId) return BadRequest(new { message = "You cannot change your own role." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        if (req.Role is not ("Customer" or "Admin" or "SuperAdmin"))
            return BadRequest(new { message = "Invalid role." });

        user.Role = req.Role;
        await db.SaveChangesAsync();
        return Ok(new { user.Id, user.Name, user.Email, user.Role, user.Active, user.CreatedAt });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPatch("users/{id}/active")]
    public async Task<IActionResult> UpdateUserActive(string id, [FromBody] UpdateUserActiveRequest req)
    {
        var selfId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == selfId) return BadRequest(new { message = "You cannot suspend your own account." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        user.Active = req.Active;
        await db.SaveChangesAsync();
        return Ok(new { user.Id, user.Name, user.Email, user.Role, user.Active, user.CreatedAt });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var selfId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == selfId) return BadRequest(new { message = "You cannot delete your own account." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
