using Rydio.Api.Models;

namespace Rydio.Api.Services;

public record PricingResult(
    bool Valid,
    string? Error,
    int BasePriceMkd,
    int DiscountAppliedMkd,
    int FinalPriceMkd
);

public static class PricingService
{
    public const int MaxRentalHours = 7 * 24;
    public const double LatePenaltyMultiplier = 1.5;

    public static PricingResult Calculate(Vehicle vehicle, DateTimeOffset start, DateTimeOffset end)
    {
        if (start < DateTimeOffset.UtcNow.AddMinutes(-5))
            return new(false, "Start time cannot be in the past.", 0, 0, 0);

        var diff = end - start;
        if (diff <= TimeSpan.Zero)
            return new(false, "End time must be after start time.", 0, 0, 0);

        var totalHours = (int)Math.Ceiling(diff.TotalHours);
        if (totalHours > MaxRentalHours)
            return new(false, "Maximum rental duration is 7 days (168 hours).", 0, 0, 0);

        var fullDays = totalHours / 24;
        var remainingHours = totalHours % 24;
        var undiscounted = totalHours * vehicle.HourlyRateMkd;

        var discounted = fullDays * vehicle.FullDayRateMkd;
        if (remainingHours > 0)
            discounted += Math.Min(remainingHours * vehicle.HourlyRateMkd, vehicle.FullDayRateMkd);

        var discountApplied = Math.Max(0, undiscounted - discounted);
        return new(true, null, undiscounted, discountApplied, discounted);
    }

    public static int CalculateLatePenalty(Vehicle vehicle, DateTimeOffset bookedEnd, DateTimeOffset actualReturn)
    {
        var overdue = actualReturn - bookedEnd;
        if (overdue <= TimeSpan.Zero) return 0;
        var lateHours = (int)Math.Ceiling(overdue.TotalHours);
        return (int)Math.Round(lateHours * vehicle.HourlyRateMkd * LatePenaltyMultiplier);
    }
}
