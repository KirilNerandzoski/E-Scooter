using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Rydio.Api.Data;
using Rydio.Api.Middleware;
using Rydio.Api.Security;
using Rydio.Api.Services;

var builder = WebApplication.CreateBuilder(args);

static string ResolvePostgresConnectionString(IConfiguration config)
{
    var raw = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? config.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Port=5432;Database=rydio;Username=postgres;Password=postgres";

    if (raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(raw);
        var userInfo = uri.UserInfo.Split(':', 2);
        var csb = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
            SslMode = SslMode.Require,
        };
        return csb.ConnectionString;
    }

    return raw;
}

var connStr = ResolvePostgresConnectionString(builder.Configuration);
builder.Services.AddDbContext<RydioDbContext>(opt => opt.UseNpgsql(connStr));

var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? builder.Configuration["Jwt:Secret"]
    ?? "rydio-dev-super-secret-signing-key-change-in-production-2026!";

builder.Services.AddSingleton<JwtService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "rydio-api",
            ValidateAudience = true,
            ValidAudience = "rydio-web",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateLifetime = true,
        };

        opt.Events = new JwtBearerEvents
        {
            // Hydrate live role & fine-grained RBAC permissions directly from PostgreSQL on every request
            OnTokenValidated = async context =>
            {
                var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrWhiteSpace(userId))
                {
                    context.Fail("Missing user identifier.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<RydioDbContext>();
                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, context.HttpContext.RequestAborted);
                if (user is null || !user.Active)
                {
                    context.Fail("Account is inactive or does not exist.");
                    return;
                }

                if (context.Principal?.Identity is ClaimsIdentity identity)
                {
                    var effectiveRole = RbacPolicies.NormalizeRole(user.Email, user.Role);

                    foreach (var oldRole in identity.FindAll(ClaimTypes.Role).ToList())
                        identity.RemoveClaim(oldRole);
                    foreach (var oldPerm in identity.FindAll(RbacPolicies.PermissionClaimType).ToList())
                        identity.RemoveClaim(oldPerm);

                    identity.AddClaim(new Claim(ClaimTypes.Role, effectiveRole));
                    foreach (var perm in RbacPolicies.GetPermissionsForRole(effectiveRole))
                    {
                        identity.AddClaim(new Claim(RbacPolicies.PermissionClaimType, perm));
                    }
                }
            },
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    message = "Authentication required. Please sign in to continue.",
                    code = "UNAUTHORIZED",
                    status = StatusCodes.Status401Unauthorized
                }));
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    message = "Access denied: your account role does not have permission to modify the website.",
                    code = "FORBIDDEN",
                    status = StatusCodes.Status403Forbidden
                }));
            }
        };
    });

builder.Services.AddAuthorization(RbacPolicies.RegisterPolicies);
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services
    .AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var firstError = context.ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage) ? "Invalid input value." : e.ErrorMessage)
                .FirstOrDefault() ?? "Invalid request parameters.";

            return new BadRequestObjectResult(new
            {
                message = firstError,
                code = "VALIDATION_ERROR",
                status = StatusCodes.Status400BadRequest
            });
        };
    });

builder.Services.AddCors(opt =>
{
    opt.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://kirilnerandzoski.github.io"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// Ensure schema exists and seed Skopje stations, fleet, and SuperAdmin on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<RydioDbContext>();
    await DbSeeder.SeedAsync(db);
}

app.UseExceptionHandler();
app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "rydio-dotnet10-api" }));
app.MapControllers();
app.MapFallbackToFile("index.html");

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
app.Run($"http://0.0.0.0:{port}");
