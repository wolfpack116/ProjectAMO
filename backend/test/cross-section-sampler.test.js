import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sampleGridAt, buildCrossSection } from '../src/briefing/cross-section-sampler.js'

const grid2x2 = { nx: 2, ny: 2, lonMin: 0, lonMax: 1, latMin: 0, latMax: 1 }

test('sampleGridAt nearest-neighbour indexing', () => {
  const values = [10, 20, 30, 40] // y*nx + x ; (x0y0,x1y0,x0y1,x1y1)
  assert.equal(sampleGridAt(grid2x2, values, 0.0, 0.0), 10)
  assert.equal(sampleGridAt(grid2x2, values, 1.0, 1.0), 40)
  assert.equal(sampleGridAt(grid2x2, values, 5, 5), null) // out of grid
})

test('buildCrossSection assembles levels with altFt from hgt and per-variable coverage', () => {
  const axis = { samples: [{ lon: 0, lat: 0, distanceNm: 0 }, { lon: 1, lat: 1, distanceNm: 10 }] }
  const loadLevel = (levelId) => {
    if (levelId === '500hPa') return {
      pressure: 500, grid: grid2x2,
      T: [253, 254, 255, 256], rh: [80, 82, 84, 86], hgt: [5500, 5500, 5500, 5500],
      u: [10, 10, 10, 10], v: [0, 0, 0, 0],
      icingGrade: [1, 1, 2, 2], cloudPotential: [50, 50, 60, 60],
    }
    return null
  }
  const cs = buildCrossSection({
    axis,
    run: { tmfc: '2026060600', hf: 6, validTime: '2026-06-06T06:00:00Z' },
    levelIds: ['500hPa', '300hPa'],
    loadLevel,
  })
  assert.equal(cs.levels.length, 1)
  const l = cs.levels[0]
  assert.equal(l.pressure, 500)
  assert.ok(Math.abs(l.altFt - 5500 * 3.28084) < 1)
  assert.equal(l.values.length, 2)
  assert.equal(l.values[0].distanceNm, 0)
  assert.equal(typeof l.values[0].t, 'number')
  assert.equal(cs.coverage.byVariable.T.available, true)
  assert.equal(cs.coverage.byVariable.T.topPressure, 500)
})
