# Project Architecture

Vite + React aviation weather dashboard with a Node/Express weather data backend.

## Directory Structure

```text
ProjectAMO/
  .claude/
    agents/                  -> Claude subagent roster (researcher/implementer/reviewer, model-tiered)
  frontend/
    public/
      data/                    -> runtime GeoJSON, navdata, route graph, procedure data
      Symbols/                 -> Mapbox aviation SVG symbols
      basemap-thumbs/          -> basemap switcher thumbnails
      Geo/                     -> Korean boundary GeoJSON
    src/
      api/                     -> frontend API clients
      app/                     -> app shell, layout, and weather polling
      features/
        map/                   -> Mapbox lifecycle, basemap/style readiness, map-owned layers, and high-level feature orchestration
        monitoring/            -> standalone legacy-style ops/ground monitoring page with Mapbox overlay panel
        aviation-layers/       -> aviation WFS and ADS-B layers
        weather-overlays/      -> radar/satellite/lightning/SIGWX/advisory overlays
        route-briefing/        -> route search and procedure/navpoint lookup
        airport-panel/         -> airport detail drawer, tabs, and view models
      shared/
        ui/                    -> frontend-only reusable UI
        weather/               -> frontend-only weather display helpers
  backend/
    data/                    -> local development data root; terrain source/tiles live here when DATA_PATH is unset
    src/
      briefing/               -> route-axis, planned altitude profile, and vertical profile composition
      terrain/                 -> terrain tile cache and DEM sampling
      parsers/                 -> upstream raw response parsers
      processors/              -> normalized data transformers
  scripts/                     -> local preprocessing helpers such as terrain tile generation
  shared/                      -> backend/frontend common constants
  docs/                        -> operations, deployment, and route briefing architecture notes
```

## File Roles

### Frontend

- `frontend/src/main.jsx` -> React root bootstrap; imports app entry CSS.
- `frontend/src/app/App.jsx` -> app shell state, sidebar/panel composition, selected airport state, and route-level lazy loading for non-main app routes.
- `frontend/src/app/App.css` -> app shell and layout CSS entry.
- `frontend/src/app/useWeatherPolling.js` -> initial weather load, deferred panel-data loading, plus snapshot-meta incremental polling.
- `frontend/src/app/snapshotMeta.js` -> snapshot-meta comparison helpers.
- `frontend/src/app/layout/Sidebar.jsx` -> sidebar item definitions and panel toggle UI (desktop/tablet; hidden at <=719px in favor of the mobile task bar).
- `frontend/src/app/layout/Sidebar.css` -> sidebar styles.
- `frontend/src/app/layout/MobileTaskBar.jsx` -> mobile (<=719px) bottom task switcher (지도/브리핑/더보기) that replaces the sidebar; drives `mobileTask` in `App.jsx`.
- `frontend/src/app/layout/MobileMapOverlay.jsx` -> mobile 지도-task status strip (warning summary) plus on-map aviation/met layer entry buttons.
- `frontend/src/app/layout/MobileMoreMenu.jsx` -> mobile 더보기-task list (updates/settings/monitoring; NOTAM/help disabled).
- `frontend/src/shared/ui/useIsMobile.js` -> shared `<=719px` matchMedia hook (used by `App.jsx` for the mobile shell).
- `frontend/src/shared/ui/MobileSheet.jsx` -> shared mobile (<=719px) bottom sheet: grabber handle, peek/half/full pointer-drag detents, scrollable body, flush to the task bar. Hosts the layer panels and the route-briefing panel on mobile.
- `frontend/src/app/layout/layoutTokens.css` -> shared responsive layout tokens for shell widths, panel widths, breakpoint policy, spacing, and minimum control sizes.
- `frontend/src/api/weatherApi.js` -> initial weather bundle, deferred weather dataset, changed dataset, static airport/navdata fetch helpers.
- `frontend/src/api/adsbApi.js` -> ADS-B fetch helper.
- `frontend/src/api/briefingApi.js` -> route briefing and vertical profile API helpers.
- `frontend/src/features/map/MapView.jsx` -> Mapbox instance owner, style readiness/basemap switching coordinator, `styleRevision` sync trigger, high-level feature panel composition, and current-state sync orchestration, including base geo-boundary visibility for dark/raster/NWP overlay contrast. Feature-specific data shaping and layer adapters live in their owning feature modules.
- `frontend/src/features/map/MapView.css` -> map, overlay panel, and route briefing style entry.
- `frontend/src/features/map/mapConfig.js` -> map bounds, initial camera, basemap options.
- `frontend/src/features/map/imageOverlay.js` -> shared Mapbox image overlay helpers for raster/SIGWX frames.
- `frontend/src/features/map/lib/mapStyleSync.js` -> Mapbox style-reload helpers for cleanup-aware layer event binding, cleanup collections, and source/layer ownership tests.
- `frontend/src/features/map/lib/baseMapLayers.js` -> airport and geo-boundary source/layer install helpers, plus geo-boundary visibility policy for basemap and weather/NWP overlay contrast.
- `frontend/src/features/map/basemapSwitcher/BasemapSwitcher.jsx` -> basemap switcher UI.
- `frontend/src/features/monitoring/MonitoringPage.jsx` -> standalone `/monitoring` legacy-style ops/ground screen.
- `frontend/src/features/monitoring/MonitoringMap.jsx` -> monitoring wrapper around the main MapView with local Aviation/MET icon toggles.
- `frontend/src/features/monitoring/monitoringApi.js` -> monitoring data loader using current API shape.
- `frontend/src/features/monitoring/legacy/*` -> copied previous-project dashboard components, alert utilities, CSS, and weather icon assets for the standalone monitoring screen.
- `frontend/src/features/aviation-layers/aviationWfsLayers.js` -> aviation static GeoJSON layer definitions.
- `frontend/src/features/aviation-layers/addAviationWfsLayers.js` -> aviation GeoJSON source/layer creation.
- `frontend/src/features/aviation-layers/addAdsbLayer.js` -> ADS-B GeoJSON shaping, source/layer install, visibility sync, cleanup-aware hover popup binding, and `ADSB_SOURCE_IDS`/`ADSB_LAYER_IDS` ownership exports.
- `frontend/src/features/aviation-layers/AviationLayerPanel.jsx` -> aviation WFS layer toggle panel (desktop rows; mobile renders a tile grid inside `MobileSheet`). ADS-B remains controlled from the MET/weather overlay panel for the current UX.
- `frontend/src/features/aviation-layers/lib/aviationLayerTiles.js` -> mobile aviation tile symbology metadata (boundary-color squares, ICAO `public/Symbols/*.svg`, airway line samples); colors imported from `aviationWfsLayers.js` so the tile grid mirrors the live map.
- `frontend/src/features/weather-overlays/WeatherOverlayPanel.jsx` -> MET overlay toggle panel.
- `frontend/src/features/weather-overlays/WeatherTimelineBar.jsx` -> shared bottom playback timeline for radar, satellite, and lightning overlay frames.
- `frontend/src/features/weather-overlays/AdsbTimestamp.jsx` -> ADS-B reference-time display pill.
- `frontend/src/features/weather-overlays/WeatherLegends.jsx` -> radar/satellite/weather/wind/temperature legend UI.
- `frontend/src/features/weather-overlays/SigwxLegendDialog.jsx` -> SIGWX legend dialog.
- `frontend/src/features/weather-overlays/SigwxHistoryBar.jsx` -> SIGWX history controls.
- `frontend/src/features/weather-overlays/AdvisoryBadges.jsx` -> SIGMET/AIRMET advisory badges.
- `frontend/src/features/weather-overlays/lib/weatherOverlayModel.js` -> weather overlay derived model for timeline, SIGWX history/filter state, advisory panel data, badge counts, and legend labels.
- `frontend/src/features/weather-overlays/lib/weatherOverlayLayers.js` -> MET panel layer definitions, weather overlay source/layer ownership IDs, static weather overlay installation, and radar/satellite/SIGWX/advisory/lightning Mapbox sync helpers.
- `frontend/src/features/weather-overlays/NwpSliderBar.jsx` -> shared KIM NWP bottom time slider and right-side level slider UI.
- `frontend/src/features/weather-overlays/NwpSliderBarModel.js` -> pure KIM NWP slider option and time tick formatting helpers.
- `frontend/src/features/weather-overlays/lib/useKimSurfaceWind.js` -> KIM wind index/field selection hook with shared selection support, nearest-past time fallback, field cache, request cancellation, and stale response guards.
- `frontend/src/features/weather-overlays/lib/useKimSurfaceWind.test.js` -> KIM wind selection/index helper tests.
- `frontend/src/features/weather-overlays/lib/useKimSnapshotMeta.js` -> shared KIM snapshot-meta polling subscription used by KIM NWP overlay hooks.
- `frontend/src/features/weather-overlays/lib/useKimTemperature.js` -> KIM temperature index/field hook with selected-field cache, request cancellation, and variable-hash refresh.
- `frontend/src/features/weather-overlays/lib/useKimCloudPotential.js` -> KIM cloud-potential index/field hook using shared pressure-level selection, field cache, cloud variable-hash refresh, and stale-selection guards.
- `frontend/src/features/weather-overlays/lib/useKimCloudPotential.test.js` -> KIM cloud-potential selection, cache-key, snapshot-hash, and request-guard helper tests.
- `frontend/src/features/weather-overlays/lib/windField.js` -> KIM selected wind field decoding, interpolation sampler, shared kt color ramp, and metadata label helpers.
- `frontend/src/features/weather-overlays/lib/windOverlaySync.js` -> wind overlay renderer lifecycle adapter, WebGL-first selection, Canvas fallback, and Mapbox event sync.
- `frontend/src/features/weather-overlays/lib/temperatureField.js` -> KIM temperature field decoding, Kelvin-to-Celsius display conversion, sampler, and fixed Celsius color ramp.
- `frontend/src/features/weather-overlays/lib/temperatureOverlaySync.js` -> temperature Canvas raster generation and Mapbox image overlay lifecycle sync.
- `frontend/src/features/weather-overlays/lib/cloudPotentialField.js` -> KIM dewpoint-spread decoding and green stepped moist-area display ramp.
- `frontend/src/features/weather-overlays/lib/cloudPotentialOverlaySync.js` -> dewpoint-spread Canvas raster generation and Mapbox image overlay lifecycle sync.
- `frontend/src/features/weather-overlays/lib/useKimIcing.js` -> KIM icing-potential index/field hook with shared NWP selection, field cache, icing variable-hash refresh, and stale-selection guards.
- `frontend/src/features/weather-overlays/lib/icingPotentialField.js` -> KIM icing-potential score/grade decoding, sampler, potential-class color ramp, and conservative K-FIP-inspired labels.
- `frontend/src/features/weather-overlays/lib/icingPotentialOverlaySync.js` -> icing-potential Canvas raster generation and Mapbox image overlay lifecycle sync.
- `frontend/src/features/weather-overlays/lib/canvasWindRenderer.js` -> Canvas 2D fallback renderer for KIM wind flow and speed overlays.
- `frontend/src/features/weather-overlays/lib/webglWindRenderer.js` -> WebGL wind renderer for KIM wind flow particles and speed color cells.
- `frontend/src/features/weather-overlays/lib/lightningLayers.js` -> lightning GeoJSON, icon, layer, visibility, and blink helpers.
- `frontend/src/features/weather-overlays/lib/advisoryLayers.js` -> SIGMET/AIRMET GeoJSON and layer helpers.
- `frontend/src/features/weather-overlays/lib/sigwxData.js` -> SIGWX_LOW GeoJSON/icon mapping helpers.
- `frontend/src/features/route-briefing/lib/routePlanner.js` -> route graph loading and route path search.
- `frontend/src/features/route-briefing/lib/procedureData.js` -> procedure/navpoint loading helpers.
- `frontend/src/features/route-briefing/useRouteBriefing.js` -> route briefing state, async route/procedure transitions, VFR waypoint model, route search, and vertical profile orchestration.
- `frontend/src/features/route-briefing/RouteBriefingPanel.jsx` -> route-check panel UI for IFR/VFR form, route result, VFR altitude editing, and vertical profile controls.
- `frontend/src/features/route-briefing/VerticalProfileWindow.jsx` -> vertical profile modal shell.
- `frontend/src/features/route-briefing/RouteBriefing.css` -> route panel, VFR waypoint, and vertical profile styles.
- `frontend/src/features/route-briefing/VerticalProfileChart.jsx` -> SVG route vertical profile chart.
- `frontend/src/features/route-briefing/BriefingView.jsx` -> pre-flight briefing view (summary board + ①adverse/③current/④enroute/⑤destination sections); ④ shows a hazard ribbon (moderate+) plus an inline `VerticalProfileChart` cross-section (icing/turbulence bands + planned altitude); overlays the map within the route-check panel.
- `frontend/src/features/route-briefing/lib/etaCalc.js` -> ETD + route distance / cruise speed -> ETA helper.
- `frontend/src/features/route-briefing/lib/routeBriefingModel.js` -> pure route briefing view/model helpers.
- `frontend/src/features/route-briefing/lib/routePreviewSync.js` -> route/procedure/VFR/boundary-fix/highlight Mapbox install/sync helpers and route preview source/layer ownership IDs.
- `frontend/src/features/route-briefing/lib/routePreview.js` -> route/procedure/VFR GeoJSON helpers, layer installation, and VFR map interaction binding.
- `frontend/src/features/route-briefing/lib/routeStore.js` -> localStorage CRUD for saved routes (inputs only; reloaded by re-search).
- `frontend/src/features/airport-panel/AirportPanel.jsx` -> airport drawer shell and tab selection.
- `frontend/src/features/airport-panel/AirportPanel.css` -> airport drawer and tab style entry.
- `frontend/src/features/airport-panel/tabs/CurrentWeatherTab.jsx` -> compact default airport drawer weather summary for warning, METAR, and next-6-hour TAF.
- `frontend/src/features/airport-panel/tabs/MetarTab.jsx` -> METAR tab rendering.
- `frontend/src/features/airport-panel/tabs/TafTab.jsx` -> TAF tab rendering.
- `frontend/src/features/airport-panel/tabs/AmosTab.jsx` -> AMOS tab rendering.
- `frontend/src/features/airport-panel/tabs/WarningTab.jsx` -> airport warning tab rendering.
- `frontend/src/features/airport-panel/tabs/AirportInfoTab.jsx` -> airport information bulletin rendering.
- `frontend/src/features/airport-panel/lib/formatters.js` -> airport panel time/wind formatting helpers.
- `frontend/src/features/airport-panel/lib/currentWeatherViewModel.js` -> current-weather tab warning, compact METAR, RVR, and next-6-hour TAF view-model helpers.
- `frontend/src/features/airport-panel/lib/metarViewModel.js` -> METAR display model builder.
- `frontend/src/features/airport-panel/lib/tafViewModel.js` -> TAF display model builder.
- `frontend/src/features/airport-panel/lib/amosViewModel.js` -> AMOS display model helpers.
- `frontend/src/shared/ui/WeatherIcon.jsx` -> weather icon renderer.
- `frontend/src/shared/weather/helpers.js` -> flight category, wind, humidity, and related weather helpers.
- `frontend/src/shared/weather/visual-mapper.js` -> weather code-to-Korean display mapping.
- `frontend/src/shared/weather/weather-visual-resolver.js` -> weather icon visual resolver.
- `frontend/src/shared/weather/weather-icon-registry.js` -> weather icon asset registry.

### Backend

- `backend/server.js` -> Express entry point, API routes, cache headers, static data serving, and KIM NWP map index filtering.
- `backend/src/briefing/route-axis.js` -> route LineString resampling, cumulative distance, and bearing helpers.
- `backend/src/briefing/profile-composer.js` -> route-aware planned altitude profile, markers, and segment metadata composition.
- `backend/src/briefing/vertical-profile.js` -> vertical profile response composition.
- `backend/src/briefing/briefing-composer.js` -> assembles the AIM-ordered route-briefing payload (summary board + adverse/current/destination sections) from injected METAR/TAF/SIGMET/AIRMET cache.
- `backend/src/briefing/flight-category.js` -> visibility/ceiling -> VFR/MVFR/IFR/LIFR classifier and category-to-level color mapping.
- `backend/src/briefing/geo-time-match.js` -> point-in-polygon, route∩polygon (horizontal), route∩polygon distance interval (`routeIntervalInGeometry`), and time-window overlap helpers for hazard matching.
- `backend/src/briefing/planned-altitude.js` -> planned climb/cruise/descent altitude-by-distance model and advisory FL band -> ft conversion.
- `backend/src/briefing/hazard-matcher.js` -> classifies a hazard as encounter `on`/`nearby` from planned altitude vs FL band (3D vertical match).
- `backend/src/briefing/enroute-model.js` -> samples KIM/KTG cross-section at the planned altitude and emits moderate+ icing/turbulence intervals (the ④ enroute model summary).
- `backend/src/briefing/enroute-cross-section.js` -> shared KIM pressure-level + KTG low-altitude cross-section loader (`loadRouteCrossSection`); used by both `POST /api/briefing/cross-section` and the route-briefing enroute model.
- `backend/src/briefing/airport-summary.js` -> single-airport METAR -> flight category + threshold-flagged display fields.
- `backend/src/briefing/taf-window.js` -> destination TAF selection at ETA and 1-2-3 alternate-required evaluation.
- `backend/src/briefing/hazard-section.js` -> SIGMET/AIRMET adverse-hazard section with 3D matching (route∩time∩altitude); tags each hazard encounter `on`/`nearby` and applies a conservative level (SIGMET red unless confirmed off-altitude; AIRMET amber). Also feeds the briefing ④ enroute section.
- `backend/server.js` -> exposes `POST /api/route-briefing` (composes briefing from `store.getCached` METAR/TAF/SIGMET/AIRMET).
- `backend/src/terrain/terrain-cache.js` -> terrain tile metadata lookup and lazy tile cache.
- `backend/src/terrain/terrain-sampler.js` -> terrain sampling along route-axis samples.
- `backend/src/index.js` -> scheduled weather collection jobs, per-type locks, and UTC KIM NWP release-window scheduling.
- `backend/src/api-client.js` -> upstream KMA/weather API request construction.
- `backend/src/store.js` -> in-memory cache and SHA-256 change detection.
- `backend/src/parsers/*` -> per-type raw response parsers.
- `backend/src/processors/*` -> per-type normalized data processors.
- `backend/src/processors/kim-surface-wind-processor.js` -> KIM scheduled job/lock orchestrator for multi-level NWP wind, Temp, moisture-level RH, and config-gated icing-variable collection with complete-run skip checks; publishes partial successful runs to canonical `DATA_PATH/kim_nwp/` while preserving the legacy surface-wind cache, then retries incompleteness on later schedules.
- `backend/src/processors/kim-nwp-store.js` -> canonical `DATA_PATH/kim_nwp/` store helpers for safe path resolution, atomic manifest/grid/index/latest writes, reads, usable-run manifest checks, and run retention.
- `backend/src/processors/kim-nwp-model.js` -> KIM NWP levels/forecast hours/moisture/icing levels, per-variable scaled grid builder, compact index filtering with per-variable hashes, and wind/temperature/dewpoint-spread/icing renderer-compatible field conversion.
- `backend/test/kim-scheduler.test.js` -> scheduler wiring tests for UTC KIM NWP release-window cron behavior and startup KIM collection gating.
- `backend/test/kim-nwp-store.test.js` -> KIM NWP store path validation, atomic write/read, compact index, and retention tests, including partial-run retention safety.
- `backend/test/kim-nwp-model.test.js` -> KIM NWP wind grid, index, and compatibility field model tests.
- `backend/test/kim-server-index.test.js` -> KIM NWP map index filtering tests for nearest-past plus future time exposure.
- `backend/test/kim-field-cache.test.js` -> KIM field route immutable cache header and ETag revalidation tests.
- `backend/test/snapshot-meta-cache.test.js` -> `/api/snapshot-meta` backend memoization and mtime invalidation tests.
- `backend/test/compression.test.js` -> Express gzip compression smoke test for large JSON KIM field responses.
- `backend/test/api-cache-policy.test.js` -> static/revalidating API cache header and ETag regression tests.
- `backend/collect.js` -> manual one-shot collector.
- `scripts/prepare-terrain-tiles.js` -> converts decompressed Korea 3-second DEM into 1-degree terrain tiles.

## Reference Structure

- `frontend/src/main.jsx` imports only the app entry files.
- Frontend layout sizing should use `frontend/src/app/layout/layoutTokens.css` for shared shell, panel, and breakpoint values before adding new fixed pixel widths.
- Frontend UI, CSS, layout, and responsive work should follow `docs/design/design-language.md` (the design constitution, single source of truth) for tokens, color, typography, operational UX priorities, review workflow, and proposal-first structural change rules.
- `frontend/src/app/*` may import `api/`, `features/`, and `shared/`.
- `frontend/src/features/*` may import `api/`, `shared/`, and local feature siblings when a UI flow requires it.
- `frontend/src/shared/*` must stay frontend-only and must not import from `app/` or `features/`.
- Root `shared/` is for backend/frontend common constants; do not mix it with `frontend/src/shared/`.
- `frontend/src/features/map/MapView.jsx` owns Mapbox instance creation, basemap switching, style readiness, and `styleRevision`; it should not apply feature data or visibility from stale `style.load` closures.
- Feature-owned Mapbox adapters should expose or document their source/layer IDs when they own persistent Mapbox resources.
- Weather overlay map writes belong under `frontend/src/features/weather-overlays/lib/`; route preview map writes belong under `frontend/src/features/route-briefing/lib/`; ADS-B map writes belong under `frontend/src/features/aviation-layers/`.
- Adding a map overlay/layer or its visibility sync? Put it in the owning feature module as a `useXOverlay` hook (see `useWeatherFieldOverlay`/`useStyleSyncedEffect`), not as a new `useEffect` in `MapView.jsx` — MapView regrows by accretion otherwise (see `docs/adr/0001-mapview-layer-gravity.md`).
- `backend/*` must not import from `frontend/src/`.
- Runtime browser assets must live under `frontend/public/`.
- AMOS frontend wind rendering treats current normalized `amos.runways[0]` as the 2-minute wind group and `amos.runways[1]` as the 10-minute wind group; runway-side semantics only apply to visibility and RVR until the backend parser is renamed.
- Raw terrain sources and generated terrain tiles stay under the backend data root at `terrain/`; locally this is `backend/data/terrain/`, while the production EC2 VM uses `DATA_PATH=/opt/projectamo/shared/data`, so runtime tiles must be under `/opt/projectamo/shared/data/terrain/tiles/`.
- Frontend requests vertical profile JSON instead of reading DEM files.
- Responsive layout work must include screenshot evidence for every affected panel/tab state. Store each capture pass under a timestamped folder such as `artifacts/responsive-screenshots/<phase>/<YYYY-MM-DD_HHMM_label>/`, include a short README/manifest with capture time, branch/commit, viewport matrix, capture method, and verification commands, then collect visual QA findings under that folder's `review/issues.md`. Review findings with read-only QA/design subagents before applying focused CSS fixes as a batch.
