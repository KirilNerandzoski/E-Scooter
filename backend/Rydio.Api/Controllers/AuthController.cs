using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rydio.Api.Data;
using Rydio.Api.Models;
using Rydio.Api.Services;

namespace Rydio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(RydioDbContext db, JwtService jwt) : ControllerBase
{
    public record LoginRequest(string Email, string Password);
    public record RegisterRequest(string Name, string Email, string Password);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        if (!user.Active)
            return StatusCode(403, new { message = "This account has been suspended by an administrator." });

        return Ok(new
        {
            token = jwt.CreateToken(user),
            user = ToUserDto(user)
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        var name = req.Name.Trim();
        var email = req.Email.Trim().ToLowerInvariant();

        if (name.Length < 2) return BadRequest(new { message = "Full name is required." });
        if (!email.Contains('@')) return BadRequest(new { message = "Valid email is required." });
        if (req.Password.Length < 6) return BadRequest(new { message = "Password must be at least 6 characters." });

        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with this email already exists." });

        var role = email is "superadmin@rydio.mk" or "kiril.nerandz99@gmail.com"
            ? "SuperAdmin"
            : "Customer";

        var user = new User
        {
            Name = name,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = role,
            Active = true,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new
        {
            token = jwt.CreateToken(user),
            user = ToUserDto(user)
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await db.Users.FindAsync(userId);
        if (user is null || !user.Active) return Unauthorized();
        return Ok(ToUserDto(user));
    }

    private static object ToUserDto(User u) => new
    {
        id = u.Id,
        name = u.Name,
        email = u.Email,
        role = u.Role,
        active = u.Active,
        createdAt = u.CreatedAt
    };
}
