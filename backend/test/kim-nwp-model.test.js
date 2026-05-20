import assert from 'node:assert/strict'
import test from 'node:test'

import {
  KIM_NWP_FORECAST_HOURS,
  KIM_NWP_LEVELS,
  KIM_NWP_MOISTURE_LEVEL_IDS,
  buildKimCloudPotentialFieldFromGrid,
  buildKimTemperatureFieldFromGrid,
  buildKimNwpGrid,
  buildKimNwpIndex,
  buildKimSurfaceWindFieldFromWindGrid,
  filterKimNwpIndexForVariables,
} from '../src/processors/kim-nwp-model.js'

const BOUNDS = { lonMin: 119, latMin: 30, lonMax: 119.083333, latMax: 30.083333, dx: 0.083333, dy: 0.083333 }

function component(variable, values, level = 0) {
  return { variable, unit: 'm/s', level, nx: 2, ny: 2, bounds: BOUNDS, values }
}

function tempComponent(values, unit = 'K') {
  return { variable: 'T', unit, level: 925, nx: 2, ny: 2, bounds: BOUNDS, values }
}

test('KIM wind levels and forecast hours match this phase scope', () => {
  assert.deepEqual(KIM_NWP_LEVELS.map((level) => level.id), ['10m', '925hPa', '850hPa', '700hPa', '500hPa', '300hPa'])
  assert.deepEqual(KIM_NWP_MOISTURE_LEVEL_IDS, ['925hPa', '850hPa', '700hPa', '500hPa'])
  assert.deepEqual(KIM_NWP_FORECAST_HOURS, [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36])
})

test('buildKimNwpGrid stores u and v for one time and level', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level: KIM_NWP_LEVELS[1],
    components: [
      component('u', [1, 2, 3, 4], 925),
      component('v', [0, 0, 1, 1], 925),
    ],
    fetchedAt: '2026-05-19T00:15:00.000Z',
  })

  assert.equal(grid.type, 'kim_nwp_grid')
  assert.equal(grid.validTime, '2026-05-19T03:00:00.000Z')
  assert.deepEqual(Object.keys(grid.variables), ['u', 'v'])
  assert.equal(grid.variables.u.encoding, 'int16-scaled-json-v1')
})

test('buildKimNwpGrid stores a temp-only variable grid', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level: KIM_NWP_LEVELS[1],
    components: [tempComponent([279.39, Number.NaN, 280.12, 281.55])],
    fetchedAt: '2026-05-19T00:15:00.000Z',
  })

  assert.deepEqual(Object.keys(grid.variables), ['T'])
  assert.equal(grid.variables.T.unit, 'K')
  assert.equal(grid.variables.T.values[0], 27939)
  assert.equal(grid.variables.T.values[1], -32768)
})

test('buildKimSurfaceWindFieldFromWindGrid derives renderer field', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 0,
    level: KIM_NWP_LEVELS[0],
    components: [
      component('u', [3, 0, 0, 8]),
      component('v', [4, 0, 12, 15]),
    ],
  })

  const field = buildKimSurfaceWindFieldFromWindGrid(grid)

  assert.equal(field.type, 'kim_surface_wind')
  assert.equal(field.level.id, '10m')
  assert.equal(field.stats.maxSpeed, 17)
  assert.deepEqual(field.u, grid.variables.u.values)
  assert.deepEqual(field.v, grid.variables.v.values)
})

test('buildKimSurfaceWindFieldFromWindGrid still rejects grids without u/v pairs', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 0,
    level: KIM_NWP_LEVELS[1],
    components: [tempComponent([279.39, 280.11, 281.22, 282.33])],
  })

  assert.throws(() => buildKimSurfaceWindFieldFromWindGrid(grid), /u\/v/i)
})

test('buildKimTemperatureFieldFromGrid returns Kelvin T only and excludes NaN from stats', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level: KIM_NWP_LEVELS[1],
    components: [
      component('u', [1, 1, 1, 1], 925),
      component('v', [0, 0, 0, 0], 925),
      tempComponent([279.39, Number.NaN, 280.12, 281.55]),
    ],
    fetchedAt: '2026-05-19T00:15:00.000Z',
  })

  const field = buildKimTemperatureFieldFromGrid(grid)

  assert.equal(field.type, 'kim_nwp_temperature')
  assert.deepEqual(field.units, { T: 'K' })
  assert.deepEqual(field.T, grid.variables.T.values)
  assert.equal(Object.hasOwn(field, 'u'), false)
  assert.equal(Object.hasOwn(field, 'v'), false)
  assert.deepEqual(field.stats, { minT: 279.39, maxT: 281.55, meanT: 280.353 })
})

test('buildKimCloudPotentialFieldFromGrid derives spread and graded moisture potential from T and rh', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level: KIM_NWP_LEVELS[2],
    components: [
      tempComponent([293.15, 293.15, 293.15, Number.NaN]),
      { variable: 'rh', unit: '%', level: 850, nx: 2, ny: 2, bounds: BOUNDS, values: [90, 60, 100, 80] },
    ],
  })

  const field = buildKimCloudPotentialFieldFromGrid(grid)

  assert.equal(field.type, 'kim_nwp_cloud_potential')
  assert.deepEqual(field.units, { spread: 'C', cloudPotential: '%' })
  assert.equal(field.thresholdC, 4)
  assert.equal(field.cloudPotential[0] > 0 && field.cloudPotential[0] < 10000, true)
  assert.equal(field.cloudPotential[1], 0)
  assert.equal(field.cloudPotential[2], 10000)
  assert.equal(field.cloudPotential[3], -32768)
})

test('buildKimNwpIndex omits encoded values', () => {
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 0,
    level: KIM_NWP_LEVELS[0],
    components: [
      component('u', [1, 1, 1, 1]),
      component('v', [0, 0, 0, 0]),
    ],
  })

  const index = buildKimNwpIndex({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    grids: [grid],
    pathForGrid: () => 'kim_nwp/runs/KIMG_NE57_2026051900/normalized/hf000/10m/grid.json',
  })

  assert.equal(index.type, 'kim_nwp_index')
  assert.equal(index.latestRun, '2026051900')
  assert.equal(JSON.stringify(index).includes('"values"'), false)
})

test('filterKimNwpIndexForVariables separates wind and temp availability', () => {
  const windGrid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 0,
    level: KIM_NWP_LEVELS[0],
    components: [
      component('u', [1, 1, 1, 1]),
      component('v', [0, 0, 0, 0]),
    ],
  })
  const tempGrid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    hf: 3,
    level: KIM_NWP_LEVELS[1],
    components: [
      component('u', [1, 1, 1, 1], 925),
      component('v', [0, 0, 0, 0], 925),
      tempComponent([279, 280, 281, 282]),
    ],
  })
  const index = buildKimNwpIndex({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    grids: [windGrid, tempGrid],
    pathForGrid: (grid) => `kim_nwp/${grid.level.id}/${grid.hf}/grid.json`,
  })

  const windIndex = filterKimNwpIndexForVariables(index, ['u', 'v'])
  const tempIndex = filterKimNwpIndexForVariables(index, ['T'])

  assert.deepEqual(windIndex.levels.map((level) => level.id), ['10m', '925hPa'])
  assert.deepEqual(tempIndex.levels.map((level) => level.id), ['925hPa'])
  assert.equal(tempIndex.availability['10m'], undefined)
  assert.deepEqual(windIndex.availability['10m']['0'].variables, ['u', 'v'])
  assert.deepEqual(windIndex.availability['925hPa']['3'].variables, ['u', 'v'])
  assert.deepEqual(tempIndex.availability['925hPa']['3'].variables, ['T'])
})

test('filterKimNwpIndexForVariables exposes cloud grids only when T and rh exist', () => {
  const index = buildKimNwpIndex({
    model: 'KIMG/NE57',
    tmfc: '2026051900',
    grids: [
      buildKimNwpGrid({
        model: 'KIMG/NE57',
        tmfc: '2026051900',
        hf: 0,
        level: KIM_NWP_LEVELS[1],
        components: [tempComponent([279, 280, 281, 282])],
      }),
      buildKimNwpGrid({
        model: 'KIMG/NE57',
        tmfc: '2026051900',
        hf: 3,
        level: KIM_NWP_LEVELS[2],
        components: [
          tempComponent([279, 280, 281, 282]),
          { variable: 'rh', unit: '%', level: 850, nx: 2, ny: 2, bounds: BOUNDS, values: [90, 80, 70, 60] },
        ],
      }),
    ],
    pathForGrid: (grid) => `kim_nwp/${grid.level.id}/${grid.hf}/grid.json`,
  })

  const cloudIndex = filterKimNwpIndexForVariables(index, ['T', 'rh'])

  assert.deepEqual(cloudIndex.levels.map((level) => level.id), ['850hPa'])
  assert.deepEqual(cloudIndex.availability['850hPa']['3'].variables, ['T', 'rh'])
})
