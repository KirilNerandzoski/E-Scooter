using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Rydio.Api.Middleware;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, code, message) = MapException(exception);

        if (statusCode >= 500)
        {
            logger.LogError(exception, "Unhandled exception on {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            logger.LogWarning("Handled API error ({StatusCode} {Code}) on {Method} {Path}: {Message}",
                statusCode, code, httpContext.Request.Method, httpContext.Request.Path, message);
        }

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/json";

        var payload = new
        {
            message,
            code,
            status = statusCode
        };

        await httpContext.Response.WriteAsync(JsonSerializer.Serialize(payload), cancellationToken);
        return true;
    }

    private static (int StatusCode, string Code, string Message) MapException(Exception ex)
    {
        if (ex is DbUpdateConcurrencyException)
        {
            return (StatusCodes.Status409Conflict, "CONCURRENCY_CONFLICT",
                "This record was modified by another request. Please refresh and try again.");
        }

        if (ex is DbUpdateException dbEx)
        {
            if (dbEx.InnerException is PostgresException pgEx)
            {
                return MapPostgresException(pgEx);
            }

            return (StatusCodes.Status409Conflict, "DATABASE_CONFLICT",
                "Database rejected the change because it conflicts with existing records.");
        }

        if (ex is PostgresException directPgEx)
        {
            return MapPostgresException(directPgEx);
        }

        if (ex is BadHttpRequestException or JsonException)
        {
            return (StatusCodes.Status400BadRequest, "INVALID_REQUEST",
                "Invalid request payload. Please check your input values.");
        }

        if (ex is ArgumentException argEx)
        {
            return (StatusCodes.Status400BadRequest, "VALIDATION_ERROR",
                string.IsNullOrWhiteSpace(argEx.Message) ? "Invalid input value." : argEx.Message);
        }

        if (ex is UnauthorizedAccessException)
        {
            return (StatusCodes.Status403Forbidden, "FORBIDDEN",
                "You do not have permission to perform this action.");
        }

        return (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR",
            "Service request failed due to an unexpected server error.");
    }

    private static (int StatusCode, string Code, string Message) MapPostgresException(PostgresException pgEx)
    {
        var constraint = pgEx.ConstraintName ?? string.Empty;

        return pgEx.SqlState switch
        {
            PostgresErrorCodes.UniqueViolation => (
                StatusCodes.Status409Conflict,
                "DUPLICATE_ENTRY",
                constraint switch
                {
                    _ when constraint.Contains("Vehicles_Code", StringComparison.OrdinalIgnoreCase) =>
                        "A vehicle with that fleet code already exists.",
                    _ when constraint.Contains("Vehicles_Name", StringComparison.OrdinalIgnoreCase) =>
                        "A vehicle with that name already exists.",
                    _ when constraint.Contains("VehicleTypes_Name", StringComparison.OrdinalIgnoreCase) =>
                        "A vehicle type with that name already exists.",
                    _ when constraint.Contains("Stations_Code", StringComparison.OrdinalIgnoreCase) =>
                        "A station with that code already exists.",
                    _ when constraint.Contains("Stations_Name", StringComparison.OrdinalIgnoreCase) =>
                        "A station with that name already exists.",
                    _ when constraint.Contains("Users_Email", StringComparison.OrdinalIgnoreCase) =>
                        "An account with that email address already exists.",
                    _ => "Duplicate entry: a record with the same name or code already exists."
                }),

            PostgresErrorCodes.ForeignKeyViolation => (
                StatusCodes.Status409Conflict,
                "DEPENDENCY_CONFLICT",
                "Cannot complete this action because related vehicles or reservations depend on this record."),

            PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected => (
                StatusCodes.Status409Conflict,
                "CONCURRENCY_CONFLICT",
                "This vehicle was just modified or reserved by another request. Please refresh and try again."),

            PostgresErrorCodes.NotNullViolation => (
                StatusCodes.Status400BadRequest,
                "MISSING_REQUIRED_FIELD",
                $"Required field '{pgEx.ColumnName ?? "value"}' cannot be empty."),

            _ => (
                StatusCodes.Status400BadRequest,
                "DATABASE_ERROR",
                "Could not save changes to the database. Please verify your inputs.")
        };
    }
}
