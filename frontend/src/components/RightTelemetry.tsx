interface RightTelemetryProps {
  windowDurationLabel: string;
  windowFreeCount: number;
  selectedStationLabel: string;
  activeRidesCount: number;
}

/**
 * Quiet desktop margin displaying selected-window trip context (zero duplication of LeftRail totals).
 */
export function RightTelemetry({
  windowDurationLabel,
  windowFreeCount,
  selectedStationLabel,
  activeRidesCount,
}: RightTelemetryProps) {
  return (
    <aside
      aria-label="Selected rental window context"
      className="hidden xl:fixed xl:inset-y-0 xl:right-0 xl:z-10 xl:flex xl:w-[128px] xl:flex-col xl:justify-end xl:border-l xl:border-mist/80 xl:bg-paper-white/85 xl:px-4 xl:py-8"
    >
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">WINDOW</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-indigo-depth">
            {windowDurationLabel}
          </p>
        </div>

        <div className="h-px w-8 bg-mist" />

        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">MATCHING</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-indigo-depth">
            {windowFreeCount} free
          </p>
        </div>

        <div className="h-px w-8 bg-mist" />

        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">HUB</p>
          <p className="mt-1 text-xs font-medium leading-snug text-indigo-depth">
            {selectedStationLabel}
          </p>
        </div>

        <div className="h-px w-8 bg-mist" />

        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">TARIFF</p>
          <p className="mt-1 text-xs font-medium text-indigo-depth">Daily cap</p>
          <p className="text-[11px] text-dilute-ink">Max 7 days</p>
        </div>

        {activeRidesCount > 0 && (
          <>
            <div className="h-px w-8 bg-mist" />
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-dilute-ink">ON ROAD</p>
              <p className="tabular-nums mt-1 text-xs font-semibold text-indigo-depth">
                {activeRidesCount} active
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
