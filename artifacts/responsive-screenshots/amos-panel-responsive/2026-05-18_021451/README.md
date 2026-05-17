# AMOS Panel Responsive Capture

- Capture time: 2026-05-17T17:14:54.678Z
- App URL: http://localhost:5173
- Method: AMOS tab harness rendered with the production React component and CSS.
- Viewports: 390x844, 820x1180, 1180x820, 1920x1080.
- Panel harness widths: 560px, 640px, 800px.
- Verification commands:
  - node --test frontend/src/features/airport-panel/lib/amosViewModel.test.js
  - node --test frontend/src/app/layout/layoutTokens.test.js
  - npm.cmd run build --prefix frontend
  - PROJECTAMO_URL=http://localhost:5173 npm.cmd run smoke:responsive --prefix frontend
- Issue report: review/issues.md
