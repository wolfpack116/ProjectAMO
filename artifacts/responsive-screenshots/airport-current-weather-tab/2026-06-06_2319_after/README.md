# Airport Current Weather Tab Capture

- Capture time: 2026-06-06 23:19 Asia/Seoul
- Branch: `main`
- Commit: `b19baa0`
- URL: `http://127.0.0.1:5173`
- Airport: `RKSI`
- State: airport panel forced open with the default `현재날씨` tab selected
- Data note: local snapshot had no active airport warnings, so warning verification used the no-warning state only

## Viewports

- `desktop-1365x768`
- `desktop-1920x1080`
- `mobile-390x844`

## Files

- `desktop-1365x768-page.png`
- `desktop-1365x768-panel.png`
- `desktop-1920x1080-page.png`
- `desktop-1920x1080-panel.png`
- `mobile-390x844-page.png`
- `mobile-390x844-panel.png`

## Commands

- `npm.cmd run dev:smoke`
- `node --test frontend/src/features/airport-panel/lib/currentWeatherViewModel.test.js`
- `npm.cmd run test:airport-panel --prefix frontend`
- `npm.cmd run build` from `frontend`
- Local Playwright capture via inline `node` script against the managed dev server

## Known Limitations

- No active warning airport was present in the local dataset during capture.
- The focused screenshots open the airport panel by dispatching the existing React selected-airport state to `RKSI` for deterministic capture.
