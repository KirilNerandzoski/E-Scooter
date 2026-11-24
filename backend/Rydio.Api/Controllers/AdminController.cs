using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rydio.Api.Data;
using Rydio.Api.Models;
using Rydio.Api.Security;

namespace Rydio.Api.Controllers;

[ApiController]
[Authorize(Policy = RbacPolicies.PolicyManageFleet)]
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
        string? Code,
        string? Name,
        string? StationId,
        int? HourlyRateMkd,
        int? FullDayRateMkd,
        int? BatteryPercent,
        bool? InMaintenance);

    public record CreateTypeRequest(string Name, string Description, int DefaultHourlyRateMkd, int FullDayDiscountPercent = 20);
    public record UpdateTypeRequest(string? Name, string? Description, int? DefaultHourlyRateMkd, int? FullDayDiscountPercent);
    public record CreateStationRequest(string Code, string Name, string District, string Address, int Capacity);
    public record UpdateStationRequest(string? Code, string? Name, string? District, string? Address, int? Capacity);
    public record UpdateReservationStatusRequest(string Status);
    public record CreateUserRequest(string Name, string Email, string Password, string Role);
    public record UpdateUserRoleRequest(string Role);
    public record UpdateUserActiveRequest(bool Active);

    // VEHICLES
    [HttpPost("vehicles")]
    public async Task<IActionResult> AddVehicle([FromBody] CreateVehicleRequest req)
    {
        var code = req.Code.Trim();
        var name = req.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Vehicle name is required." });
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { message = "Vehicle fleet code is required." });
        if (req.HourlyRateMkd < 50)
            return BadRequest(new { message = "Hourly rate must be at least 50 MKD." });

        var codeLower = code.ToLowerInvariant();
        if (await db.Vehicles.AnyAsync(v => v.Code.ToLower() == codeLower))
            return Conflict(new { message = $"Vehicle code \"{code}\" is already in use." });

        var nameLower = name.ToLowerInvariant();
        if (await db.Vehicles.AnyAsync(v => v.Name.ToLower() == nameLower))
            return Conflict(new { message = $"A vehicle named \"{name}\" already exists." });

        var vehicle = new Vehicle
        {
            Code = code,
            Name = name,
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
        if (vehicle is null) return NotFound(new { message = "Vehicle not found." });

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            var nextCode = req.Code.Trim();
            var nextCodeLower = nextCode.ToLowerInvariant();
            if (await db.Vehicles.AnyAsync(v => v.Id != id && v.Code.ToLower() == nextCodeLower))
                return Conflict(new { message = $"Vehicle code \"{nextCode}\" is already in use." });
            vehicle.Code = nextCode;
        }

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            var nextName = req.Name.Trim();
            var nextNameLower = nextName.ToLowerInvariant();
            if (await db.Vehicles.AnyAsync(v => v.Id != id && v.Name.ToLower() == nextNameLower))
                return Conflict(new { message = $"A vehicle named \"{nextName}\" already exists." });
            vehicle.Name = nextName;
        }

        if (req.StationId is not null) vehicle.StationId = req.StationId;
        if (req.HourlyRateMkd.HasValue) vehicle.HourlyRateMkd = Math.Max(50, req.HourlyRateMkd.Value);
        if (req.FullDayRateMkd.HasValue) vehicle.FullDayRateMkd = Math.Max(50, req.FullDayRateMkd.Value);
        if (req.BatteryPercent.HasValue) vehicle.BatteryPercent = Math.Clamp(req.BatteryPercent.Value, 0, 100);
        if (req.InMaintenance.HasValue) vehicle.InMaintenance = req.InMaintenance.Value;

        await db.SaveChangesAsync();
        return Ok(vehicle);
    }

    [HttpDelete("vehicles/{id}")]
    public async Task<IActionResult> DeleteVehicle(string id)
    {
        var vehicle = await db.Vehicles.FindAsync(id);
        if (vehicle is null) return NotFound(new { message = "Vehicle not found." });
        if (await db.Reservations.AnyAsync(r => r.VehicleId == id && (r.Status == "Reserved" || r.Status == "Active")))
            return Conflict(new { message = "Cannot delete a vehicle while it has an active or upcoming reservation." });

        db.Vehicles.Remove(vehicle);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // VEHICLE TYPES
    [Authorize(Policy = RbacPolicies.PolicyManageTypes)]
    [HttpPost("types")]
    public async Task<IActionResult> AddType([FromBody] CreateTypeRequest req)
    {
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Vehicle type name is required." });

        var nameLower = name.ToLowerInvariant();
        if (await db.VehicleTypes.AnyAsync(t => t.Name.ToLower() == nameLower))
            return Conflict(new { message = $"Vehicle type \"{name}\" already exists." });

        var vt = new VehicleType
        {
            Name = name,
            Description = req.Description.Trim(),
            DefaultHourlyRateMkd = Math.Max(50, req.DefaultHourlyRateMkd),
            FullDayDiscountPercent = Math.Clamp(req.FullDayDiscountPercent, 0, 90),
        };
        db.VehicleTypes.Add(vt);
        await db.SaveChangesAsync();
        return Ok(vt);
    }

    [Authorize(Policy = RbacPolicies.PolicyManageTypes)]
    [HttpPatch("types/{id}")]
    public async Task<IActionResult> UpdateType(string id, [FromBody] UpdateTypeRequest req)
    {
        var vt = await db.VehicleTypes.FindAsync(id);
        if (vt is null) return NotFound(new { message = "Vehicle type not found." });

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            var nextName = req.Name.Trim();
            var nextNameLower = nextName.ToLowerInvariant();
            if (await db.VehicleTypes.AnyAsync(t => t.Id != id && t.Name.ToLower() == nextNameLower))
                return Conflict(new { message = $"Vehicle type \"{nextName}\" already exists." });
            vt.Name = nextName;
        }
        if (req.Description is not null) vt.Description = req.Description.Trim();
        if (req.DefaultHourlyRateMkd.HasValue) vt.DefaultHourlyRateMkd = Math.Max(50, req.DefaultHourlyRateMkd.Value);
        if (req.FullDayDiscountPercent.HasValue) vt.FullDayDiscountPercent = Math.Clamp(req.FullDayDiscountPercent.Value, 0, 90);

        await db.SaveChangesAsync();
        return Ok(vt);
    }

    [Authorize(Policy = RbacPolicies.PolicyManageTypes)]
    [HttpDelete("types/{id}")]
    public async Task<IActionResult> DeleteType(string id)
    {
        if (await db.Vehicles.AnyAsync(v => v.TypeId == id))
            return Conflict(new { message = "Cannot delete type while vehicles are still assigned to it." });

        var vt = await db.VehicleTypes.FindAsync(id);
        if (vt is null) return NotFound(new { message = "Vehicle type not found." });
        db.VehicleTypes.Remove(vt);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // STATIONS
    [Authorize(Policy = RbacPolicies.PolicyManageStations)]
    [HttpPost("stations")]
    public async Task<IActionResult> AddStation([FromBody] CreateStationRequest req)
    {
        var code = req.Code.Trim();
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Station name is required." });
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { message = "Station code is required." });

        var codeLower = code.ToLowerInvariant();
        if (await db.Stations.AnyAsync(s => s.Code.ToLower() == codeLower))
            return Conflict(new { message = $"Station code \"{code}\" is already in use." });

        var nameLower = name.ToLowerInvariant();
        if (await db.Stations.AnyAsync(s => s.Name.ToLower() == nameLower))
            return Conflict(new { message = $"Station \"{name}\" already exists." });

        var st = new Station
        {
            Code = code,
            Name = name,
            District = req.District.Trim(),
            Address = req.Address.Trim(),
            Capacity = Math.Max(1, req.Capacity),
        };
        db.Stations.Add(st);
        await db.SaveChangesAsync();
        return Ok(st);
    }

    [Authorize(Policy = RbacPolicies.PolicyManageStations)]
    [HttpPatch("stations/{id}")]
    public async Task<IActionResult> UpdateStation(string id, [FromBody] UpdateStationRequest req)
    {
        var st = await db.Stations.FindAsync(id);
        if (st is null) return NotFound(new { message = "Station not found." });

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            var nextCode = req.Code.Trim();
            var nextCodeLower = nextCode.ToLowerInvariant();
            if (await db.Stations.AnyAsync(s => s.Id != id && s.Code.ToLower() == nextCodeLower))
                return Conflict(new { message = $"Station code \"{nextCode}\" is already in use." });
            st.Code = nextCode;
        }
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            var nextName = req.Name.Trim();
            var nextNameLower = nextName.ToLowerInvariant();
            if (await db.Stations.AnyAsync(s => s.Id != id && s.Name.ToLower() == nextNameLower))
                return Conflict(new { message = $"Station \"{nextName}\" already exists." });
            st.Name = nextName;
        }
        if (!string.IsNullOrWhiteSpace(req.District)) st.District = req.District.Trim();
        if (!string.IsNullOrWhiteSpace(req.Address)) st.Address = req.Address.Trim();
        if (req.Capacity.HasValue) st.Capacity = Math.Max(1, req.Capacity.Value);

        await db.SaveChangesAsync();
        return Ok(st);
    }

    [Authorize(Policy = RbacPolicies.PolicyManageStations)]
    [HttpDelete("stations/{id}")]
    public async Task<IActionResult> DeleteStation(string id)
    {
        if (await db.Vehicles.AnyAsync(v => v.StationId == id))
            return Conflict(new { message = "Move docked vehicles to another station before deleting this station." });

        var st = await db.Stations.FindAsync(id);
        if (st is null) return NotFound(new { message = "Station not found." });
        db.Stations.Remove(st);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // RESERVATIONS OVERRIDE
    [Authorize(Policy = RbacPolicies.PolicyManageReservations)]
    [HttpPatch("reservations/{id}/status")]
    public async Task<IActionResult> SetReservationStatus(string id, [FromBody] UpdateReservationStatusRequest req)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound(new { message = "Reservation not found." });
        if (req.Status is not ("Reserved" or "Active" or "Completed" or "Cancelled"))
            return BadRequest(new { message = "Invalid status." });

        res.Status = req.Status;
        await db.SaveChangesAsync();
        return Ok(res);
    }

    [Authorize(Policy = RbacPolicies.PolicyDeleteReservations)]
    [HttpDelete("reservations/{id}")]
    public async Task<IActionResult> DeleteReservation(string id)
    {
        var res = await db.Reservations.FindAsync(id);
        if (res is null) return NotFound(new { message = "Reservation not found." });
        db.Reservations.Remove(res);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // SUPERADMIN USERS & ROLES (RBAC CONTROL CENTER)
    [Authorize(Policy = RbacPolicies.PolicyManageUsers)]
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
    {
        var name = req.Name.Trim();
        var email = req.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Full name is required." });
        if (!email.Contains('@'))
            return BadRequest(new { message = "A valid email address is required." });
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });
        if (RbacPolicies.IsPrimarySuperAdminEmail(email))
            return Conflict(new { message = "The primary SuperAdmin email is reserved." });
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == email))
            return Conflict(new { message = $"An account with email \"{email}\" already exists." });

        if (string.Equals(req.Role, RbacPolicies.RoleSuperAdmin, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only superadmin@rydio.mk can hold the SuperAdmin role. Assign Customer or Admin." });

        if (req.Role is not ("Customer" or "Admin"))
            return BadRequest(new { message = "Role must be Customer or Admin." });

        var user = new User
        {
            Name = name,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = req.Role,
            Active = true,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.Name,
            user.Email,
            user.Role,
            Permissions = RbacPolicies.GetPermissionsForRole(user.Role),
            user.Active,
            user.CreatedAt
        });
    }

    [Authorize(Policy = RbacPolicies.PolicyManageUsers)]
    [HttpPatch("users/{id}/role")]
    public async Task<IActionResult> UpdateUserRole(string id, [FromBody] UpdateUserRoleRequest req)
    {
        var selfId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == selfId) return BadRequest(new { message = "You cannot change your own SuperAdmin role." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound(new { message = "User account not found." });
        if (RbacPolicies.IsPrimarySuperAdminEmail(user.Email))
            return BadRequest(new { message = "The primary SuperAdmin account role cannot be modified." });

        if (string.Equals(req.Role, RbacPolicies.RoleSuperAdmin, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only superadmin@rydio.mk can hold the SuperAdmin role." });

        if (req.Role is not ("Customer" or "Admin"))
            return BadRequest(new { message = "Assignable roles are Customer or Admin." });

        user.Role = req.Role;
        await db.SaveChangesAsync();
        return Ok(new
        {
            user.Id,
            user.Name,
            user.Email,
            user.Role,
            Permissions = RbacPolicies.GetPermissionsForRole(user.Role),
            user.Active,
            user.CreatedAt
        });
    }

    [Authorize(Policy = RbacPolicies.PolicyManageUsers)]
    [HttpPatch("users/{id}/active")]
    public async Task<IActionResult> UpdateUserActive(string id, [FromBody] UpdateUserActiveRequest req)
    {
        var selfId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == selfId) return BadRequest(new { message = "You cannot suspend your own SuperAdmin account." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound(new { message = "User account not found." });
        if (RbacPolicies.IsPrimarySuperAdminEmail(user.Email))
            return BadRequest(new { message = "The primary SuperAdmin account cannot be suspended." });

        user.Active = req.Active;
        await db.SaveChangesAsync();
        return Ok(new
        {
            user.Id,
            user.Name,
            user.Email,
            Role = RbacPolicies.NormalizeRole(user.Email, user.Role),
            user.Active,
            user.CreatedAt
        });
    }

    [Authorize(Policy = RbacPolicies.PolicyManageUsers)]
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var selfId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id == selfId) return BadRequest(new { message = "You cannot delete your own SuperAdmin account." });

        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound(new { message = "User account not found." });
        if (RbacPolicies.IsPrimarySuperAdminEmail(user.Email))
            return BadRequest(new { message = "The primary SuperAdmin account cannot be deleted." });

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
