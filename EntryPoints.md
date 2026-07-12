# Entry Points

> **Purpose**: Step-by-step start sequences for recurring task patterns.
> **Use**: Open this when a task matches one of the recurring changes below.
> **Maintenance**: Keep entries short and update paths when the file map changes.

---

## MapView Boundary Rule

For map-related work, do not default to editing `frontend/src/features/map/MapView.jsx`.

Use `MapView.jsx` only for:
- Mapbox instance lifecycle.
- Basemap switching.
- Style readiness and `styleRevision`.
- High-level panel composition.
- Calling feature-owned sync helpers.
- Temporary polling orchestration that has not yet been moved to a feature module.

Feature-specific model, source/layer, GeoJSON, popup, route, weather, or ADS-B logic belongs in the owning `features/*` module.

## 1. Add a new aviation GeoJSON layer

1. Add definition to `frontend/src/features/aviation-layers/aviationWfsLayers.js` (id, color, `dataUrl`, line/fill/point options).
2. `addAviationWfsLayers.js` auto-creates sources and layers from the definition; no edit needed unless the new layer has a unique render mode (icon by property, tick marks, etc.).
3. Add toggle UI to `frontend/src/features/aviation-layers/AviationLayerPanel.jsx`.
4. Verify in browser: layer appears, toggle works, renders above raster overlays.

## 2. Modify ADS-B display

1. Marker style, GeoJSON shaping, visibility sync, `ADSB_SOURCE_IDS`/`ADSB_LAYER_IDS`, or hover popup behavior -> `frontend/src/features/aviation-layers/addAdsbLayer.js`.
2. Backend fetch helper -> `frontend/src/api/adsbApi.js`.
3. ADS-B toggle placement currently remains in `frontend/src/features/weather-overlays/WeatherOverlayPanel.jsx`; do not move it into the aviation panel without a separate UX decision.
4. ADS-B polling is still orchestrated by `frontend/src/features/map/MapView.jsx`; keep changes there limited to polling/composition unless a dedicated ADS-B polling module is introduced in a separate refactor.
5. Verify in browser: ADS-B toggle works, hover popup appears once, and repeated basemap switches do not duplicate hover behavior.

## 3. Wire a new sidebar panel

1. Add icon to `topItems` or `bottomItems` in `frontend/src/app/layout/Sidebar.jsx`.
2. Add label/panelId mapping in `PANEL_MAP`.
3. In `frontend/src/features/map/MapView.jsx`, add a conditional render block guarded by `activePanel === '<panelId>'`.
4. App-level state lives in `frontend/src/app/App.jsx` (`activePanel` + `onPanelToggle`).

## 4. Add a new MET raster overlay

1. Add visibility/panel metadata to `frontend/src/features/weather-overlays/lib/weatherOverlayLayers.js`.
2. Add frame selection or derived data to `frontend/src/features/weather-overlays/lib/weatherOverlayModel.js`.
3. Add Mapbox sync behavior to `syncRasterAndSigwxLayers` or a new weather-owned sync helper in `frontend/src/features/weather-overlays/lib/weatherOverlayLayers.js`.
4. If the overlay installs persistent Mapbox sources/layers, update `WEATHER_OVERLAY_SOURCE_IDS` and `WEATHER_OVERLAY_LAYER_IDS`.
5. If the overlay needs static source/layer installation after basemap reload, update `installWeatherOverlayLayers`.
6. Add toggle or legend UI under `frontend/src/features/weather-overlays/`.
7. Keep `frontend/src/features/map/MapView.jsx` changes limited to high-level composition, passing current model state into weather-owned sync helpers, or adding `styleRevision` to a sync effect dependency.
8. Verify in browser: layer appears, toggle works, basemap switch preserves visibility/data, and aviation/geo layers remain above raster overlays.

## 5. Add a new backend data type

1. Add fetch logic in `backend/src/api-client.js`.
2. Add parser in `backend/src/parsers/`.
3. Add processor in `backend/src/processors/`.
4. Register cron job in `backend/src/index.js` with a per-type lock.
5. Wire route in `backend/server.js` to expose cached data from `store.js`.
6. Add frontend client method in `frontend/src/api/weatherApi.js`.

## 6. Add a standalone app route

1. Add the route component under `frontend/src/features/<feature>/`.
2. Branch in `frontend/src/app/App.jsx` before rendering the main shell.
3. If sidebar navigation is needed, add an item in `frontend/src/app/layout/Sidebar.jsx` that navigates by URL instead of toggling a panel.
4. Verify direct entry, refresh, and existing main-shell route behavior.

## 7. Modify route briefing behavior

1. Add pure route calculations or display model changes in `frontend/src/features/route-briefing/lib/routeBriefingModel.js`.
2. Add route search, procedure-loading, VFR waypoint, or vertical-profile state changes in `frontend/src/features/route-briefing/useRouteBriefing.js`.
3. Add route/procedure/VFR/boundary-fix map preview changes in `frontend/src/features/route-briefing/lib/routePreview.js` or `routePreviewSync.js`.
4. If route preview sources/layers change, update `ROUTE_PREVIEW_SOURCE_IDS` and `ROUTE_PREVIEW_LAYER_IDS` in `routePreviewSync.js`.
5. Add route panel UI changes in `frontend/src/features/route-briefing/RouteBriefingPanel.jsx`.
6. Keep `frontend/src/features/map/MapView.jsx` changes limited to high-level composition, route preview sync invocation, or a new cross-feature slot.
7. Verify IFR, VFR, FIR IN/EXIT, VFR waypoint editing, vertical profile generation, and basemap switch preservation for visible route previews.

## 8. Modify Mapbox style/source-layer sync

1. Keep `frontend/src/features/map/MapView.jsx` responsible for Mapbox instance lifecycle, basemap switching, style readiness, and `styleRevision`.
2. Do not apply current feature data or visibility directly inside `style.load`; install static sources/layers there, then let current-state sync effects rerun via `styleRevision`.
3. Put feature-specific Mapbox writes in the owning feature adapter:
   - Weather overlays -> `frontend/src/features/weather-overlays/lib/weatherOverlayLayers.js`.
   - Route previews -> `frontend/src/features/route-briefing/lib/routePreview.js` or `routePreviewSync.js`.
   - ADS-B -> `frontend/src/features/aviation-layers/addAdsbLayer.js`.
   - Base airports/geo boundaries -> `frontend/src/features/map/lib/baseMapLayers.js`.
4. Use cleanup-aware event binding from `frontend/src/features/map/lib/mapStyleSync.js` for layer handlers that must survive repeated style reloads.
5. If a module owns persistent sources/layers, export or update its `*_SOURCE_IDS` and `*_LAYER_IDS` arrays.
6. Verify with focused tests where Mapbox mocks are representative, then browser smoke: toggle layers, switch basemap twice, confirm visibility/data and hover/click behavior remain stable.

## 9. Modify responsive layout density

1. Check `frontend/src/app/layout/layoutTokens.css` before adding or changing fixed panel widths.
2. Main shell/sidebar sizing -> `frontend/src/app/App.css` and `frontend/src/app/layout/Sidebar.css`.
3. Map overlay panel sizing -> `frontend/src/features/map/MapView.css`.
4. Route briefing panel sizing -> `frontend/src/features/route-briefing/RouteBriefing.css`.
5. Airport drawer sizing -> `frontend/src/features/airport-panel/AirportPanel.css`.
6. Monitoring dashboard density -> `frontend/src/features/monitoring/legacy/App.css`.
7. Verify with `npm.cmd run test:layout --prefix frontend`, `npm.cmd run build --prefix frontend`, and `npm.cmd run smoke:responsive --prefix frontend` while the dev server is running.

## 10. Modify pre-flight weather briefing (route-briefing payload + view)

Spec: `docs/superpowers/specs/2026-06-26-preflight-weather-briefing-design.md`. Plans: `docs/superpowers/plans/2026-06-26-preflight-briefing-phase*.md`.

1. Backend composition (interpretation/threshold/matching) -> `backend/src/briefing/briefing-composer.js`, which calls the pure modules `flight-category.js`, `geo-time-match.js`, `airport-summary.js`, `taf-window.js`, `hazard-section.js`. Keep interpretation in the backend; the frontend renders the payload only.
2. New backend matching rule (e.g., vertical/altitude) -> extend `geo-time-match.js` and add to `hazard-section.js`; keep each module a pure, separately tested unit (`backend/test/*.test.js`).
3. API route -> `POST /api/route-briefing` in `backend/server.js` (reads `store.getCached('metar'|'taf'|'sigmet'|'airmet')`).
4. Briefing inputs (alternate, ETD, cruise speed) + fetch -> `frontend/src/features/route-briefing/useRouteBriefing.js`; ETA via `lib/etaCalc.js`; client in `frontend/src/api/briefingApi.js` (`fetchRouteBriefing`).
5. Briefing rendering (sections, tables, summary board) -> `frontend/src/features/route-briefing/BriefingView.jsx` (+ `BriefingView.css`); overlay slot lives in `MapView.jsx` under `activePanel === 'route-check'`.
6. Verify: `npm --prefix backend test`, `npm --prefix frontend run build`, then browser smoke (search route -> 브리핑 생성 -> view renders; over-threshold cells/chips colored).

## 11. Trigger/observe a feature for testing (developer console `/dev`)

Only works in the **test instance**: `npm run dev:test` (sets `DISABLE_COLLECTION=1` = cron off, data frozen). Backend mounts `/api/dev/*` only under that flag; frontend `/dev` route is behind `import.meta.env.DEV` + runtime `testMode` (`/api/health`). Login `testpilot/testpass123`, route #1 has `payload.routeGeometry` (required for inject).

1. Trigger endpoints -> `backend/src/dev/scenario.js`: `inject` (store 캐시에만 가상 악기상 얹기, 파일 미변경; scenario 플래그 `depLifr`·`destIfr`(→교체필요)·`routeTs`(EMBD_TS)·`routeIce`(SEV_ICE)·`destNotam`), `reset` (실황 복구 + 알림 삭제; INJECT_TYPES=metar/taf/sigmet/notam), `tick` (실제 스케줄러 `runTick` 1회 = 15분 대기 없이 발화), `clear-alerts`, `vitals`, `role`(테스트 계정 role 임시 전환 pilot/forecaster/admin — DB+`req.session.role` 즉시 반영). 착빙/난류 enroute는 store 주입 불가(NWP 모델파일 전용) → SIGMET phenomenon_code로 adverse hazard에만 반영. 딥링크 착지는 `App.jsx`의 `?flight=<routeId>`(에스컬레이션 뷰) 재사용.
2. Observe endpoints (Phase 2, 같은 파일): `request-log` (요청 지연·응답크기 집계), `processor-log` (수집기 run·소요·스킵), `store-stats` (store 타입별 아이템수·바이트 + snapshot-meta 캐시 hit/miss). 계측 소스: `backend/src/dev/instrument.js` (요청 링버퍼 + 캐시 카운터, `server.js`의 `/api` finish 미들웨어가 `DISABLE_COLLECTION`에서만 적재), `stats.js` `duration_ms`/`skips` (index.js `runWithLock` 한 곳에서 측정), `server.js` `getCachedSnapshotMeta` hit/miss.
3. Reuse the real scheduler by importing from `backend/src/alerts/scheduler.js` (`runTick`, `buildBriefingRequest`, `buildSnapshot`) — do not fork evaluation logic into the dev router.
4. Frontend -> `frontend/src/features/developer/`: `tabs/TriggerTab.jsx` (조작), `tabs/ObserveTab.jsx` (2초 폴링 관찰: vitals·요청지연/크기·수집기·store/캐시·알림피드·해시), `developerApi.js` (fetch 래퍼). Add a new scenario/observe panel to these tab components. **진입(주):** `DeveloperConsoleButton.jsx` — 사이드바 전용 아이콘(🔧 Wrench), `Sidebar.jsx`에서 `PersonalSettingsButton` 옆에 렌더. 게이트 = `import.meta.env.DEV` + 런타임 `testMode`(/api/health)만(로그인 불요). 테스트 인스턴스는 1인 개발용이라 미로그인이면 `test`/`1234`로 **자동 로그인**(dev 빌드 전용) → 주입·경로·역할 등 세션 필요한 기능이 로그인 절차 없이 바로 동작. 클릭 → `DeveloperConsole.jsx`(설정창 스타일 모달, 조작/관찰 탭). `DeveloperConsole`은 lazy + `import.meta.env.DEV` 게이트라 운영 빌드 제외. **진입(보조):** `DeveloperPage.jsx` = 같은 탭을 담은 `/dev` 직접 URL(App.jsx lazy 라우트, Playwright/직접접속용). 개인설정(`PersonalSettingsPanel`)엔 개발자 탭 없음(사이드바 아이콘으로 분리). 모든 진입이 같은 TriggerTab/ObserveTab 재사용.
5. Verify: `npm run dev:test` -> login(`test`/`1234`) -> `/dev` -> 조작 탭 주입 -> 관찰 탭 패널 실시간 반영 (Playwright, `docs/dev-server-and-capture.md`).
