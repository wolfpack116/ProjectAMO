# Route Briefing Split Architecture Review

## Product idea

Claude v2 proposes `Route Briefing — 미니맵 썸네일 → split 레이아웃`. The idea is accepted as worth exploring because it could keep route form inputs and map context visible together on phone-sized screens.

## Current blocker

Mapbox is owned by `frontend/src/features/map/MapView.jsx`. `RouteBriefingPanel.jsx` does not own or receive a live map instance; it renders form/result UI inside the map view. A fake map placeholder must not be shipped.

## Evidence

- `frontend/src/features/map/MapView.jsx:133`: `mapContainerRef` is defined in `MapView.jsx`.
- `frontend/src/features/map/MapView.jsx:134`: `mapRef` is defined in `MapView.jsx`.
- `frontend/src/features/map/MapView.jsx:462`: `new mapboxgl.Map(...)` is created in `MapView.jsx`.
- `frontend/src/features/map/MapView.jsx:463`: the Mapbox container is `mapContainerRef.current`.
- `frontend/src/features/map/MapView.jsx:756`: the rendered map container is `<div ref={mapContainerRef} className="map-view" />`.
- `frontend/src/features/map/MapView.jsx:825`: `MapView.jsx` conditionally renders `<RouteBriefingPanel ... />`.
- `frontend/src/features/map/MapView.jsx:826`: `<RouteBriefingPanel` receives route state, refs, derived data, actions, and airports from the parent.
- `frontend/src/features/route-briefing/RouteBriefingPanel.jsx:13`: `RouteBriefingPanel` accepts `{ state, refs = {}, derived, actions, airports = [] }`, not `mapRef`, `map`, or a map container slot.
- `frontend/src/features/route-briefing/RouteBriefingPanel.jsx:72`: the component renders a `<section className="route-check-panel">` panel.
- `frontend/src/features/route-briefing/RouteBriefingPanel.jsx:80`: the form boundary starts at `<form className="route-check-form" ...>`.
- `frontend/src/features/route-briefing/RouteBriefingPanel.jsx:236`: route output is rendered under `routeResult` inside the same panel boundary.
- `frontend/src/features/route-briefing/RouteBriefing.css:1`: `.route-check-panel` is an absolute overlay panel, not a map owner or map slot.
- `frontend/src/features/route-briefing/RouteBriefing.css:20`: the current phone rule only changes panel inset/width, not map ownership.

## Recommendation

Create a separate route-map-context architecture task if the split idea is approved. Candidate approaches:

1. Parent-owned map slot: `MapView.jsx` renders a responsive route context slot while keeping single Mapbox ownership.
2. Map viewport mode: route panel stays form-focused, with a clear `지도 전체화면` mode that highlights route preview on the main map.
3. Static preview fallback: use a route preview geometry snapshot only if live map context is not required.

## Deferred

No production `RouteBriefingPanel.jsx` or `RouteBriefing.css` changes in this task.
