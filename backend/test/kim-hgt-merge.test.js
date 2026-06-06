import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveKimHgtComponentRequest, mergeHgtComponentIntoGrid } from '../src/processors/kim-surface-wind-processor.js'
import { buildKimNwpGrid, KIM_NWP_LEVELS } from '../src/processors/kim-nwp-model.js'

const BOUNDS = { lonMin: 119, latMin: 30, lonMax: 119.083333, latMax: 30.083333, dx: 0.083333, dy: 0.083333 }

test('hgt requested on pressure levels, not on 10m', () => {
  const p500 = KIM_NWP_LEVELS.find((l) => l.id === '500hPa')
  const surface = KIM_NWP_LEVELS.find((l) => l.id === '10m')
  assert.deepEqual(resolveKimHgtComponentRequest({ level: p500 }), {
    data: 'P',
    name: 'hgt',
    level: 500,
    variable: 'hgt',
    unit: 'm',
  })
  assert.equal(resolveKimHgtComponentRequest({ level: surface }), null)
})

test('mergeHgtComponentIntoGrid adds hgt variable to existing grid', () => {
  const level = KIM_NWP_LEVELS.find((l) => l.id === '500hPa')
  const grid = buildKimNwpGrid({
    model: 'KIMG/NE57',
    tmfc: '2026060600',
    hf: 3,
    level,
    components: [
      { variable: 'u', unit: 'm/s', level: 500, nx: 2, ny: 2, bounds: BOUNDS, values: [1, 2, 3, 4] },
      { variable: 'v', unit: 'm/s', level: 500, nx: 2, ny: 2, bounds: BOUNDS, values: [0, 0, 1, 1] },
    ],
    fetchedAt: '2026-06-06T00:00:00.000Z',
  })
  const hgtComponent = {
    nx: 2, ny: 2,
    bounds: BOUNDS,
    values: [5500, 5510, 5520, 5530],
    variable: 'hgt',
    unit: 'm',
  }
  const out = mergeHgtComponentIntoGrid({ grid, level, tmfc: '2026060600', hf: 3, hgtComponent })
  assert.ok(out.variables.hgt, 'hgt variable should exist')
  assert.equal(out.variables.hgt.unit, 'm')
  assert.deepEqual(Object.keys(out.variables).sort(), ['hgt', 'u', 'v'].sort())
})
