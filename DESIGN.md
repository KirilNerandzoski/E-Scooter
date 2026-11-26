# Design System — Rydio

**Visual World:** Suminagashi Ink Basin (`medium-native-fluid-ink-basin`)  
**Seed Reference:** `seed:8652097668a95ca2`

## Color Tokens

| Token | Tailwind `@theme` Utility | Hex | Role |
|---|---|---|---|
| `--color-paper-white` | `bg-paper-white` / `text-paper-white` | `#F6F7F9` | Primary washi-paper page canvas |
| `--color-surface-pure` | `bg-surface-pure` | `#FFFFFF` | Crisp card, modal, and input surfaces |
| `--color-indigo-depth` | `bg-indigo-depth` / `text-indigo-depth` | `#0A1A33` | Display headlines, primary CTAs, active rail badges, featured card |
| `--color-ink-current` | `bg-ink-current` / `hover:bg-ink-current` | `#1E2D4A` | Primary button hover & secondary dark depth |
| `--color-dilute-ink` | `text-dilute-ink` | `#515F73` | Body copy, labels, and secondary metadata (`>6.0:1` WCAG AA/AAA on paper/white) |
| `--color-feathered-gray` | `stroke-feathered-gray` | `#8C97A8` | Muted scrollbars & non-text decorative strokes |
| `--color-mist` | `border-mist` / `divide-mist` | `#DDE2E8` | 1px hairline borders, dividers, and table rules |
| `--color-status-ok-*` | `bg-status-ok-bg` / `border-status-ok-border` / `text-status-ok-text` | `#ECFDF5` / `#A7F3D0` / `#065F46` | Active ride & catalog-available badges |
| `--color-status-warn-*` | `bg-status-warn-bg` / `border-status-warn-border` / `text-status-warn-text` | `#FFFBEB` / `#FDE68A` / `#92400E` | Upcoming reserved badges |
| `--color-status-danger-*` | `bg-status-danger-bg` / `border-status-danger-border` / `text-status-danger-text` | `#FEF2F2` / `#FECACA` / `#991B1B` | Overdue, cancelled, suspended, in-service & error alerts |

## Typography

- **Display:** `Raleway` (300 Light, 400 Regular, 500 Medium) — self-hosted via `@fontsource/raleway`.
- **Body & Controls:** `Manrope` (400, 500, 600) — self-hosted via `@fontsource/manrope`.
- **Telemetry & Pricing:** `font-variant-numeric: lining-nums tabular-nums` on all MKD rates, durations, battery percentages, and station codes.

## Layout & Signature Elements

- **Persistent Left Vertical Rail (`196px` on `lg+`):** Circular wave-wheel mark + tracked `RYDIO` wordmark, vertical circular-icon navigation (`HOME`, `CATALOG`, `STATIONS`, `MY RIDES`, RBAC-gated `ADMIN`), Rider Guide (`?`), live `STATIONS` / `FREE` fleet counters, and authenticated user controls.
- **Right Micro-Telemetry Margin (`128px` on `xl+` for Rider views):** Quiet vertical window-specific metrics (`WINDOW`, `MATCHING`, `HUB`, `TARIFF`, `ON ROAD`), hidden on `My Rides` and `Admin` for full workspace width.
- **Interactive Suminagashi Ink Canvas (`SuminagashiCanvas.tsx`):** Feathered indigo ink currents drifting across the upper-right hero horizon with an elliptical text safe-zone, subtly responsive to pointer motion and rendered as a calm static composition under `prefers-reduced-motion`.
- **4-Card Hero Strip:** Lead deep-indigo (`indigo-basin-card`) featured ride card paired with three paper-white `#FFFFFF` hairline cards.
