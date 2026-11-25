import type { VehicleSilhouetteKind } from '../utils/vehicleSilhouette';

interface VehicleSilhouetteProps {
  kind: VehicleSilhouetteKind;
  inverted?: boolean;
  className?: string;
}

/**
 * Crisp Suminagashi hairline SVG silhouettes distinguishing E-Scooters, City E-Bikes, and Cargo E-Bikes.
 */
export function VehicleSilhouette({
  kind,
  inverted = false,
  className = 'h-10 w-16',
}: VehicleSilhouetteProps) {
  const stroke = inverted ? '#DCE6F5' : '#0A1A33';
  const accent = inverted ? '#8CA6CC' : '#606D80';

  if (kind === 'scooter') {
    return (
      <svg
        viewBox="0 0 80 44"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <circle cx="17" cy="34" r="6.5" stroke={stroke} strokeWidth="1.6" />
        <circle cx="62" cy="34" r="6.5" stroke={stroke} strokeWidth="1.6" />
        <circle cx="17" cy="34" r="1.8" fill={accent} />
        <circle cx="62" cy="34" r="1.8" fill={accent} />
        <path
          d="M23.5 34H50.5L56 10.5M51.5 10.5H59.5"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M55 15L62 27.5"
          stroke={accent}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M27 31H47" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'cargo') {
    return (
      <svg
        viewBox="0 0 80 44"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <circle cx="16" cy="33" r="7" stroke={stroke} strokeWidth="1.6" />
        <circle cx="64" cy="33" r="7" stroke={stroke} strokeWidth="1.6" />
        <path
          d="M16 33L28 21H48L57 12M53 12H61"
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28 21L35 33H49L56 17L64 33"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="10"
          y="16"
          width="15"
          height="8"
          rx="1.5"
          stroke={accent}
          strokeWidth="1.4"
        />
        <path d="M25 14H33" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 80 44"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="17" cy="33" r="7.5" stroke={stroke} strokeWidth="1.6" />
      <circle cx="63" cy="33" r="7.5" stroke={stroke} strokeWidth="1.6" />
      <path
        d="M17 33L31 19H50L63 33M31 19L37 33H17M50 19L37 33"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 19L53 11.5H59"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M27 14.5H35" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M31 19L31 14.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
