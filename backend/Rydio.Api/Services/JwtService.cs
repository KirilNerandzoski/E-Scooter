using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Rydio.Api.Models;
using Rydio.Api.Security;

namespace Rydio.Api.Services;

public class JwtService(IConfiguration config)
{
    public string CreateToken(User user)
    {
        var secret = config["JWT_SECRET"]
            ?? config["Jwt:Secret"]
            ?? "rydio-dev-super-secret-signing-key-change-in-production-2026!";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var effectiveRole = RbacPolicies.NormalizeRole(user.Email, user.Role);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, effectiveRole),
        };

        foreach (var perm in RbacPolicies.GetPermissionsForRole(effectiveRole))
        {
            claims.Add(new Claim(RbacPolicies.PermissionClaimType, perm));
        }

        var token = new JwtSecurityToken(
            issuer: "rydio-api",
            audience: "rydio-web",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
