# KIM NWP Time Level Wind Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add KIM NWP time and altitude selection for wind animation and speed layer while storing model data in a bounded, route-briefing-ready backend structure.

**Architecture:** KIM NWP data is stored through a dedicated manifest-based store, not as one large `latest.json` payload and not as generic `store.save()` history. `latest.json` and `index.json` remain small manifests; actual grids live under run-scoped files. The current `/api/kim/surface-wind` route remains a map compatibility facade that derives one renderer-compatible field from normalized KIM NWP grids. Route briefing will later sample the same normalized grids for WIN/TEMP-style route products.

**Tech Stack:** Node/Express backend, local `DATA_PATH` storage, existing KIM grid API client/parser, React/Vite frontend, Mapbox GL, existing WebGL/Canvas wind renderers, Node test runner.

---

## Design Decision

Do not store all KIM NWP data inside `kim_surface_wind/latest.json`.

KIM NWP is not like METAR/TAF/SIGMET where one compact JSON document is enough. It is closer to radar/satellite in this project:

- radar stores image frames plus `echo_meta.json`
- satellite stores frame assets plus `sat_meta.json`
- KIM NWP should store run-scoped grid files plus small manifests

The durable source of truth is:

- raw KIM component responses, optionally retained
- normalized compact grids by run, forecast hour, level, and variable set
- manifest/index files that describe availability

The UI products are not the source of truth:

- speed layer image
- particle renderer field
- WebGL/Canvas state
- current map-selected `kim_surface_wind` response

Those are derived from normalized KIM NWP data.

## Storage Layout

Use a dedicated KIM NWP store under `DATA_PATH`.

```text
DATA_PATH/
  kim_nwp/
    latest.json
    index.json
    runs/
      KIMG_NE57_2026051900/
        manifest.json
        raw/
          hf000/10m/u.txt
          hf000/10m/v.txt
          hf003/850hPa/u.txt
          hf003/850hPa/v.txt
          hf003/850hPa/T.txt
          hf003/850hPa/hgt.txt
        normalized/
          hf000/10m/grid.json
          hf003/850hPa/grid.json
          hf003/500hPa/grid.json
```

`latest.json` is small:

```json
{
  "type": "kim_nwp_latest",
  "model": "KIMG/NE57",
  "latestRun": "2026051900",
  "latestRunId": "KIMG_NE57_2026051900",
  "indexPath": "kim_nwp/index.json",
  "updated_at": "2026-05-19T05:10:00.000Z",
  "content_hash": "sha256..."
}
```

`index.json` is also small and API-facing:

```json
{
  "type": "kim_nwp_index",
  "model": "KIMG/NE57",
  "latestRun": "2026051900",
  "runs": [
    {
      "tmfc": "2026051900",
      "runId": "KIMG_NE57_2026051900",
      "baseTime": "2026-05-19T00:00:00.000Z",
      "times": [
        { "hf": 0, "validTime": "2026-05-19T00:00:00.000Z" },
        { "hf": 3, "validTime": "2026-05-19T03:00:00.000Z" }
      ],
      "levels": [
        { "id": "10m", "kind": "height", "value": 10, "unit": "m" },
        { "id": "850hPa", "kind": "pressure", "value": 850, "unit": "hPa" }
      ],
      "availability": {
        "10m": {
          "0": { "variables": ["u", "v"], "path": "kim_nwp/runs/KIMG_NE57_2026051900/normalized/hf000/10m/grid.json" }
        },
        "850hPa": {
          "3": { "variables": ["u", "v", "T", "hgt"], "path": "kim_nwp/runs/KIMG_NE57_2026051900/normalized/hf003/850hPa/grid.json" }
        }
      }
    }
  ]
}
```

Each `grid.json` owns one run, one forecast hour, and one level. It stores multiple variables together so route sampling can read `u/v/T/hgt` from one file.

```json
{
  "type": "kim_nwp_grid",
  "model": "KIMG/NE57",
  "tmfc": "2026051900",
  "hf": 3,
  "validTime": "2026-05-19T03:00:00.000Z",
  "level": { "id": "850hPa", "kind": "pressure", "value": 850, "unit": "hPa" },
  "grid": { "nx": 205, "ny": 169, "lonMin": 119, "latMin": 30, "lonMax": 136, "latMax": 44, "dx": 0.083333, "dy": 0.083333 },
  "variables": {
    "u": { "unit": "m/s", "encoding": "int16-scaled-json-v1", "scale": 0.01, "offset": 0, "values": [] },
    "v": { "unit": "m/s", "encoding": "int16-scaled-json-v1", "scale": 0.01, "offset": 0, "values": [] },
    "T": { "unit": "K", "encoding": "int16-scaled-json-v1", "scale": 0.01, "offset": 0, "values": [] },
    "hgt": { "unit": "gpm", "encoding": "int16-scaled-json-v1", "scale": 1, "offset": 0, "values": [] }
  },
  "fetched_at": "2026-05-19T00:15:00.000Z"
}
```

## Retention Policy

Storage must stay bounded on the production VM.

Default policy:

- Keep latest 2 usable runs.
- Retain raw component responses for latest 2 usable runs by default.
- Retain normalized grids for latest 2 usable runs.
- Delete old runs by removing whole `kim_nwp/runs/<runId>/` directories.
- Never delete the previous usable run after a failed collection.
- Update `latest.json` only after the new run has at least one usable normalized grid.
- Generate route-specific samples on request; do not persist them by default.

Config additions:

```js
export const kim_nwp = {
  max_runs: Number(process.env.KIM_NWP_MAX_RUNS || 2),
  keep_raw: process.env.KIM_NWP_KEEP_RAW !== '0',
  forecast_hours: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
}
```

## Forecast Time And Level Rules

- Use the latest forecast run with at least one usable normalized grid.
- Probe recent synoptic runs until a usable run is found.
- Probe forecast hours `0,3,6,9,12,15,18,21,24,27,30,33,36`.
- Do not expose valid times earlier than the current time.
- Show time by `validTime = tmfc + hf`, displayed in KST.
- Target levels:
  - `10m`
  - `925hPa`
  - `850hPa`
  - `700hPa`
  - `500hPa`
  - `300hPa`

Variable readiness:

- `10m`: initially requires `u10m`, `v10m`
- pressure levels: initially require `u`, `v`
- route briefing readiness reserves `T`, `hgt`
- missing variables should be recorded in manifest availability, not treated as a whole-run failure

## API Design

Keep current map route:

```text
GET /api/kim/surface-wind
```

This route returns the existing renderer-compatible selected field for backward compatibility. Internally it should:

1. read `kim_nwp/index.json`
2. resolve default or requested `tmfc/hf/level`
3. load one normalized `grid.json`
4. derive the existing `kim_surface_wind` field shape from `variables.u` and `variables.v`

Add new route-ready endpoints later:

```text
GET  /api/kim/nwp/index
GET  /api/kim/nwp/field?tmfc=2026051900&hf=3&level=850hPa
POST /api/kim/nwp/route-sample
```

`/api/kim/nwp/index` returns manifest/index only. It must not include full grid arrays.

`/api/kim/nwp/field` returns one `grid.json` or a derived renderer-compatible field depending on query parameter:

```text
GET /api/kim/nwp/field?tmfc=2026051900&hf=3&level=850hPa&format=grid
GET /api/kim/nwp/field?tmfc=2026051900&hf=3&level=850hPa&format=wind-field
```

`/api/kim/nwp/route-sample` is for future route briefing:

```js
sampleKimNwpAlongRoute({
  routeAxis,
  validTime: '2026-05-19T12:00:00.000Z',
  levels: ['925hPa', '850hPa', '700hPa', '500hPa', '300hPa'],
  variables: ['u', 'v', 'T', 'hgt'],
})
```

Expected route sample output:

```json
{
  "type": "kim_nwp_route_sample",
  "validTime": "2026-05-19T12:00:00.000Z",
  "samples": [
    {
      "distanceNm": 42.5,
      "lon": 126.451,
      "lat": 37.462,
      "level": "850hPa",
      "wind": { "u": 12.3, "v": -4.2, "speedKt": 25.2, "directionDeg": 289 },
      "temperatureC": -3.1,
      "geopotentialHeightM": 1460
    }
  ]
}
```

## Frontend Scope

The first UI work is only for the weather overlay panel:

- Level selector under Wind
- Time selector under Wind
- Flow toggle stays as wind animation visibility
- Speed toggle stays as speed layer visibility
- Current WebGL/Canvas renderer receives exactly one selected wind field
- MapView remains high-level wiring only

Frontend hook contract:

```js
{
  windField,
  nwpIndex,
  selection,
  setSelection,
  availableLevels,
  availableTimes,
  status,
  error,
  meta,
  lowPower
}
```

The hook should normalize both:

- old single-field `kim_surface_wind`
- new index/field-backed KIM NWP response

The frontend should not parse raw KIM text, perform route sampling, or own NWP storage details.

## Renderer Boundary

Do not change the renderer contract during this phase.

The selected field passed to `windOverlaySync` remains:

```js
{
  type: 'kim_surface_wind',
  model,
  grid,
  time,
  level,
  units,
  stats,
  encoding,
  scale,
  offset,
  u,
  v,
  fetched_at
}
```

The WebGL renderer, Canvas fallback, wind sampler, speed layer, LOD behavior, tone/trail/width controls, and speed color ramp stay renderer concerns. They must not leak into normalized KIM NWP storage.

## File Structure

- Modify `backend/src/config.js`
  - Add `kim_nwp` retention and forecast-hour config.
- Create `backend/src/processors/kim-nwp-store.js`
  - Own KIM NWP directory layout.
  - Read/write `latest.json`, `index.json`, run `manifest.json`, and normalized `grid.json`.
  - Keep raw response writes optional.
  - Cleanup old run directories by retention count.
- Create `backend/src/processors/kim-nwp-model.js`
  - Define levels, variables, run IDs, valid-time helpers, and grid encoding helpers.
  - Convert parsed KIM component grids into normalized `kim_nwp_grid`.
  - Convert normalized `kim_nwp_grid` into renderer-compatible wind fields.
- Modify `backend/src/processors/kim-surface-wind-processor.js`
  - Use KIM NWP model/store internally.
  - Keep `process()` scheduler compatibility.
  - Continue supporting `/api/kim/surface-wind` compatibility data.
- Modify `backend/server.js`
  - Keep `/api/kim/surface-wind`.
  - Add `/api/kim/nwp/index` and `/api/kim/nwp/field` when backend store is ready.
  - Add `kimNwp` snapshot meta entry.
- Modify `frontend/src/api/weatherApi.js`
  - Keep `fetchKimSurfaceWind()`.
  - Add `fetchKimNwpIndex()` and `fetchKimNwpField()` when endpoint is added.
- Modify `frontend/src/features/weather-overlays/lib/useKimSurfaceWind.js`
  - Normalize old and new payloads.
  - Own selected time/level state.
  - Fetch only selected field when payload size is split.
- Modify `frontend/src/features/weather-overlays/WeatherOverlayPanel.jsx`
  - Add compact time and level controls under Wind.
- Modify `frontend/src/features/map/MapView.jsx`
  - High-level prop wiring only.
- Modify `frontend/src/features/weather-overlays/lib/windField.js`
  - Metadata label should use selected level and valid time.

---

### Task 1: KIM NWP Store And Retention

**Files:**
- Modify: `backend/src/config.js`
- Create: `backend/src/processors/kim-nwp-store.js`
- Test: `backend/test/kim-nwp-store.test.js`

- [ ] **Step 1: Write failing store tests**

Create `backend/test/kim-nwp-store.test.js`:

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildKimNwpRunId,
  cleanupKimNwpRuns,
  listKimNwpRuns,
  readKimNwpIndex,
  resolveKimNwpGridPath,
  writeKimNwpIndex,
  writeKimNwpLatest,
} from '../src/processors/kim-nwp-store.js'

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'projectamo-kim-nwp-'))
}

test('buildKimNwpRunId creates filesystem-safe run ids', () => {
  assert.equal(buildKimNwpRunId({ model: 'KIMG/NE57', tmfc: '2026051900' }), 'KIMG_NE57_2026051900')
})

test('resolveKimNwpGridPath groups grids by run, forecast hour, and level', () => {
  const root = tempRoot()
  assert.equal(
    resolveKimNwpGridPath({ root, model: 'KIMG/NE57', tmfc: '2026051900', hf: 3, levelId: '850hPa' }),
    path.join(root, 'kim_nwp', 'runs', 'KIMG_NE57_2026051900', 'normalized', 'hf003', '850hPa', 'grid.json'),
  )
})

test('writeKimNwpIndex writes compact index json without grid arrays', () => {
  const root = tempRoot()
  const index = {
    type: 'kim_nwp_index',
    model: 'KIMG/NE57',
    latestRun: '2026051900',
    runs: [{ tmfc: '2026051900', availability: { '10m': { 0: { variables: ['u', 'v'] } } } }],
  }

  writeKimNwpIndex(root, index)

  assert.deepEqual(readKimNwpIndex(root), index)
  const raw = fs.readFileSync(path.join(root, 'kim_nwp', 'index.json'), 'utf8')
  assert.equal(raw.includes('"values"'), false)
})

test('cleanupKimNwpRuns deletes old runs by run directory', () => {
  const root = tempRoot()
  for (const runId of ['KIMG_NE57_2026051812', 'KIMG_NE57_2026051818', 'KIMG_NE57_2026051900']) {
    fs.mkdirSync(path.join(root, 'kim_nwp', 'runs', runId), { recursive: true })
  }

  cleanupKimNwpRuns({ root, maxRuns: 2 })

  assert.deepEqual(listKimNwpRuns(root), ['KIMG_NE57_2026051900', 'KIMG_NE57_2026051818'])
  assert.equal(fs.existsSync(path.join(root, 'kim_nwp', 'runs', 'KIMG_NE57_2026051812')), false)
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test backend/test/kim-nwp-store.test.js
```

Expected: FAIL because `kim-nwp-store.js` does not exist.

- [ ] **Step 3: Add config**

Add to `backend/src/config.js`:

```js
export const kim_nwp = {
  max_runs: Number(process.env.KIM_NWP_MAX_RUNS || 2),
  keep_raw: process.env.KIM_NWP_KEEP_RAW !== '0',
  forecast_hours: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
}
```

Add `kim_nwp` to the default export.

- [ ] **Step 4: Implement store helper**

Create `backend/src/processors/kim-nwp-store.js`:

```js
import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = 'kim_nwp'

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
}

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function buildKimNwpRunId({ model, tmfc }) {
  return `${safeSegment(model)}_${tmfc}`
}

export function resolveKimNwpRoot(root) {
  return path.join(root, ROOT_DIR)
}

export function resolveKimNwpRunDir({ root, model, tmfc }) {
  return path.join(resolveKimNwpRoot(root), 'runs', buildKimNwpRunId({ model, tmfc }))
}

export function resolveKimNwpGridPath({ root, model, tmfc, hf, levelId }) {
  const runDir = resolveKimNwpRunDir({ root, model, tmfc })
  return path.join(runDir, 'normalized', `hf${String(hf).padStart(3, '0')}`, levelId, 'grid.json')
}

export function writeKimNwpGrid({ root, grid }) {
  const filePath = resolveKimNwpGridPath({
    root,
    model: grid.model,
    tmfc: grid.tmfc,
    hf: grid.hf,
    levelId: grid.level.id,
  })
  writeJson(filePath, grid)
  return filePath
}

export function writeKimNwpLatest(root, latest) {
  writeJson(path.join(resolveKimNwpRoot(root), 'latest.json'), latest)
}

export function writeKimNwpIndex(root, index) {
  writeJson(path.join(resolveKimNwpRoot(root), 'index.json'), index)
}

export function readKimNwpIndex(root) {
  const filePath = path.join(resolveKimNwpRoot(root), 'index.json')
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

export function listKimNwpRuns(root) {
  const runsDir = path.join(resolveKimNwpRoot(root), 'runs')
  if (!fs.existsSync(runsDir)) return []
  return fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
}

export function cleanupKimNwpRuns({ root, maxRuns }) {
  const limit = Number(maxRuns)
  if (!Number.isFinite(limit) || limit <= 0) return
  const runsDir = path.join(resolveKimNwpRoot(root), 'runs')
  for (const runId of listKimNwpRuns(root).slice(limit)) {
    fs.rmSync(path.join(runsDir, runId), { recursive: true, force: true })
  }
}
```

- [ ] **Step 5: Run store tests**

Run:

```bash
node --test backend/test/kim-nwp-store.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit store helper**

Run:

```bash
git add backend/src/config.js backend/src/processors/kim-nwp-store.js backend/test/kim-nwp-store.test.js
git commit -m "feat: add kim nwp manifest store"
```

---

### Task 2: KIM NWP Model And Grid Conversion

**Files:**
- Create: `backend/src/processors/kim-nwp-model.js`
- Test: `backend/test/kim-nwp-model.test.js`

- [ ] **Step 1: Write failing model tests**

Create `backend/test/kim-nwp-model.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  KIM_NWP_LEVELS,
  KIM_NWP_VARIABLES,
  buildKimNwpGrid,
  buildKimSurfaceWindFieldFromNwpGrid,
} from '../src/processors/kim-nwp-model.js'

const BOUNDS = { lonMin: 119, latMin: 30, lonMax: 119.083333, latMax: 30.083333, dx: 0.083333, dy: 0.083333 }

function component(variable, values, level = 0) {
  return { variable, unit: variable === 'T' ? 'K' : 'm/s', level, nx: 2, ny: 2, bounds: BOUNDS, values }
}

test('KIM NWP levels include requested surface and pressure levels', () => {
  assert.deepEqual(KIM_NWP_LEVELS.map((level) => level.id), ['10m', '925hPa', '850hPa', '700hPa', '500hPa', '300hPa'])
})

test('KIM NWP variables reserve WIN TEMP fields', () => {
  assert.deepEqual(KIM_NWP_VARIABLES.map((variable) => variable.id), ['u', 'v', 'T', 'hgt'])
})

test('buildKimNwpGrid stores multiple variables for one time and level', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level: KIM_NWP_LEVELS.find((item) => item.id === '850hPa'),
    components: [
      component('u', [1, 2, 3, 4], 850),
      component('v', [0, 0, 1, 1], 850),
      component('T', [270, 271, 272, 273], 850),
    ],
    fetchedAt: '2026-05-19T00:15:00.000Z',
  })

  assert.equal(grid.type, 'kim_nwp_grid')
  assert.equal(grid.validTime, '2026-05-19T03:00:00.000Z')
  assert.deepEqual(Object.keys(grid.variables), ['u', 'v', 'T'])
  assert.equal(grid.variables.u.encoding, 'int16-scaled-json-v1')
})

test('buildKimSurfaceWindFieldFromNwpGrid derives renderer field from u and v', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 0,
    level: KIM_NWP_LEVELS[0],
    components: [component('u', [3, 0, 0, 8]), component('v', [4, 0, 12, 15])],
  })

  const field = buildKimSurfaceWindFieldFromNwpGrid(grid)

  assert.equal(field.type, 'kim_surface_wind')
  assert.equal(field.level.id, '10m')
  assert.equal(field.stats.maxSpeed, 17)
  assert.deepEqual(field.u, grid.variables.u.values)
  assert.deepEqual(field.v, grid.variables.v.values)
})
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test backend/test/kim-nwp-model.test.js
```

Expected: FAIL because `kim-nwp-model.js` does not exist.

- [ ] **Step 3: Implement NWP model**

Create `backend/src/processors/kim-nwp-model.js` with:

```js
const SCALE = 0.01
const OFFSET = 0

export const KIM_NWP_MODEL = 'KIMG/NE57'

export const KIM_NWP_LEVELS = [
  { id: '10m', label: '10m', kind: 'height', value: 10, unit: 'm', level: 0, variables: { u: 'u10m', v: 'v10m' } },
  { id: '925hPa', label: '925', kind: 'pressure', value: 925, unit: 'hPa', level: 925, variables: { u: 'u', v: 'v', T: 'T', hgt: 'hgt' } },
  { id: '850hPa', label: '850', kind: 'pressure', value: 850, unit: 'hPa', level: 850, variables: { u: 'u', v: 'v', T: 'T', hgt: 'hgt' } },
  { id: '700hPa', label: '700', kind: 'pressure', value: 700, unit: 'hPa', level: 700, variables: { u: 'u', v: 'v', T: 'T', hgt: 'hgt' } },
  { id: '500hPa', label: '500', kind: 'pressure', value: 500, unit: 'hPa', level: 500, variables: { u: 'u', v: 'v', T: 'T', hgt: 'hgt' } },
  { id: '300hPa', label: '300', kind: 'pressure', value: 300, unit: 'hPa', level: 300, variables: { u: 'u', v: 'v', T: 'T', hgt: 'hgt' } },
]

export const KIM_NWP_VARIABLES = [
  { id: 'u', label: 'U wind', unit: 'm/s', rendererRequired: true },
  { id: 'v', label: 'V wind', unit: 'm/s', rendererRequired: true },
  { id: 'T', label: 'Temperature', unit: 'K', rendererRequired: false },
  { id: 'hgt', label: 'Geopotential height', unit: 'gpm', rendererRequired: false },
]

function encode(values, scale = SCALE, offset = OFFSET) {
  return values.map((value) => Math.round((value - offset) / scale))
}

function round(value, digits = 3) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function parseTmfc(tmfc) {
  const raw = String(tmfc || '')
  if (!/^\d{10}$/.test(raw)) return null
  return Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8)), Number(raw.slice(8, 10)))
}

export function addForecastHours(tmfc, hf) {
  const baseMs = parseTmfc(tmfc)
  if (!Number.isFinite(baseMs)) return null
  return new Date(baseMs + Number(hf || 0) * 60 * 60 * 1000).toISOString()
}

function validateComponentSet(components) {
  const first = components[0]
  if (!first) throw new Error('KIM NWP grid requires at least one component')
  for (const component of components) {
    if (component.nx !== first.nx || component.ny !== first.ny) throw new Error('KIM NWP component dimensions differ')
    if (component.values.length !== first.values.length) throw new Error('KIM NWP component value counts differ')
  }
}

export function buildKimNwpGrid({ model = KIM_NWP_MODEL, tmfc, hf, level, components, fetchedAt = new Date().toISOString() }) {
  validateComponentSet(components)
  const first = components[0]
  const variables = {}

  for (const component of components) {
    const scale = component.variable === 'hgt' ? 1 : SCALE
    variables[component.variable] = {
      unit: component.unit,
      encoding: 'int16-scaled-json-v1',
      scale,
      offset: OFFSET,
      values: encode(component.values, scale, OFFSET),
    }
  }

  return {
    type: 'kim_nwp_grid',
    model,
    tmfc,
    hf,
    validTime: addForecastHours(tmfc, hf),
    level: { id: level.id, label: level.label, kind: level.kind, value: level.value, unit: level.unit },
    grid: { nx: first.nx, ny: first.ny, ...first.bounds },
    variables,
    fetched_at: fetchedAt,
  }
}

export function buildKimSurfaceWindFieldFromNwpGrid(grid) {
  const u = grid.variables?.u
  const v = grid.variables?.v
  if (!u || !v) throw new Error('KIM surface wind field requires u and v variables')
  if (u.values.length !== v.values.length) throw new Error('KIM u/v value counts differ')

  let minSpeed = Infinity
  let maxSpeed = -Infinity
  let totalSpeed = 0
  for (let index = 0; index < u.values.length; index += 1) {
    const uValue = u.values[index] * u.scale + u.offset
    const vValue = v.values[index] * v.scale + v.offset
    const speed = Math.hypot(uValue, vValue)
    minSpeed = Math.min(minSpeed, speed)
    maxSpeed = Math.max(maxSpeed, speed)
    totalSpeed += speed
  }

  return {
    type: 'kim_surface_wind',
    model: grid.model,
    grid: grid.grid,
    time: { tmfc: grid.tmfc, hf: grid.hf, validTime: grid.validTime },
    level: grid.level,
    units: { u: 'm/s', v: 'm/s', speed: 'm/s' },
    stats: { minSpeed: round(minSpeed), maxSpeed: round(maxSpeed), meanSpeed: round(totalSpeed / u.values.length) },
    encoding: 'int16-scaled-json-v1',
    scale: u.scale,
    offset: u.offset,
    u: u.values,
    v: v.values,
    fetched_at: grid.fetched_at,
  }
}
```

- [ ] **Step 4: Run model tests**

Run:

```bash
node --test backend/test/kim-nwp-model.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit model helper**

Run:

```bash
git add backend/src/processors/kim-nwp-model.js backend/test/kim-nwp-model.test.js
git commit -m "feat: model kim nwp grids"
```

---

### Task 3: Backend Collection Into Manifest Store

**Files:**
- Modify: `backend/src/processors/kim-surface-wind-processor.js`
- Modify: `backend/server.js`
- Test: `backend/test/kim-surface-wind.test.js`

- [ ] **Step 1: Write backend tests for bundle/index behavior**

Add tests to `backend/test/kim-surface-wind.test.js` that assert:

```js
test('KIM collection exposes latest usable NWP index without embedding values', () => {
  const index = buildKimNwpIndex({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    grids: [
      {
        type: 'kim_nwp_grid',
        model: 'KIMG/NE57',
        tmfc: '2026051900',
        hf: 0,
        validTime: '2026-05-19T00:00:00.000Z',
        level: { id: '10m', label: '10m', kind: 'height', value: 10, unit: 'm' },
        variables: { u: { values: [1] }, v: { values: [1] } },
      },
    ],
  })

  assert.equal(index.type, 'kim_nwp_index')
  assert.equal(index.latestRun, '2026051900')
  assert.equal(JSON.stringify(index).includes('"values"'), false)
})
```

If `buildKimNwpIndex()` lives in `kim-nwp-model.js`, import it there. If it lives in `kim-surface-wind-processor.js`, export it from that module. Keep the test pure.

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test backend/test/kim-surface-wind.test.js
```

Expected: FAIL until index building exists.

- [ ] **Step 3: Implement collection flow**

Update `backend/src/processors/kim-surface-wind-processor.js` so `process()`:

1. resolves latest run candidates
2. probes configured forecast hours and levels
3. fetches available components
4. builds `kim_nwp_grid` objects
5. writes each grid with `writeKimNwpGrid()`
6. writes run `manifest.json`
7. writes `index.json`
8. writes `latest.json`
9. runs retention cleanup
10. returns a compact summary

Important rules:

- If a level/time has `u` but not `v`, do not expose it as a wind-renderable option.
- If `T` or `hgt` fails, keep `u/v` and record partial variables.
- If a full run has no usable `u/v` grid, do not update `latest.json`.
- Do not call generic `store.save()` for every grid.

- [ ] **Step 4: Add server routes**

In `backend/server.js`, add:

```js
app.get('/api/kim/nwp/index', (_req, res) => {
  const data = readJsonFileSafe(path.join(DATA_ROOT, 'kim_nwp', 'index.json'))
  if (data) return res.json(data)
  res.status(503).json({ error: 'kim nwp index unavailable' })
})
```

Add field route:

```js
app.get('/api/kim/nwp/field', (req, res) => {
  const tmfc = String(req.query.tmfc || '').trim()
  const hf = Number(req.query.hf)
  const level = String(req.query.level || '').trim()
  if (!/^\d{10}$/.test(tmfc) || !Number.isFinite(hf) || !level) {
    res.status(400).json({ error: 'tmfc, hf, and level are required' })
    return
  }
  // Use store helper in final implementation to resolve the path safely.
})
```

Keep path resolution inside `kim-nwp-store.js` in the actual implementation so query params cannot escape `DATA_PATH`.

- [ ] **Step 5: Run backend tests**

Run:

```bash
node --test backend/test/kim-nwp-store.test.js backend/test/kim-nwp-model.test.js backend/test/kim-surface-wind.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit backend collection**

Run:

```bash
git add backend/src/processors/kim-surface-wind-processor.js backend/server.js backend/test/kim-surface-wind.test.js
git commit -m "feat: collect kim nwp grids by run"
```

---

### Task 4: Frontend Time And Level Selection

**Files:**
- Modify: `frontend/src/api/weatherApi.js`
- Modify: `frontend/src/features/weather-overlays/lib/useKimSurfaceWind.js`
- Create: `frontend/src/features/weather-overlays/lib/useKimSurfaceWind.test.js`
- Modify: `frontend/src/features/weather-overlays/WeatherOverlayPanel.jsx`
- Modify: `frontend/src/features/map/MapView.jsx`

- [ ] **Step 1: Write hook normalization tests**

Create tests that verify:

- old `kim_surface_wind` still works
- new `kim_nwp_index` exposes available levels/times
- selection fetches one field
- missing level/time options are not shown

Use this expected normalized shape:

```js
{
  windField,
  nwpIndex,
  selection,
  availableLevels,
  availableTimes,
  status,
  error,
  meta,
}
```

- [ ] **Step 2: Implement API helpers**

In `frontend/src/api/weatherApi.js`, keep:

```js
export async function fetchKimSurfaceWind() {
  return fetchJson('/api/kim/surface-wind')
}
```

Add:

```js
export async function fetchKimNwpIndex() {
  return fetchJson('/api/kim/nwp/index')
}

export async function fetchKimNwpField({ tmfc, hf, level, format = 'wind-field' }) {
  const params = new URLSearchParams({ tmfc, hf: String(hf), level, format })
  return fetchJson(`/api/kim/nwp/field?${params.toString()}`)
}
```

- [ ] **Step 3: Implement hook selection**

`useKimSurfaceWind()` should:

- fetch index when Wind is enabled
- choose default latest valid time and `10m` when available
- fetch only the selected field
- expose old single-field fallback
- refetch index when snapshot meta `kimNwp` changes

- [ ] **Step 4: Add panel controls**

Add compact controls under Wind:

- Level segmented buttons: `10m`, `925`, `850`, `700`, `500`, `300`
- Time stepper or compact select using KST valid time
- Disable options not present in index

- [ ] **Step 5: Wire MapView only at high level**

Allowed `MapView.jsx` changes:

```jsx
<WeatherOverlayPanel
  windLevels={kimSurfaceWind.availableLevels}
  windTimes={kimSurfaceWind.availableTimes}
  windSelection={kimSurfaceWind.selection}
  onWindSelectionChange={kimSurfaceWind.setSelection}
/>
```

Do not put KIM index parsing, field fetching, or renderer conversion in `MapView.jsx`.

- [ ] **Step 6: Run frontend tests**

Run:

```bash
node --test frontend/src/features/weather-overlays/lib/useKimSurfaceWind.test.js frontend/src/features/weather-overlays/lib/windField.test.js frontend/src/features/weather-overlays/lib/windOverlaySync.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit frontend selection**

Run:

```bash
git add frontend/src/api/weatherApi.js frontend/src/features/weather-overlays/lib/useKimSurfaceWind.js frontend/src/features/weather-overlays/lib/useKimSurfaceWind.test.js frontend/src/features/weather-overlays/WeatherOverlayPanel.jsx frontend/src/features/map/MapView.jsx
git commit -m "feat: select kim wind time and level"
```

---

### Task 5: Speed Layer And Wind Animation Preservation

**Files:**
- Modify: `frontend/src/features/weather-overlays/lib/windField.js`
- Modify: `frontend/src/features/weather-overlays/lib/windOverlaySync.js`
- Test: `frontend/src/features/weather-overlays/lib/windField.test.js`
- Test: `frontend/src/features/weather-overlays/lib/windOverlaySync.test.js`

- [ ] **Step 1: Add metadata label tests**

Add tests:

```js
test('formatKimWindMetaLabel renders selected pressure level and valid time', () => {
  const field = {
    time: { validTime: '2026-05-18T03:00:00.000Z' },
    level: { id: '850hPa', label: '850', kind: 'pressure', value: 850, unit: 'hPa' },
  }
  assert.equal(formatKimWindMetaLabel(field), 'KIM 8km · 850hPa · 05/18 12:00 KST')
})
```

- [ ] **Step 2: Keep renderer contract tests passing**

Verify that a selected field from `kim_nwp_grid` still:

- decodes through the existing wind sampler
- renders speed layer from selected `u/v`
- animates flow through WebGL first and Canvas fallback
- clears animation when Flow is disabled
- keeps speed layer separate from particle visibility

- [ ] **Step 3: Implement only required label/adapter changes**

Update `windField.js` label formatting to use `field.level`.

Do not change speed color ramp, tone, trail, width, LOD, particle count, or renderer fallback in this task unless tests fail because of the new field shape.

- [ ] **Step 4: Run wind renderer tests**

Run:

```bash
node --test frontend/src/features/weather-overlays/lib/windField.test.js frontend/src/features/weather-overlays/lib/windOverlaySync.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit renderer preservation**

Run:

```bash
git add frontend/src/features/weather-overlays/lib/windField.js frontend/src/features/weather-overlays/lib/windOverlaySync.js frontend/src/features/weather-overlays/lib/windField.test.js frontend/src/features/weather-overlays/lib/windOverlaySync.test.js
git commit -m "feat: preserve wind renderer for selected nwp fields"
```

---

### Task 6: Route Briefing Readiness Hooks

**Files:**
- Create: `backend/src/briefing/kim-nwp-route-sampler.js`
- Test: `backend/test/kim-nwp-route-sampler.test.js`
- Modify: `docs/briefing-architecture.md` only if implementation reveals a new architecture rule

- [ ] **Step 1: Add pure sampler tests**

Create `backend/test/kim-nwp-route-sampler.test.js`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'

import { sampleKimNwpGridAtLonLat } from '../src/briefing/kim-nwp-route-sampler.js'

test('sampleKimNwpGridAtLonLat bilinearly samples u and v from a grid', () => {
  const grid = {
    grid: { nx: 2, ny: 2, lonMin: 0, latMin: 0, lonMax: 1, latMax: 1, dx: 1, dy: 1 },
    variables: {
      u: { scale: 1, offset: 0, values: [0, 10, 20, 30] },
      v: { scale: 1, offset: 0, values: [0, 0, 10, 10] },
    },
  }

  const sample = sampleKimNwpGridAtLonLat(grid, 0.5, 0.5)

  assert.equal(sample.u, 15)
  assert.equal(sample.v, 5)
})
```

- [ ] **Step 2: Implement pure grid sampler**

Create `backend/src/briefing/kim-nwp-route-sampler.js` with:

```js
function decode(variable, index) {
  return variable.values[index] * variable.scale + variable.offset
}

export function sampleKimNwpGridAtLonLat(grid, lon, lat) {
  const meta = grid.grid
  if (lon < meta.lonMin || lon > meta.lonMax || lat < meta.latMin || lat > meta.latMax) return null

  const x = (lon - meta.lonMin) / meta.dx
  const y = (lat - meta.latMin) / meta.dy
  const x0 = Math.max(0, Math.min(meta.nx - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(meta.ny - 1, Math.floor(y)))
  const x1 = Math.max(0, Math.min(meta.nx - 1, x0 + 1))
  const y1 = Math.max(0, Math.min(meta.ny - 1, y0 + 1))
  const tx = x - x0
  const ty = y - y0

  function sampleVariable(variable) {
    if (!variable) return null
    const i00 = y0 * meta.nx + x0
    const i10 = y0 * meta.nx + x1
    const i01 = y1 * meta.nx + x0
    const i11 = y1 * meta.nx + x1
    const a = decode(variable, i00) * (1 - tx) + decode(variable, i10) * tx
    const b = decode(variable, i01) * (1 - tx) + decode(variable, i11) * tx
    return a * (1 - ty) + b * ty
  }

  const u = sampleVariable(grid.variables.u)
  const v = sampleVariable(grid.variables.v)
  return { u, v }
}
```

- [ ] **Step 3: Do not wire route API yet**

This task only creates the pure sampler foundation. Route API wiring should be a later plan when route briefing UI/API scope is explicit.

- [ ] **Step 4: Run sampler tests**

Run:

```bash
node --test backend/test/kim-nwp-route-sampler.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit sampler foundation**

Run:

```bash
git add backend/src/briefing/kim-nwp-route-sampler.js backend/test/kim-nwp-route-sampler.test.js
git commit -m "feat: prepare kim nwp route sampling"
```

---

### Task 7: Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Run backend tests**

Run:

```bash
node --test backend/test/kim-nwp-store.test.js backend/test/kim-nwp-model.test.js backend/test/kim-surface-wind.test.js backend/test/kim-nwp-route-sampler.test.js
```

Expected: PASS.

- [ ] **Step 2: Run frontend wind tests**

Run:

```bash
node --test frontend/src/features/weather-overlays/lib/useKimSurfaceWind.test.js frontend/src/features/weather-overlays/lib/windField.test.js frontend/src/features/weather-overlays/lib/windOverlaySync.test.js
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
npm.cmd run build --prefix frontend
```

Expected: PASS. If Vite emits the known Rollup absolute/relative `index.html` asset-name error, record the exact error and use test results as the minimum verification evidence.

- [ ] **Step 4: Browser smoke**

Run dev server:

```bash
npm.cmd run dev
```

Manual checks:

- Open `http://localhost:5173`.
- Turn on Wind.
- Confirm Speed is on by default.
- Confirm Flow animation is visible.
- Change time.
- Change level.
- Confirm animation and speed layer update to the selected field.
- Confirm Flow off removes animation.
- Confirm Speed off removes speed layer.
- Switch basemap twice.
- Confirm wind overlay still follows current selection.

## Risks And Constraints

- KIM pressure-level variable names may differ from assumed `u/v/T/hgt`; availability must be recorded per variable.
- Full bundle responses can become too large; index and field endpoints should prevent sending all grids at once.
- `latest.json` should never contain full grid arrays.
- Generic `store.save()` should not own every KIM NWP grid file.
- Failed collection must not delete previous usable runs.
- Route-specific results should not become the canonical data store.
- `MapView.jsx` must stay high-level wiring only.
- Existing renderer and sampler contracts should stay compatible with one selected wind field.

## Self-Review

- Spec coverage: This plan covers bounded KIM NWP storage, latest/index manifests, raw/normalized separation, time and level selection, wind animation, speed layer preservation, and route briefing readiness.
- Placeholder scan: No `TBD` or open implementation placeholder remains. KIM variable uncertainty is handled by per-variable availability.
- Type consistency: The plan consistently uses `tmfc`, `hf`, `validTime`, `level.id`, `variables`, `latestRun`, `runId`, and `kim_nwp_grid`.
