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
      className="hidden xl:fixed xl:inset-y-0 xl:right-0 xl:z-10 xl:flex xl:w-[128px] xl:flex-col xl:justify-end xl:border-l xl:border-[#DDE2E8]/80 xl:bg-[#F6F7F9]/85 xl:px-4 xl:py-8"
    >
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">WINDOW</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-[#0A1A33]">
            {windowDurationLabel}
          </p>
        </div>

        <div className="h-px w-8 bg-[#DDE2E8]" />

        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">MATCHING</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-[#0A1A33]">
            {windowFreeCount} free
          </p>
        </div>

        <div className="h-px w-8 bg-[#DDE2E8]" />

        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">HUB</p>
          <p className="mt-1 text-xs font-medium leading-snug text-[#0A1A33]">
            {selectedStationLabel}
          </p>
        </div>

        <div className="h-px w-8 bg-[#DDE2E8]" />

        <div>
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">TARIFF</p>
          <p className="mt-1 text-xs font-medium text-[#0A1A33]">Daily cap</p>
          <p className="text-[11px] text-[#515F73]">Max 7 days</p>
        </div>

        {activeRidesCount > 0 && (
          <>
            <div className="h-px w-8 bg-[#DDE2E8]" />
            <div>
              <p className="text-[11px] font-medium tracking-[0.12em] text-[#515F73]">ON ROAD</p>
              <p className="tabular-nums mt-1 text-xs font-semibold text-[#0A1A33]">
                {activeRidesCount} active
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
