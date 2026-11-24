---
target: Rydio full multi-screen audit (live Render + all views)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 3
p1_count: 1
target_identity: "file:C:\\Users\\Kiro\\Desktop\\E-Scooter\\frontend\\src\\pages\\HomePage.tsx"
target_fingerprint: "sha256:6aa8e2f08c738c19628631dc9798ae310ab3702dc5fee6bafdc99e1e607a471c"
target_path: "C:\\Users\\Kiro\\Desktop\\E-Scooter\\frontend\\src\\pages\\HomePage.tsx"
timestamp: 2026-11-24T17-01-43Z
slug: frontend-src-pages-homepage-tsx
---
Method: dual-agent (A: 0bb5ef16-2412-45aa-ad27-292bfc5122f4 · B: 4526c8f2-5de9-4902-8993-80f48180f716 · Live Browser: e51a40bd-b151-4be5-98a4-5b80f8f2aeba)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No Render cold-start loading state; error toasts use a checkmark icon; ReturnModal shows "Ride Completed" before API resolves; Confirm Reservation lacks submitting state. |
| 2 | Match System / Real World | 3 | Strong Skopje geography & MKD tariffs, but "2 / 12 docks" on Stations is ambiguous between free vehicles vs empty docks. |
| 3 | User Control and Freedom | 2 | No URL hash routing (Back/Forward resets to Home); Escape on stacked modals closes both; Vehicles inline edit lacks Cancel; SuperAdmin role dropdown mutates immediately with no confirm. |
| 4 | Consistency and Standards | 3 | Duration presets vanish on Catalog; Home empty state has Reset Filters while Catalog/MyRides/Admin don't; RightTelemetry leaks catalog filters onto Admin. |
| 5 | Error Prevention | 2 | Invalid time windows still show all vehicles as free (`isVehicleAvailable` returns true); duplicate submits possible on ReservationModal; unconfirmed SuperAdmin promotion. |
| 6 | Recognition Rather Than Recall | 2 | Admin add-forms omit visible labels (mystery numbers 190/200/10); Stations hides selected window below xl; Catalog hides calculated window total. |
| 7 | Flexibility and Efficiency | 3 | Good duration presets & multi-filter Admin Reservations; missing Catalog search, Admin Vehicle filter, and click-through Dashboard KPIs. |
| 8 | Aesthetic and Minimalist Design | 3 | Suminagashi world shines on Home/Catalog/Stations (8.5-9/10 fit), but strict monochrome flattens status triage in Admin & Past History. |
| 9 | Error Recovery | 2 | API errors hidden in a 3.6s checkmark toast; Reset Demo Data dialog warns of wiping data when in live API mode it only re-syncs. |
| 10 | Help and Documentation | 3 | Clear policy summary in ReservationModal & MyRidesPage; minor daily-cap threshold copy mismatch. |
| **Total** | | **25/40** | **Acceptable (blocked by P0 production TDZ crash in SuminagashiCanvas.tsx)** |

## Priority Issues
1. [P0] Production TDZ Crash on https://rydio-api.onrender.com/ (`SuminagashiCanvas.tsx:37` calling `draw()` before `const draw` on line 52 — blanks the entire site under `prefers-reduced-motion`/minified build).
2. [P0] Stacked Modal Z-Order Bug (`AuthModal` renders behind `ReservationModal` at `App.tsx:823 vs 835`) + Modal Viewport Overflow (`Modal.tsx` missing `max-h-[90vh] overflow-y-auto` + `[onClose]` focus-steal).
3. [P0] Render Cold-Start Split-Brain, Optimistic Return Receipt Bug & Invalid-Window Availability Leak (`App.tsx`, `ReturnModal.tsx`, `pricing.ts`).
4. [P1] Accessibility & Semantic Status Polish (`SkopjeVardarMap.tsx` `role="img"` + `outline-none`, Admin visible form labels, restrained emerald/amber/crimson status pills, Cancelled ride pricing display).
5. [P2] Context & Layout Fit (Hide `RightTelemetry` on Admin/MyRides for +128px table space, show estimated trip total on Home/Catalog cards, add duration presets to Catalog, URL hash routing).
