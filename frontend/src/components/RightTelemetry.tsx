interface RightTelemetryProps {
  freeNow: number;
  stationsCount: number;
  activeRidesCount: number;
}

export function RightTelemetry({
  freeNow,
  stationsCount,
  activeRidesCount,
}: RightTelemetryProps) {
  return (
    <aside
      aria-label="Live fleet metrics"
      className="hidden xl:fixed xl:inset-y-0 xl:right-0 xl:z-10 xl:flex xl:w-[116px] xl:flex-col xl:justify-end xl:border-l xl:border-[#DDE2E8]/80 xl:bg-[#F6F7F9]/85 xl:px-4 xl:py-8"
    >
      <div className="space-y-6">
        <div>
          <p className="text-[9px] font-medium tracking-[0.16em] text-[#515F73]">FREE NOW</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-[#0A1A33]">
            {freeNow}
          </p>
        </div>

        <div className="h-px w-8 bg-[#DDE2E8]" />

        <div>
          <p className="text-[9px] font-medium tracking-[0.16em] text-[#515F73]">STATIONS</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-[#0A1A33]">
            {String(stationsCount).padStart(2, '0')}
          </p>
        </div>

        <div className="h-px w-8 bg-[#DDE2E8]" />

        <div>
          <p className="text-[9px] font-medium tracking-[0.16em] text-[#515F73]">DAY PASS</p>
          <p className="tabular-nums mt-1 font-display text-lg font-medium text-[#0A1A33]">
            -20%
          </p>
        </div>

        <div className="h-px w-8 bg-[#DDE2E8]" />

        <div>
          <p className="text-[9px] font-medium tracking-[0.16em] text-[#515F73]">MAX TERM</p>
          <p className="tabular-nums mt-1 font-display text-sm font-medium text-[#0A1A33]">
            7 DAYS
          </p>
        </div>

        {activeRidesCount > 0 && (
          <>
            <div className="h-px w-8 bg-[#DDE2E8]" />
            <div>
              <p className="text-[9px] font-medium tracking-[0.16em] text-[#515F73]">
                ON ROAD
              </p>
              <p className="tabular-nums mt-1 font-display text-sm font-medium text-[#0A1A33]">
                {activeRidesCount} ACTIVE
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
