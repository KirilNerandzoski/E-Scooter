namespace Rydio.Api.Models;

public class User
{
    public string Id { get; set; } = $"usr-{Guid.NewGuid():N}";
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Customer"; // Customer | Admin | SuperAdmin
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Station
{
    public string Id { get; set; } = $"st-{Guid.NewGuid():N}";
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int Capacity { get; set; } = 10;
}

public class VehicleType
{
    public string Id { get; set; } = $"vt-{Guid.NewGuid():N}";
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int DefaultHourlyRateMkd { get; set; } = 180;
    public int FullDayDiscountPercent { get; set; } = 20;
}

public class Vehicle
{
    public string Id { get; set; } = $"veh-{Guid.NewGuid():N}";
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string TypeId { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public int HourlyRateMkd { get; set; }
    public int FullDayRateMkd { get; set; }
    public int BatteryPercent { get; set; } = 100;
    public int RangeKm { get; set; } = 45;
    public int MaxSpeedKmh { get; set; } = 25;
    public bool InMaintenance { get; set; }
    public bool Featured { get; set; }

    public VehicleType? Type { get; set; }
    public Station? Station { get; set; }
}

public class Reservation
{
    public string Id { get; set; } = $"RES-{Random.Shared.Next(1050, 9999)}";
    public string VehicleId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string PickupStationId { get; set; } = string.Empty;
    public string? ReturnStationId { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset EndTime { get; set; }
    public DateTimeOffset? ActualReturnTime { get; set; }
    public string Status { get; set; } = "Reserved"; // Reserved | Active | Completed | Cancelled
    public int BasePriceMkd { get; set; }
    public int DiscountAppliedMkd { get; set; }
    public int LatePenaltyMkd { get; set; }
    public int TotalPriceMkd { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Vehicle? Vehicle { get; set; }
}

public class MonthlyRevenueRecord
{
    public string Month { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int RevenueMkd { get; set; }
    public int Rides { get; set; }
}
