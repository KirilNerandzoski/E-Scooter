# Design System — Rydio

**Visual World:** Suminagashi Ink Basin (`medium-native-fluid-ink-basin`)  
**Seed Reference:** `seed:8652097668a95ca2`

## Color Tokens

| Token | Hex | Role |
|---|---|---|
| `--paper-white` | `#F6F7F9` | Primary washi-paper page canvas |
| `--surface-pure` | `#FFFFFF` | Crisp card, modal, and input surfaces |
| `--indigo-depth` | `#0A1A33` | Display headlines, primary CTAs, active rail badges, featured card |
| `--ink-current` | `#1E2D4A` | Primary button hover & secondary dark depth |
| `--dilute-ink` | `#515F73` | Body copy, labels, and secondary metadata (≥4.5:1 on paper/white) |
| `--feathered-gray` | `#8C97A8` | Muted scrollbars & subtle decorative strokes |
| `--mist` | `#DDE2E8` | 1px hairline borders, dividers, and table rules |

## Typography

- **Display:** `Raleway` (300 Light, 400 Regular, 500 Medium) — self-hosted via `@fontsource/raleway`.
- **Body & Controls:** `Manrope` (400, 500, 600) — self-hosted via `@fontsource/manrope`.
- **Telemetry & Pricing:** `font-variant-numeric: tabular-nums` on all MKD rates, durations, battery percentages, and station codes.

## Layout & Signature Elements

- **Persistent Left Vertical Rail (`196px` on `lg+`):** Circular wave-wheel mark + tracked `RYDIO` wordmark, vertical circular-icon navigation (`HOME`, `CATALOG`, `STATIONS`, `MY RIDES`, `ADMIN`), bottom live station/fleet counters, and role switcher.
- **Right Micro-Telemetry Margin (`116px` on `xl+`):** Quiet vertical fleet metrics (`FREE NOW`, `STATIONS`, `DAY PASS`, `MAX TERM`, `ON ROAD`).
- **Interactive Suminagashi Ink Canvas (`SuminagashiCanvas.tsx`):** Feathered indigo ink currents drifting across the upper-right hero horizon, subtly responsive to pointer motion and disabled under `prefers-reduced-motion`.
- **4-Card Hero Strip:** Lead deep-indigo (`indigo-basin-card`) featured ride card paired with three paper-white `#FFFFFF` hairline cards.
