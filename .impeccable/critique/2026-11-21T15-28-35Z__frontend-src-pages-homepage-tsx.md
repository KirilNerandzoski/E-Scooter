---
target: Rydio frontend (current state)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\Kiro\\Desktop\\E-Scooter\\frontend\\src\\pages\\HomePage.tsx"
target_fingerprint: "sha256:5e3c825ab6bb731be7fca790b18e0b6536a0ed7b76c6ff527a2a85b3055ecd89"
target_path: "C:\\Users\\Kiro\\Desktop\\E-Scooter\\frontend\\src\\pages\\HomePage.tsx"
timestamp: 2026-11-21T15-28-35Z
slug: frontend-src-pages-homepage-tsx
---
Method: dual-agent (A: 906b5cf3-60a1-4c5d-995c-890b834226d5 · B: 2bb0ee17-a9f6-471d-bf8f-a4b1ae8f56de)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | `LeftRail` (`FREE FLEET: 7`) and `RightTelemetry` (`FREE NOW: 7`) conflict with `HomePage` (`6 vehicles free for this window`); admin deletes/maintenance toggles lack toast confirmation. |
| 2 | Match System / Real World | 2 | Zero vehicle silhouettes (scooters vs. e-bikes look identical) and no Skopje/Vardar station map. |
| 3 | User Control and Freedom | 2 | Modals lack `Escape` and backdrop dismiss; zero confirmation or undo on customer cancellation or admin deletion/reset. |
| 4 | Consistency and Standards | 3 | Copy advertises `-20%` day pass while `pricing.ts` applies a flat daily cap (~5.3x hourly); `AdminPage` mixes labeled buttons with icon-only `title` actions. |
| 5 | Error Prevention | 1 | Clearing a `datetime-local` filter calls `new Date("").toISOString()` and crashes the app; single-click admin deletes can orphan vehicles from deleted stations/types. |
| 6 | Recognition Rather Than Recall | 2 | Unlabeled Admin inline inputs/selects (`newVehTypeId`, `newTypeRate`, `editRate`, `resStatusFilter`) and 4 icon-only Reservations control buttons. |
| 7 | Flexibility and Efficiency | 2 | No quick-duration chips (`2h`, `4h`, `Full Day`, `Weekend`); `CatalogPage` paginates at 4 items. |
| 8 | Aesthetic and Minimalist Design | 3 | Strong Suminagashi palette & type, but `RightTelemetry` duplicates `LeftRail` counters, hero card wraps `Rydio Cargo E-Bike`, and demo helpers sit in production chrome. |
| 9 | Error Recovery | 3 | Clear inline errors in auth/reservation modals, but `MyRidesPage` 1h cancel rule is hidden in a mouse-only `title`, and `AdminPage` user creation silently fails on short passwords. |
| 10 | Help and Documentation | 2 | Reservation footnote is concise, but no guidance on pickup/return flow or how the daily rate cap triggers. |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Art-directed shell, category-generic product interior. The Suminagashi Ink Basin palette (`#F6F7F9` paper white, `#0A1A33` indigo depth), Raleway light display typography, pointer-reactive `SuminagashiCanvas`, and 1-dark / 3-light hero card strip are genuinely distinctive. However, inside the shell, vehicles have zero visual identity (scooters and e-bikes are indistinguishable text boxes, and `FEATURED RIDE` hides the vehicle type on the lead card) and Skopje's 6 hubs have no spatial/Vardar River geography.

**Deterministic scan:** `impeccable detect --json frontend/src` exited `0` with `0` findings (`[]`), zero false positives. Static mechanical inspection in Assessment B independently confirmed the P0 `datetime-local` clear crash, missing modal `Escape`/focus-trap/backdrop dismiss, `focus:outline-none` overriding the global `:focus-visible` ring, `<button>` wrapping block headings (`<h2>`) on `HomePage.tsx:223-314`, unlabelled Admin controls, conditional toast live-region + timeout race, and 4 unused Vite starter assets (`App.css`, `hero.png`, `react.svg`, `vite.svg`).

**Visual overlays:** Skipped in Assessment B because browser automation is isolated to the parent's browser subagent; live desktop render verified via `final_step_8.png`.

## Priority Issues

1. **[P0] Uncaught Date-Clear Crash & Unguarded Destructive Deletes** (`HomePage.tsx`, `CatalogPage.tsx`, `StationsPage.tsx`, `AdminPage.tsx`, `MyRidesPage.tsx`) — Clearing a `datetime-local` input throws `RangeError: Invalid time value` and whitescreens the app; single-click admin deletes/resets can permanently wipe data or orphan vehicles. Fix: guard date parsing with a safe helper, add confirmation modals for destructive actions, and prevent deleting stations/types still referenced by vehicles. (`/impeccable harden`)
2. **[P1] Modal Keyboard/Focus Accessibility & Unlabeled Admin Controls** (`AuthModal.tsx`, `ReservationModal.tsx`, `ReturnModal.tsx`, `AdminPage.tsx`, `LeftRail.tsx`, `HomePage.tsx`, `index.css`) — Modals lack `Escape` dismiss, backdrop click, focus trap, and `role="alert"` on errors; `focus:outline-none` kills keyboard focus rings; `HomePage` wraps `<h2>` inside `<button>`; Admin inputs/icon buttons lack `<label>` / `aria-label`. Fix: build a shared accessible `<Modal>` primitive, remove `focus:outline-none` overrides, use `<article>` + inner button on cards, and label all Admin controls. (`/impeccable audit`)
3. **[P1] Missing Vehicle Visual Identity & Skopje Vardar Map** (`HomePage.tsx`, `CatalogPage.tsx`, `StationsPage.tsx`) — Scooters and e-bikes look identical as text-only cards, and Skopje's 6 stations sit in a flat grid with no Vardar River geography. Fix: add crisp indigo hairline SVG vehicle silhouettes (E-Scooter, City E-Bike, Cargo E-Bike) and an interactive Suminagashi-styled Skopje/Vardar station map on `StationsPage`. (`/impeccable bolder`)
4. **[P2] Redundant Right-Rail Telemetry & Micro-Type/Wrapping Polish** (`RightTelemetry.tsx`, `LeftRail.tsx`, `HomePage.tsx`) — `RightTelemetry` repeats `STATIONS` and `FREE NOW` from `LeftRail` while disagreeing with the search bar's window count (`7` vs `6`); `Rydio Cargo E-Bike` wraps awkwardly on the hero card; labels drop to `9px–10px`. Fix: remove duplicate counters (or repurpose right rail to live selected-window context), set minimum `11px` micro-labels, and tighten hero card title sizing. (`/impeccable distill`)
5. **[P2] Pricing Copy Mismatch, Missing Duration Presets & Abrupt Return Closure** (`pricing.ts`, `HomePage.tsx`, `ReservationModal.tsx`, `ReturnModal.tsx`) — UI says `-20%` day pass while math applies a flat daily cap; raw datetime inputs lack quick duration chips (`2h`, `4h`, `Full Day`); returning a vehicle vanishes into a 3.6s toast instead of a settlement receipt. Fix: align pricing copy with the daily-cap rule, add 1-click duration presets, show a post-return settlement receipt, and clean up unused Vite starter files. (`/impeccable clarify`)

## Persona Red Flags

- **Jordan (First-Timer):** Cannot tell if `Rydio S1 Pro` (`FEATURED RIDE`) is a scooter or e-bike; has no map context for Skopje stations; encounters stacked modals when reserving as a guest; sees conflicting free counts (`7` vs `6`).
- **Alex (SuperAdmin / Power User):** Single-click permanent deletes with no confirmation or orphan guard; 4 unlabeled icon buttons in Reservations table; 6 flat Admin tabs + cramped 6-column inline add form.
- **Sam (Accessibility-Dependent):** Trapped in modals (no `Esc` or focus trap); `focus:outline-none` hides keyboard focus on inputs; unlabeled Admin selects/inputs; `CANCEL` 1-hour rule hidden in a mouse-only `title`.

## Minor Observations
- Toast timer race (`App.tsx:114-117`) and conditionally mounted `role="status"` live region (`App.tsx:490-498`).
- Unused Vite starter files still in repo (`App.css`, `hero.png`, `react.svg`, `vite.svg`).
- `scroll-behavior: smooth` in `index.css` lacks a `prefers-reduced-motion` override.
- Demo helpers (`SuperAdmin FILL`, `+2h Late` toggle) sit directly in rider flows.

## Questions to Consider
1. If you stripped "Skopje" and "MKD", how would a visitor know this is a Vardar-riverfront scooter & e-bike platform rather than a minimalist stationery studio?
2. Does the desktop layout need `312px` of dual-rail chrome repeating the same two fleet numbers on both sides?
3. How do we make the full-day pricing rule and post-return receipt build instant financial trust?
