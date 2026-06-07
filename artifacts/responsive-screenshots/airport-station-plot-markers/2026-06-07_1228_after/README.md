# Airport Station Plot Markers Capture

- Capture time: 2026-06-07 12:28 Asia/Seoul
- Branch: `main`
- Commit: `071908c`
- Capture method: focused Playwright script `frontend/scripts/airport-station-plot-capture.mjs`
- Viewport: `1600x1200`
- App URL: `http://127.0.0.1:5173`
- Backend URL: `http://127.0.0.1:3001`
- Verification commands:
  - `node --test frontend/src/features/map/lib/airportStationModel.test.js`
  - `node --test frontend/src/features/map/lib/baseMapLayers.test.js`
  - `npm.cmd run build`
- Mocking note: `/api/metar` was intercepted only to force `RKSS` calm wind. `/api/warning` was intercepted to `null` during selected-airport capture to reduce unrelated panel-side noise.
- Console check:
  - `console-missing-image-check.json` reports `hasMissingImageWarnings: false`.
  - `console-log.json` still contains repeated `Maximum update depth exceeded` errors during the focused capture. This was not resolved as part of the station-marker task.
