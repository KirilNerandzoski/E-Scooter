import { ArrowRight, MapPin } from 'lucide-react';
import type { Station } from '../types/rydio';

interface StationPinInfo {
  station: Station;
  freeCount: number;
}

interface SkopjeVardarMapProps {
  items: StationPinInfo[];
  selectedStationId: string | null;
  onSelectStation: (stationId: string) => void;
  onBrowseStation?: (stationId: string) => void;
}

const STATION_COORDS: Record<string, { x: number; y: number }> = {
  'st-karpos': { x: 185, y: 122 },
  'st-park': { x: 318, y: 88 },
  'st-debar': { x: 388, y: 162 },
  'st-plostad': { x: 492, y: 186 },
  'st-eastgate': { x: 642, y: 130 },
  'st-aerodrom': { x: 682, y: 236 },
};

export function SkopjeVardarMap({
  items,
  selectedStationId,
  onSelectStation,
  onBrowseStation,
}: SkopjeVardarMapProps) {
  const selectedItem =
    items.find((x) => x.station.id === selectedStationId) ?? items[0] ?? null;

  return (
    <div className="overflow-hidden rounded-lg border border-mist bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mist bg-paper-white px-4 py-3 sm:px-5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-dilute-ink">
          SKOPJE · VARDAR RIVER CORRIDOR
        </span>
        <span className="text-[11px] text-dilute-ink">
          Tap any station node to inspect availability
        </span>
      </div>

      <div className="relative w-full bg-paper-white/60 p-2.5 sm:p-4">
        <svg
          viewBox="110 34 650 256"
          role="group"
          aria-label="Interactive Skopje station map along the Vardar River"
          className="h-auto w-full select-none"
        >
          {/* Subtle cartographic grid lines */}
          {[80, 160, 240].map((y) => (
            <line
              key={y}
              x1="110"
              y1={y}
              x2="760"
              y2={y}
              stroke="var(--color-mist)"
              strokeWidth="0.8"
              strokeDasharray="3 5"
            />
          ))}
          {[190, 340, 490, 640].map((x) => (
            <line
              key={x}
              x1={x}
              y1="34"
              x2={x}
              y2="290"
              stroke="var(--color-mist)"
              strokeWidth="0.8"
              strokeDasharray="3 5"
            />
          ))}

          {/* Vardar River — northern City Park meander + Gazi Baba / Aerodrom bend */}
          <path
            d="M 100 112 C 165 88, 245 44, 336 54 C 412 62, 468 150, 575 174 C 655 190, 715 204, 770 228"
            fill="none"
            stroke="var(--color-indigo-depth)"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.09"
          />
          <path
            d="M 100 112 C 165 88, 245 44, 336 54 C 412 62, 468 150, 575 174 C 655 190, 715 204, 770 228"
            fill="none"
            stroke="var(--color-indigo-depth)"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.42"
          />
          <path
            d="M 100 118 C 165 94, 245 50, 336 60 C 412 68, 468 156, 575 180 C 655 196, 715 210, 770 234"
            fill="none"
            stroke="var(--color-dilute-ink)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.35"
          />
          <text
            x="126"
            y="58"
            fill="var(--color-dilute-ink)"
            fontSize="11"
            letterSpacing="0.2em"
            fontFamily="Manrope, sans-serif"
          >
            VARDAR RIVER
          </text>

          {/* Subtle connecting mobility corridor lines (south-bank bikeway + East Gate crossing) */}
          <path
            d="M 185 122 L 318 88 L 388 162 L 492 186 L 682 236 M 492 186 L 642 130"
            fill="none"
            stroke="var(--color-feathered-gray)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.65"
          />

          {/* Interactive Station Nodes */}
          {items.map(({ station, freeCount }, idx) => {
            const coord = STATION_COORDS[station.id] ?? {
              x: 185 + ((idx * 105) % 500),
              y: 85 + ((idx * 50) % 150),
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
                aria-pressed={isSelected}
                className="cursor-pointer focus-visible:outline-none [&:focus-visible_.focus-ring]:opacity-100"
              >
                {/* Generous touch target circle for mobile taps */}
                <circle r="30" fill="transparent" />
                <circle
                  r="24"
                  fill="none"
                  stroke="var(--color-indigo-depth)"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                  className="focus-ring opacity-0 transition-opacity"
                />
                {isSelected && <circle r="21" fill="var(--color-indigo-depth)" opacity="0.12" />}
                <circle
                  r={isSelected ? '13' : '10.5'}
                  fill={isSelected ? 'var(--color-indigo-depth)' : 'var(--color-surface-pure)'}
                  stroke="var(--color-indigo-depth)"
                  strokeWidth="2"
                />
                <text
                  y="4"
                  textAnchor="middle"
                  fill={isSelected ? 'var(--color-surface-pure)' : 'var(--color-indigo-depth)'}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="Manrope, sans-serif"
                >
                  {freeCount}
                </text>

                {/* Crisp station label */}
                <g transform="translate(0, 27)">
                  <text
                    textAnchor="middle"
                    fill="var(--color-indigo-depth)"
                    fontSize="12"
                    fontWeight={isSelected ? '600' : '500'}
                    fontFamily="Manrope, sans-serif"
                  >
                    {station.name}
                  </text>
                  <text
                    y="14"
                    textAnchor="middle"
                    fill="var(--color-dilute-ink)"
                    fontSize="10.5"
                    letterSpacing="0.08em"
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

      {/* Selected Station Callout Strip (effortless thumb interaction on mobile & desktop) */}
      {selectedItem && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums rounded bg-paper-white px-2 py-0.5 text-[11px] font-semibold tracking-[0.1em] text-indigo-depth">
                {selectedItem.station.code}
              </span>
              <span className="text-sm font-medium text-indigo-depth">
                {selectedItem.station.name}
              </span>
              <span className="tabular-nums text-xs font-semibold text-indigo-depth">
                · {selectedItem.freeCount} free / {selectedItem.station.capacity} docks
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-dilute-ink">
              <MapPin className="h-3 w-3 shrink-0 text-indigo-depth" />
              <span className="truncate">{selectedItem.station.address}</span>
            </p>
          </div>
          {onBrowseStation && (
            <button
              type="button"
              onClick={() => onBrowseStation(selectedItem.station.id)}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded bg-indigo-depth px-3.5 py-2 text-xs font-medium tracking-[0.12em] text-white transition-colors hover:bg-ink-current sm:w-auto"
            >
              BROWSE STATION
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
