import assert from 'node:assert/strict'
import test from 'node:test'

import { parseKimGridText } from '../src/parsers/kim-grid-parser.js'
import { buildKimGridUrl } from '../src/api-client.js'
import config from '../src/config.js'
import {
  KIM_NWP_LEVELS,
  buildKimNwpGrid,
  buildKimNwpIndex,
  buildKimWindGrid,
} from '../src/processors/kim-nwp-model.js'
import {
  buildKimSurfaceWindField,
  collectKimNwpTask,
  hasCompleteKimNwpRun,
  mapKimNwpTasksWithConcurrency,
  mergeHumidityComponentIntoGrid,
  resolveKimHumidityComponentRequest,
  resolveKimSurfaceWindCandidates,
  selectLegacySurfaceWindGrid,
  shouldPublishKimNwpRun,
  resolveKimTemperatureComponentRequest,
} from '../src/processors/kim-surface-wind-processor.js'

const BOUNDS = {
  lonMin: 119,
  latMin: 30,
  lonMax: 119.166666,
  latMax: 30.166666,
  dx: 0.083333,
  dy: 0.083333,
}

const BOUNDS_2X2 = {
  lonMin: 119,
  latMin: 30,
  lonMax: 119.083333,
  latMax: 30.083333,
  dx: 0.083333,
  dy: 0.083333,
}

test('parseKimGridText parses KIM ASCII j blocks and keeps zero-byte payloads with numeric rows', () => {
  const text = [
    '# variable: u10m',
    '# unit: m/s',
    '# fsize: 0byte',
    '# j = 1',
    '1.0 2.0 3.0',
    '# j = 2',
    '4.0 5.0 6.0',
  ].join('\n')

  const grid = parseKimGridText(text, { variable: 'u10m', level: 0, bounds: BOUNDS })

  assert.equal(grid.variable, 'u10m')
  assert.equal(grid.unit, 'm/s')
  assert.equal(grid.nx, 3)
  assert.equal(grid.ny, 2)
  assert.deepEqual(grid.values, [1, 2, 3, 4, 5, 6])
})

test('parseKimGridText uses KIM i/j dimensions when numeric rows are line-wrapped', () => {
  const text = [
    '# fname: /ARCV/RAWD/MODL/GDPS/NE57/example.nc, fsize: 0byte',
    '# variable = u10m, unit = m/s, level = 0, i = 5, j = 2, map = S',
    '# j = 1',
    '1 2 3',
    '4 5',
    '# j = 2',
    '6 7 8',
    '9 10',
  ].join('\n')

  const grid = parseKimGridText(text, { variable: 'u10m', level: 0, bounds: BOUNDS })

  assert.equal(grid.nx, 5)
  assert.equal(grid.ny, 2)
  assert.deepEqual(grid.values, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('parseKimGridText rejects missing variables even when the HTTP request succeeds', () => {
  assert.throws(
    () => parseKimGridText('Variable not found: v10m', { variable: 'v10m', level: 0, bounds: BOUNDS }),
    /Variable not found/i,
  )
})

test('buildKimSurfaceWindField combines u/v, calculates fixed speed stats, and encodes int16 JSON', () => {
  const uGrid = {
    variable: 'u10m',
    unit: 'm/s',
    level: 0,
    nx: 2,
    ny: 2,
    bounds: BOUNDS_2X2,
    values: [0, 3, 0, 8],
  }
  const vGrid = {
    ...uGrid,
    variable: 'v10m',
    values: [0, 4, 12, 15],
  }

  const field = buildKimSurfaceWindField({
    uGrid,
    vGrid,
    tmfc: '2026051800',
    hf: 3,
    fetchedAt: '2026-05-18T03:05:00.000Z',
  })

  assert.equal(field.type, 'kim_surface_wind')
  assert.equal(field.model, 'KIMG/NE57')
  assert.equal(field.time.validTime, '2026-05-18T03:00:00.000Z')
  assert.equal(field.encoding, 'int16-scaled-json-v1')
  assert.equal(field.scale, 0.01)
  assert.deepEqual(field.u, [0, 300, 0, 800])
  assert.deepEqual(field.v, [0, 400, 1200, 1500])
  assert.equal(field.stats.minSpeed, 0)
  assert.equal(field.stats.maxSpeed, 17)
  assert.equal(field.stats.meanSpeed, 8.5)
})

test('buildKimSurfaceWindField rejects grids that do not match configured bounds', () => {
  const uGrid = {
    variable: 'u10m',
    unit: 'm/s',
    level: 0,
    nx: 2,
    ny: 2,
    bounds: BOUNDS,
    values: [0, 1, 2, 3],
  }
  const vGrid = {
    ...uGrid,
    variable: 'v10m',
    values: [0, 1, 2, 3],
  }

  assert.throws(
    () => buildKimSurfaceWindField({ uGrid, vGrid, tmfc: '2026051800', hf: 0 }),
    /nx mismatch/i,
  )
})

test('resolveKimSurfaceWindCandidates starts with recent synoptic cycles and hf 0', () => {
  const candidates = resolveKimSurfaceWindCandidates(new Date('2026-05-18T05:20:00.000Z'))

  assert.deepEqual(candidates.slice(0, 3), [
    { tmfc: '2026051800', hf: 0 },
    { tmfc: '2026051718', hf: 0 },
    { tmfc: '2026051712', hf: 0 },
  ])
})

test('KIM NWP scheduler polls only around synoptic release windows', () => {
  assert.equal(config.schedule.kim_surface_wind_interval, '12 0,1,2,6,7,8,12,13,14,18,19,20 * * *')
})

test('buildKimGridUrl uses the KMA APIHub KIM cgi endpoint', () => {
  const url = buildKimGridUrl({
    data: 'U',
    name: 'u10m',
    level: 0,
    tmfc: '2026051800',
    hf: 0,
    sub: '1429,1441,1633,1609',
  })

  assert.ok(url.startsWith('https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-kim_nc_xy_txt2?'))
  assert.ok(url.includes('group=KIMG'))
  assert.ok(url.includes('nwp=NE57'))
  assert.ok(url.includes('name=u10m'))
  assert.ok(url.includes('map=S'))
})

test('resolveKimTemperatureComponentRequest uses pressure T and verified single-level t2m params', () => {
  assert.deepEqual(resolveKimTemperatureComponentRequest({ level: { id: '925hPa', kind: 'pressure', level: 925 } }), {
    data: 'P',
    name: 'T',
    level: 925,
    variable: 'T',
    unit: 'K',
  })
  assert.deepEqual(resolveKimTemperatureComponentRequest({ level: { id: '10m', kind: 'height', level: 0 } }), {
    data: 'U',
    name: 't2m',
    level: 0,
    variable: 'T',
    unit: 'K',
  })
})

test('resolveKimHumidityComponentRequest uses moisture-analysis pressure rh params only', () => {
  assert.equal(resolveKimHumidityComponentRequest({ level: { id: '10m', kind: 'height', level: 0 } }), null)
  assert.equal(resolveKimHumidityComponentRequest({ level: { id: '300hPa', kind: 'pressure', level: 300 } }), null)
  assert.deepEqual(resolveKimHumidityComponentRequest({ level: { id: '850hPa', kind: 'pressure', level: 850 } }), {
    data: 'P',
    name: 'rh',
    level: 850,
    variable: 'rh',
    unit: '%',
  })
})

test('shouldPublishKimNwpRun rejects incomplete wind grid runs but allows temp-missing wind grids', () => {
  const expectedGridCount = 2
  const completeWindOnlyRun = [
    { variables: { u: {}, v: {} } },
    { variables: { u: {}, v: {} } },
  ]
  const incompleteWindRun = [
    { variables: { u: {}, v: {} } },
  ]
  const tempOnlyRun = [
    { variables: { T: {} } },
    { variables: { T: {} } },
  ]

  assert.equal(shouldPublishKimNwpRun({ grids: completeWindOnlyRun, expectedGridCount }), true)
  assert.equal(shouldPublishKimNwpRun({ grids: incompleteWindRun, expectedGridCount }), false)
  assert.equal(shouldPublishKimNwpRun({ grids: tempOnlyRun, expectedGridCount }), false)
})

test('shouldPublishKimNwpRun allows rh-missing wind/temp grids', () => {
  assert.equal(shouldPublishKimNwpRun({
    expectedGridCount: 1,
    grids: [{ variables: { u: {}, v: {}, T: {} } }],
  }), true)
})

test('hasCompleteKimNwpRun skips only when latest run has wind temp and moisture-level rh availability', () => {
  const tmfc = '2026051900'
  const hf = 0
  const grids = KIM_NWP_LEVELS.map((level) => buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc,
    hf,
    level,
    components: [
      { variable: 'u', unit: 'm/s', level: level.level, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [1, 2, 3, 4] },
      { variable: 'v', unit: 'm/s', level: level.level, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [0, 1, 0, 1] },
      { variable: 'T', unit: 'K', level: level.level, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [279, 280, 281, 282] },
        ...(level.kind === 'pressure' && level.id !== '300hPa'
          ? [{ variable: 'rh', unit: '%', level: level.level, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [90, 80, 70, 60] }]
          : []),
    ],
  }))
  const completeIndex = buildKimNwpIndex({
    model: 'KIMG/NE57',
    tmfc,
    grids,
    pathForGrid: (grid) => `kim_nwp/${grid.level.id}/${grid.hf}/grid.json`,
  })
  const missingRhIndex = buildKimNwpIndex({
    model: 'KIMG/NE57',
    tmfc,
    grids: grids.map((grid) => (
        grid.level.id === '850hPa'
        ? { ...grid, variables: { u: grid.variables.u, v: grid.variables.v, T: grid.variables.T } }
        : grid
    )),
    pathForGrid: (grid) => `kim_nwp/${grid.level.id}/${grid.hf}/grid.json`,
  })

  assert.equal(hasCompleteKimNwpRun({
    latest: { latestRun: tmfc },
    index: completeIndex,
    tmfc,
    forecastHours: [hf],
    levels: KIM_NWP_LEVELS,
  }), true)
  assert.equal(hasCompleteKimNwpRun({
    latest: { latestRun: tmfc },
    index: missingRhIndex,
    tmfc,
    forecastHours: [hf],
    levels: KIM_NWP_LEVELS,
  }), false)
})

test('mergeHumidityComponentIntoGrid adds rh without dropping existing wind/temp variables', () => {
  const level = KIM_NWP_LEVELS[2]
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level,
    components: [
      { variable: 'u', unit: 'm/s', level: 850, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [1, 2, 3, 4] },
      { variable: 'v', unit: 'm/s', level: 850, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [0, 1, 0, 1] },
      { variable: 'T', unit: 'K', level: 850, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [279, 280, 281, 282] },
    ],
    fetchedAt: '2026-05-19T00:00:00.000Z',
  })

  const merged = mergeHumidityComponentIntoGrid({
    grid,
    level,
    tmfc: '2026051900',
    hf: 3,
    fetchedAt: '2026-05-19T00:01:00.000Z',
    humidityComponent: { variable: 'rh', unit: '%', level: 850, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [90, 80, 70, 60] },
  })

  assert.deepEqual(Object.keys(merged.variables), ['u', 'v', 'T', 'rh'])
  assert.deepEqual(merged.variables.rh.values, [9000, 8000, 7000, 6000])
  assert.equal(merged.fetched_at, '2026-05-19T00:01:00.000Z')
})

test('collectKimNwpTask keeps wind/temp grid publishable when rh merge fails', async () => {
  const level = KIM_NWP_LEVELS[1]
  const task = { level, tmfc: '2026051900', hf: 3 }
  const windGrid = buildKimWindGrid({
    model: 'KIMG/NE57',
    tmfc: task.tmfc,
    hf: task.hf,
    level,
    components: [
      { variable: 'u', unit: 'm/s', level: 925, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [1, 2, 3, 4] },
      { variable: 'v', unit: 'm/s', level: 925, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [0, 1, 0, 1] },
    ],
  })
  const tempGrid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: task.tmfc,
    hf: task.hf,
    level,
    components: [
      { variable: 'u', unit: 'm/s', level: 925, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [1, 2, 3, 4] },
      { variable: 'v', unit: 'm/s', level: 925, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [0, 1, 0, 1] },
      { variable: 'T', unit: 'K', level: 925, nx: 2, ny: 2, bounds: BOUNDS_2X2, values: [279, 280, 281, 282] },
    ],
  })
  const writes = []

  const { grid, lastError } = await collectKimNwpTask({
    task,
    fetchWind: async () => windGrid,
    addTemperature: async () => tempGrid,
    addHumidity: async () => { throw new Error('rh failed') },
    writeGrid: (nextGrid) => writes.push(nextGrid),
  })

  assert.match(lastError.message, /rh failed/)
  assert.equal(grid.variables.u != null, true)
  assert.equal(grid.variables.v != null, true)
  assert.equal(grid.variables.T != null, true)
  assert.equal(grid.variables.rh, undefined)
  assert.equal(shouldPublishKimNwpRun({ grids: [grid], expectedGridCount: 1 }), true)
  assert.equal(writes.length, 2)
})

test('selectLegacySurfaceWindGrid prefers 10m hf0 regardless of collection order', () => {
  const surface = { level: { id: '10m' }, hf: 0 }
  const shuffled = [
    { level: { id: '10m' }, hf: 12 },
    { level: { id: '925hPa' }, hf: 0 },
    surface,
  ]

  assert.equal(selectLegacySurfaceWindGrid(shuffled), surface)
})

test('mapKimNwpTasksWithConcurrency stops scheduling after a required task failure', async () => {
  const started = []

  await assert.rejects(
    () => mapKimNwpTasksWithConcurrency([1, 2, 3, 4, 5], 1, async (item) => {
      started.push(item)
      if (item === 2) throw new Error('wind failed')
      return item
    }),
    /wind failed/,
  )

  assert.deepEqual(started, [1, 2])
})
