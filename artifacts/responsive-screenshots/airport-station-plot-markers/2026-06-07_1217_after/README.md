# Airport Station Plot Markers Capture

- Capture time: 2026-06-07 12:17 Asia/Seoul
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
- Mocking note: the capture script intercepted `/api/metar` only to force `RKSS` calm wind for the required no-wind-barb screenshot. Other airports used the current local METAR payload.
- Console check: `console-missing-image-check.json` reports `hasMissingImageWarnings: false`.
