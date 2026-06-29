# MapView grows by accretion — deepen the seam, don't re-decompose

## Context

`MapView.jsx` was decomposed on 2026-05-15 (~−1,200 lines across three refactors: route-briefing state → hook, panel → component, preview sync → module). Over the following ~6 weeks, ~30 feature commits (KIM overlays, ADS-B, flight-category, mobile, briefing UI) re-accreted ~+500 lines back into it, returning it to ~1,400 lines. The cause: the Mapbox instance lives in MapView, and nothing forced new layer/effect code to land anywhere else.

## Decision

Do not "clean up" MapView with another one-shot decomposition — it will re-rot the same way. The target shape is a `useMap` controller that owns the imperative Mapbox instance, plus a **declarative layer spec** applied by one reconciler, so "add an overlay" becomes "add a layer spec / `useXOverlay` hook," not "add a `useEffect` to MapView." Evolve toward it via strangler-fig, riding feature work, in an environment with real visual verification (Playwright) — never as a standalone rewrite. A line-count drop is not the goal; changing the gravity (where new code naturally lands) is.

## Consequences

New map layers/overlays and their visibility sync must land in their owning feature module as a hook, not in MapView. `useStyleSyncedEffect` and `useWeatherFieldOverlay` (2026-06-29) are the first seams in this direction — extend the pattern rather than adding bare effects. `server.js` has the analogous accretion problem (826 lines, 43 inline routes) but at lower risk thanks to backend test coverage; split it into domain routers / a declarative route registry when convenient.
