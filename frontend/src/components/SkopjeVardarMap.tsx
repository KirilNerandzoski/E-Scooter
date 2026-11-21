import type { Station } from '../types/rydio';

interface StationPinInfo {
  station: Station;
  freeCount: number;
}

interface SkopjeVardarMapProps {
  items: StationPinInfo[];
  selectedStationId: string | null;
  onSelectStation: (stationId: string) => void;
}

const STATION_COORDS: Record<string, { x: number; y: number }> = {
  'st-karpos': { x: 185, y: 122 },
  'st-park': { x: 325, y: 74 },
  'st-debar': { x: 382, y: 162 },
  'st-plostad': { x: 486, y: 182 },
  'st-eastgate': { x: 650, y: 136 },
  'st-aerodrom': { x: 695, y: 244 },
};

export function SkopjeVardarMap({
  items,
  selectedStationId,
  onSelectStation,
}: SkopjeVardarMapProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#DDE2E8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE2E8] bg-[#F6F7F9] px-5 py-3">
        <span className="text-[11px] font-medium tracking-[0.14em] text-[#515F73]">
          SKOPJE · VARDAR RIVER CORRIDOR
        </span>
        <span className="text-[11px] text-[#515F73]">
          Click any station node to highlight or browse its fleet
        </span>
      </div>

      <div className="relative w-full overflow-x-auto bg-[#F6F7F9]/60 p-4">
        <svg
          viewBox="0 0 860 310"
          role="img"
          aria-label="Interactive Skopje station map along the Vardar River"
          className="h-auto min-w-[620px] w-full"
        >
          {/* Subtle cartographic grid lines */}
          {[80, 160, 240].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="860"
              y2={y}
              stroke="#DDE2E8"
              strokeWidth="0.8"
              strokeDasharray="3 5"
            />
          ))}
          {[170, 340, 510, 680].map((x) => (
            <line
              key={x}
              x1={x}
              y1="0"
              x2={x}
              y2="310"
              stroke="#DDE2E8"
              strokeWidth="0.8"
              strokeDasharray="3 5"
            />
          ))}

          {/* Vardar River — flowing Suminagashi indigo current */}
          <path
            d="M 10 148 C 120 120, 210 92, 330 122 C 425 146, 485 162, 575 182 C 675 204, 755 215, 850 258"
            fill="none"
            stroke="#0A1A33"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.09"
          />
          <path
            d="M 10 148 C 120 120, 210 92, 330 122 C 425 146, 485 162, 575 182 C 675 204, 755 215, 850 258"
            fill="none"
            stroke="#0A1A33"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.42"
          />
          <path
            d="M 10 154 C 120 126, 210 98, 330 128 C 425 152, 485 168, 575 188 C 675 210, 755 221, 850 264"
            fill="none"
            stroke="#606D80"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <text
            x="64"
            y="112"
            fill="#515F73"
            fontSize="10"
            letterSpacing="0.22em"
            fontFamily="Manrope, sans-serif"
          >
            VARDAR RIVER
          </text>

          {/* Subtle connecting mobility corridor lines */}
          <path
            d="M 185 122 L 325 98 L 382 158 L 486 176 L 650 142 M 486 176 L 695 244"
            fill="none"
            stroke="#8C97A8"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.65"
          />

          {/* Interactive Station Nodes */}
          {items.map(({ station, freeCount }, idx) => {
            const coord = STATION_COORDS[station.id] ?? {
              x: 150 + ((idx * 125) % 620),
              y: 90 + ((idx * 55) % 160),
            };
            const isSelected = selectedStationId === station.id;

            return (
              <g
                key={station.id}
                transform={`translate(${coord.x}, ${coord.y})`}
                onClick={() => onSelectStation(station.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectStation(station.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${station.name}, ${freeCount} vehicles free`}
                className="cursor-pointer outline-none"
              >
                {isSelected && (
                  <circle r="20" fill="#0A1A33" opacity="0.12" />
                )}
                <circle
                  r={isSelected ? '11' : '8.5'}
                  fill={isSelected ? '#0A1A33' : '#FFFFFF'}
                  stroke="#0A1A33"
                  strokeWidth="1.8"
                />
                <text
                  y="3.5"
                  textAnchor="middle"
                  fill={isSelected ? '#FFFFFF' : '#0A1A33'}
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="Manrope, sans-serif"
                >
                  {freeCount}
                </text>

                {/* Crisp station label */}
                <g transform="translate(0, 24)">
                  <text
                    textAnchor="middle"
                    fill="#0A1A33"
                    fontSize="11"
                    fontWeight={isSelected ? '600' : '500'}
                    fontFamily="Manrope, sans-serif"
                  >
                    {station.name}
                  </text>
                  <text
                    y="13"
                    textAnchor="middle"
                    fill="#515F73"
                    fontSize="9.5"
                    letterSpacing="0.1em"
                    fontFamily="Manrope, sans-serif"
                  >
                    {station.code}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
