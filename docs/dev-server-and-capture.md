# ProjectAMO Dev Server and Capture Procedure

Use this guide whenever a task requires opening the local backend, opening the frontend, running Playwright screenshots, or using the Codex App Browser against the local app.

In Codex, do not spend a first attempt starting Vite inside the default sandbox for server or capture work. This workspace has a verified Vite/esbuild sandbox failure; request sandbox escalation up front for `dev:verify`, `dev:smoke`, `dev:screenshots`, and `dev:serve`.

## Standard Ports

- Backend: `http://127.0.0.1:3001`
- Backend health check: `http://127.0.0.1:3001/api/health`
- Frontend: `http://127.0.0.1:5173`
- Frontend app URL for Playwright: `PROJECTAMO_URL=http://127.0.0.1:5173`

Do not use the checked-in `Launch-ProjectAMO-Dev.bat` or `Open-ProjectAMO-Dev.bat` as the default launch path unless their hard-coded paths have first been updated for the current workspace.

## Preflight

From the repository root:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
```

If either port is already in use, identify whether it is an existing ProjectAMO server before starting another copy. Keep Vite on `5173` with `--strictPort` so it does not silently move to another port.

## PowerShell PATH Normalization

In the Codex Windows shell, `Path` and `PATH` can both exist in the process environment. This can make `Start-Process` fail with:

```text
An item with the same key has already been added. Key being added: PATH
```

Before using `Start-Process`, normalize the process environment:

```powershell
$pathValue = (cmd.exe /c echo %PATH%)
[Environment]::SetEnvironmentVariable('PATH', $null, 'Process')
[Environment]::SetEnvironmentVariable('Path', $pathValue, 'Process')
```

## Start Servers for Verification

For automated verification, prefer the repo-local Node launcher. It normalizes duplicate Windows `Path`/`PATH` process variables, starts both servers from repository-relative paths, waits for readiness, runs the selected check, and cleans up child processes.

Start both servers and verify readiness:

```powershell
npm.cmd run dev:verify
```

Start both servers and keep them running:

```powershell
npm.cmd run dev:serve
```

Use `dev:serve` only when the user explicitly wants the app left running for manual/browser work. For automated screenshots or smoke checks, use `dev:smoke` or `dev:screenshots` so the launcher starts, verifies, runs the task, and cleans up in one bounded command.

Run responsive smoke with managed servers:

```powershell
npm.cmd run dev:smoke
```

Run baseline responsive screenshots with managed servers:

```powershell
$env:PROJECTAMO_SCREENSHOT_PHASE = '<phase-name>'
$env:PROJECTAMO_SCREENSHOT_LABEL = '<before-or-after-label>'
npm.cmd run dev:screenshots
```

The launcher starts `backend/server.js` and Vite directly with Node instead of keeping long-running servers behind npm wrapper processes. It writes server logs under `artifacts/runtime-logs/`.

Expected timing in the Codex Windows workspace with escalation:

- `npm.cmd run dev:verify`: usually a few seconds.
- `npm.cmd run dev:smoke`: usually under 15 seconds.
- `npm.cmd run dev:screenshots`: usually about 20-30 seconds for the 18-image baseline matrix.

If a single screenshot is needed, do not run the full 18-image baseline matrix. Use Codex App Browser for an interactive state, or write/run a focused Playwright capture for the exact route, viewport, and UI state requested.

Manual backend command:

```powershell
npm.cmd run dev --prefix backend
```

Manual frontend command:

```powershell
npm.cmd run dev --prefix frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

The launcher is preferred over manual commands for Codex verification because it keeps the startup, readiness checks, and cleanup behavior consistent.

## Manual Readiness Checks

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 2
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
```

Expected backend health content includes:

```json
{"ok":true}
```

## Playwright Capture

Use the managed launcher before creating one-off screenshot scripts.

Responsive smoke:

```powershell
npm.cmd run dev:smoke
```

Baseline responsive screenshots:

```powershell
$env:PROJECTAMO_SCREENSHOT_PHASE = '<phase-name>'
$env:PROJECTAMO_SCREENSHOT_LABEL = '<before-or-after-label>'
npm.cmd run dev:screenshots
```

If servers are already running and verified, the lower-level frontend scripts can still be used directly:

```powershell
$env:PROJECTAMO_URL = 'http://127.0.0.1:5173'
npm.cmd run smoke:responsive --prefix frontend
```

```powershell
$env:PROJECTAMO_URL = 'http://127.0.0.1:5173'
$env:PROJECTAMO_SCREENSHOT_PHASE = '<phase-name>'
$env:PROJECTAMO_SCREENSHOT_LABEL = '<before-or-after-label>'
npm.cmd run screenshots:responsive --prefix frontend
```

The managed launcher is cross-platform in intent: it uses Node and chooses `npm.cmd` through `cmd.exe` on Windows and `npm` on macOS/Linux. It still assumes Node/npm dependencies are installed and that ports `3001` and `5173` are available.

For UI states that the baseline script does not cover, write or run focused Playwright steps that open the relevant panel, tab, dialog, or route before capturing. Store responsive evidence under:

```text
artifacts/responsive-screenshots/<phase>/<YYYY-MM-DD_HHMM_label>/
```

Include a short README or manifest with the capture time, branch/commit, viewport matrix, capture method, and verification commands when the capture is part of responsive/UI work.

## Codex App Browser

Use the Codex App Browser for interactive inspection and screenshots when the task needs visible UI state, manual interaction, or browser-side debugging.

Default URL:

```text
http://127.0.0.1:5173
```

Before interacting, confirm both servers are ready. After code changes, reload the browser tab before judging the UI. Prefer Playwright scripts for repeatable baseline captures and Codex App Browser for interactive states.

## Known Failure Modes

- `Start-Process` fails with duplicate `PATH`: use the Node launcher, or run the PATH normalization snippet before manual `Start-Process` commands.
- Vite fails with `Cannot read directory "../../../../..": Access is denied`: this is a known sandbox permission issue seen when Vite/esbuild loads `frontend/vite.config.js`. In Codex, do not retry this repeatedly inside the sandbox; rerun once with sandbox escalation.
- `5173` is already in use: because `--strictPort` is required, the frontend will fail instead of moving ports. Find and stop the existing ProjectAMO frontend or reuse it after verifying it serves the current workspace.
- Backend starts but upstream data collection logs `fetch failed`: this is not a readiness blocker by itself. The server is considered ready when `/api/health` returns success; live external API refresh may still fail because of network/API availability.
- Stopping only the parent `cmd.exe` may leave child `node.exe` processes behind. Clean up by checking listening ports and, when needed, stopping the owning process for `3001` and `5173`.
- Avoid `networkidle` as the default screenshot wait condition for this app. Mapbox tiles and polling can keep the network busy; prefer route-specific DOM readiness selectors.

## Verified Baseline

This procedure was verified on 2026-05-19 in the Codex Windows workspace:

- `npm.cmd run dev:verify` returned backend and frontend readiness successfully with sandbox escalation.
- `npm.cmd run dev:smoke` completed successfully with sandbox escalation.
- `npm.cmd run dev:screenshots` completed successfully with sandbox escalation and generated 18 baseline PNG files for 6 viewports x 3 routes.
- The sandboxed Vite start failed with the access-denied config-load error above, and the same flow succeeded when rerun with sandbox escalation.
