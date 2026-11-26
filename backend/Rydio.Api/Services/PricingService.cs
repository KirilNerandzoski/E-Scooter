using System.Globalization;
using Rydio.Api.Models;

namespace Rydio.Api.Services;

public record PricingResult(
    bool Valid,
    string? Error,
    int BasePriceMkd,
    int DiscountAppliedMkd,
    int FinalPriceMkd
);

public record PickupValidationResult(bool Allowed, string? Error);

public static class PricingService
{
    public const int MaxRentalHours = 7 * 24;
    public const double LatePenaltyMultiplier = 1.5;
    public const int PickupEarlyWindowMinutes = 30;
    public const int CancelCutoffHours = 1;

    /// <summary>
    /// Computes the default full-day rate cap from a vehicle's hourly tariff and its VehicleType's full-day discount percentage.
    /// </summary>
    public static int DeriveFullDayRateMkd(int hourlyRateMkd, int fullDayDiscountPercent)
    {
        var safeHourly = Math.Max(50, hourlyRateMkd);
        var clampedDiscount = Math.Clamp(fullDayDiscountPercent, 0, 90);
        var derived = (int)Math.Round(safeHourly * 24.0 * (100 - clampedDiscount) / 100.0);
        return Math.Max(safeHourly, derived);
    }

    public static PricingResult Calculate(
        Vehicle vehicle,
        DateTimeOffset start,
        DateTimeOffset end,
        DateTimeOffset? nowOverride = null)
    {
        var now = nowOverride ?? DateTimeOffset.UtcNow;
        if (start < now.AddMinutes(-5))
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

        var fullDayCap = vehicle.FullDayRateMkd > 0
            ? vehicle.FullDayRateMkd
            : DeriveFullDayRateMkd(vehicle.HourlyRateMkd, vehicle.Type?.FullDayDiscountPercent ?? 20);

        var discounted = fullDays * fullDayCap;
        if (remainingHours > 0)
            discounted += Math.Min(remainingHours * vehicle.HourlyRateMkd, fullDayCap);

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

    public static PickupValidationResult ValidatePickupWindow(
        Reservation reservation,
        DateTimeOffset now,
        bool isAdminOverride = false)
    {
        if (reservation.Status != "Reserved")
            return new(false, "Only Reserved bookings can be picked up.");

        if (isAdminOverride)
            return new(true, null);

        var earliestPickup = reservation.StartTime.AddMinutes(-PickupEarlyWindowMinutes);
        if (now < earliestPickup)
            return new(false, $"Pickup opens {PickupEarlyWindowMinutes} minutes before your scheduled start time.");

        if (now >= reservation.EndTime)
            return new(false, "This reservation window has already ended and can no longer be picked up.");

        return new(true, null);
    }

    public static bool CanCancelReservation(
        Reservation reservation,
        DateTimeOffset now,
        bool isAdminOverride = false)
    {
        if (reservation.Status != "Reserved") return false;
        if (isAdminOverride) return true;
        return (reservation.StartTime - now) >= TimeSpan.FromHours(CancelCutoffHours);
    }

    /// <summary>
    /// Aggregates live lifetime monthly sales strictly from Completed reservations across all users
    /// (no predefined/seeded numbers). Initializes a rolling 6-month window ending at referenceNow
    /// with 0 MKD and includes any additional lifetime months that have completed sales, ordered chronologically.
    /// </summary>
    public static List<MonthlyRevenueRecord> BuildMonthlyRevenue(
        IEnumerable<Reservation> reservations,
        DateTimeOffset? referenceNow = null)
    {
        var refUtc = (referenceNow ?? DateTimeOffset.UtcNow).ToUniversalTime();
        var anchorMonth = new DateTime(refUtc.Year, refUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var buckets = new SortedDictionary<int, (int MonthNum, int Year, string RawLabel, int RevenueMkd, int Rides)>();

        for (var offset = -5; offset <= 0; offset++)
        {
            var m = anchorMonth.AddMonths(offset);
            var ym = m.Year * 100 + m.Month;
            var shortMonth = m.ToString("MMM", CultureInfo.InvariantCulture);
            buckets[ym] = (m.Month, m.Year, shortMonth, 0, 0);
        }

        foreach (var r in reservations)
        {
            // Strictly count Completed reservations toward monthly & lifetime sales
            if (r.Status != "Completed")
                continue;

            var completedAt = (r.ActualReturnTime ?? r.EndTime).ToUniversalTime();
            var ym = completedAt.Year * 100 + completedAt.Month;
            var shortMonth = completedAt.ToString("MMM", CultureInfo.InvariantCulture);
            var saleAmount = r.TotalPriceMkd + r.LatePenaltyMkd;

            if (buckets.TryGetValue(ym, out var existing))
            {
                buckets[ym] = existing with
                {
                    RevenueMkd = existing.RevenueMkd + saleAmount,
                    Rides = existing.Rides + 1,
                };
            }
            else
            {
                buckets[ym] = (completedAt.Month, completedAt.Year, shortMonth, saleAmount, 1);
            }
        }

        var duplicateMonthCounts = buckets.Values
            .GroupBy(x => x.RawLabel, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        return buckets
            .Select(kvp =>
            {
                var v = kvp.Value;
                var label = duplicateMonthCounts.GetValueOrDefault(v.RawLabel) > 1
                    ? $"{v.RawLabel} '{v.Year % 100:D2}"
                    : v.RawLabel;

                return new MonthlyRevenueRecord
                {
                    Month = label,
                    SortOrder = kvp.Key,
                    RevenueMkd = v.RevenueMkd,
                    Rides = v.Rides,
                };
            })
            .ToList();
    }
}
