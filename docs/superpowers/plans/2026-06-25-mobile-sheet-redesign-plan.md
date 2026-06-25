# Mobile Sheet Redesign — Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax. After each task: `npm.cmd run build --prefix frontend`, `npm.cmd run test:layout --prefix frontend`, and a mobile capture pass (`frontend/scripts/mobile-audit.mjs`, viewport 390×844) with the temp `window.__amoMap`/`__amoSelectAirport` hooks in `MapView.jsx` reverted afterward.

**Spec:** `docs/superpowers/specs/2026-06-25-mobile-layer-sheet-redesign.md`
**Goal:** Rebuild the mobile (≤719px) layer panels and route-briefing panel on one shared expandable bottom-sheet; modernize their content. Desktop unchanged.
**Stack:** React, Mapbox GL JS, plain CSS (app design language — reuse `.layer-drawer` glass chrome, accent `#2563eb`, system-ui, existing badge/switch styles). Mockups were concept-only.

---

## Parallelization assessment

Most steps share `MapView.jsx`, `WeatherOverlayPanel.jsx`, and `MapView.css`, so broad parallel writes would conflict. Only two clearly file-disjoint tracks are safe to run in parallel; everything else stays sequential, and the **main agent owns integration files** (`MapView.jsx`, `App.jsx`).

- **Parallel-safe Track S (new, isolated files):** Task 3 `MobileSheet` component (`frontend/src/shared/ui/MobileSheet.jsx` + `.css`) — all-new files, no overlap. Can be built any time.
- **Parallel-safe Track B (route-briefing files only):** Task 8 form logic in `RouteBriefingPanel.jsx`, `useRouteBriefing.js`, `RouteBriefing.css` — disjoint from layer files. (Its only shared touch is the 지도-보기 removal in `MapView.jsx`, which the main agent applies in Task 7.)
- **Sequential (shared files):** Tasks 1, 2, 4, 5 all touch `WeatherOverlayPanel.jsx` and/or `MapView.jsx`/`App.jsx` — keep serial, capture-verify between each.

**Recommendation:** run Track S and Track B in parallel subagents if desired (read-isolated, write-disjoint), but keep the layer-content tasks (1,2,4,5) sequential under the main agent. If conflict risk feels high or the team prefers simplicity, do everything sequentially — the per-task workload is modest UI edits, not a large pipeline.

---

## File map

**New:**
- `frontend/src/shared/ui/MobileSheet.jsx` (+ `MobileSheet.css`) — shared grabber/detent sheet
- `frontend/src/features/aviation-layers/lib/aviationLayerTiles.js` — tile symbol/color metadata (or inline)

**Modify:**
- `frontend/src/app/App.jsx` — pass per-panel active counts to `MobileMapOverlay`
- `frontend/src/app/layout/MobileMapOverlay.jsx` (+ `App.css`) — count badges on 항공/기상 buttons
- `frontend/src/features/weather-overlays/WeatherLegends.jsx` — 깜빡임 toggle in lightning legend
- `frontend/src/features/weather-overlays/WeatherOverlayPanel.jsx` — tile grid, remove blink row + wind/opacity sub-controls on mobile, 전체 끄기
- `frontend/src/features/aviation-layers/AviationLayerPanel.jsx` — tile grid, 전체 끄기
- `frontend/src/features/map/MapView.jsx` — wire MobileSheet, blink props, clear-all handlers, remove 지도-보기 button on mobile
- `frontend/src/features/map/MapView.css` — sheet/tile styles (app language)
- `frontend/src/features/route-briefing/RouteBriefingPanel.jsx` — airport list picker, remove 직접 입력, restyle
- `frontend/src/features/route-briefing/useRouteBriefing.js` — handlers no longer take free-text airport
- `frontend/src/features/route-briefing/RouteBriefing.css` — picker/sheet styles

---

## Task 0 — Color unification ✅ DONE
- [x] `aviationWfsLayers.js`: 제한/위험 → `#dc2626`, CTR → `#2563eb` + `lineDasharray: [2,1.5]`
- [x] `addAviationWfsLayers.js`: optional `line-dasharray` paint support
- [x] build ✓

---

## Task 1 — Active-count badges (항공/기상 buttons)
**Files:** Modify `App.jsx`, `MobileMapOverlay.jsx`, `App.css`
- [ ] Compute aviation active count (count `aviationVisibility` true) and met active count (count `metVisibility` true) — source where those live (MapView state) and surface to `App`/overlay, or compute in `MobileMapOverlay` from props.
- [ ] Render a small blue count pill on each button when count > 0 (reuse existing badge style, not mockup CSS).
- [ ] Verify: `01_main-map-default` shows badges reflecting active layers; build + test:layout.

## Task 2 — 낙뢰 깜빡임 → lightning legend
**Files:** Modify `WeatherLegends.jsx`, `WeatherOverlayPanel.jsx`, `MapView.jsx`
- [ ] Pass `blinkLightning` + `onBlinkLightningChange` into `WeatherLegends`; render a compact 깜빡임 toggle inside `.lightning-time-legend` (legend-chip styling), shown only when `lightningLegendVisible`.
- [ ] Remove the 낙뢰 깜빡임 row from `WeatherOverlayPanel` on mobile (keep desktop if desired, or move entirely — decide; spec moves it out).
- [ ] Verify: with lightning on, legend shows the toggle and it flips blink; build + test:layout.

## Task 3 — Shared `MobileSheet` (Track S, parallel-safe)
**Files:** New `MobileSheet.jsx` + `MobileSheet.css`
- [ ] Build a non-modal bottom sheet: props `{ open, title, onClose, headerExtra, children, detent, onDetentChange }`. Grabber handle; pointer-drag between peek/half/full with snap; tap-grabber cycles. Body `flex:1; overflow-y:auto`. Anchored `bottom:0` within map wrapper (flush to task bar). Visible ×.
- [ ] App design language: glass surface like `.layer-drawer`, accent `#2563eb`, rounded top.
- [ ] Degrade to fixed half-height if pointer events unsupported.
- [ ] Verify in isolation (temporary mount) then leave unused until Tasks 4/7 adopt it; build.

## Task 4 — Layer tile grids inside `MobileSheet`
**Files:** Modify `WeatherOverlayPanel.jsx`, `AviationLayerPanel.jsx`, `MapView.jsx`, `MapView.css`; maybe new `aviationLayerTiles.js`
- [ ] Replace the toggle-row lists with a 3-col tile grid (tap = toggle; active = blue border + check), grouped by existing sections. Render inside `MobileSheet` on mobile; keep desktop panel as-is (branch on `useIsMobile`).
- [ ] Weather tiles: an icon per layer. Drop wind 흐름/속도 + sliders and opacity on mobile.
- [ ] Aviation tiles: 공역 = boundary-color square (CTR dashed border), 항행시설 = repo `public/Symbols/navaid-vor-dme.svg` / `airport-civil.svg` / `waypoint-rnav-flyby.svg`, 항공로 = line sample (ATS solid #1f2933 / RNAV dashed #0076c8). Colors mirror `aviationWfsLayers.js` (single source — import or map ids→color).
- [ ] Verify captures `sheet-aviation`, `sheet-met`: all layers visible, tiles legible, active states correct; build + test:layout.

## Task 5 — 전체 끄기 per panel
**Files:** Modify `AviationLayerPanel.jsx`, `WeatherOverlayPanel.jsx`, `MapView.jsx`
- [ ] Add a header 전체 끄기 button (enabled when ≥1 active) → calls a clear-all handler that sets all that panel's layer visibilities false. No confirm.
- [ ] Verify: toggling several on then 전체 끄기 clears them; count badge (Task 1) returns to hidden; build + test:layout.

## Task 6 — Adopt grabber/detents for layer sheets
**Files:** Modify `MapView.jsx`, `MapView.css`
- [ ] Wrap the aviation/met panels in `MobileSheet` so they gain grabber + peek/half/full. Remove the interim fixed-height sheet CSS once superseded.
- [ ] Verify: drag expands/collapses; flush to task bar, no gap; build + test:layout.

## Task 7 — Briefing into `MobileSheet` + remove 지도 보기 (mobile)
**Files:** Modify `MapView.jsx`, `RouteBriefingPanel.jsx`, `RouteBriefing.css`
- [ ] On mobile, render `RouteBriefingPanel` inside `MobileSheet`; peek detent reveals the map. Hide the floating `route-briefing-map-mode-toggle` on mobile (keep desktop).
- [ ] Verify capture `task-route`: briefing in a draggable sheet, no floating 지도 보기; build + test:layout.

## Task 8 — Briefing airport list picker + remove 직접 입력 (Track B, parallel-safe)
**Files:** Modify `RouteBriefingPanel.jsx`, `useRouteBriefing.js`, `RouteBriefing.css`
- [ ] Replace 출발/도착 `<select>` with a touch list picker of the 8 `KNOWN_AIRPORTS` (with Korean names) + `FIR 진입`/`FIR 이탈` below a divider. **Remove the `__direct__` option and `proc-direct-input` text inputs.**
- [ ] Ensure form state/handlers no longer accept free-text airports: defaults to a chosen airport or a clear empty state; `handleDepartureAirportChange`/`handleArrivalAirportChange` only receive ICAO or FIR sentinels. Audit `isFirInMode`/`isFirExitMode` still work.
- [ ] Keep the dynamic 2nd field (진입FIX/SID, 이탈FIX/STAR) + RWY visible; restyle native selects as clean pickers; demote 경로유형 ALL/RNAV/ATS to a compact segmented control. VFR hides procedure fields (unchanged).
- [ ] Verify IFR (airport→airport), FIR IN (→ boundary FIX), FIR EXIT, VFR flows; build + test:layout + capture.

---

## Sequencing
1 → 2 → 3 (∥ ok) → 4 → 5 → 6 → 7 → 8 (∥ with 3/earlier). Capture-verify after each. Main agent owns `MapView.jsx`/`App.jsx` edits to serialize integration.

## Risks
- `WeatherOverlayPanel.jsx` + `MapView.jsx` touched by several tasks → sequential to avoid conflicts.
- Removing 직접 입력 (Task 8) may surface assumptions in route logic about empty/free-text departure — audit `useRouteBriefing.js`.
- Real `Symbols/*.svg` are recolored brand-purple; recolor/tint per layer or accept the symbol's own color in tiles.
- Map tiles render unreliably in the capture env — color/map-dependent visuals verified by build + on real device, not the headless capture.
