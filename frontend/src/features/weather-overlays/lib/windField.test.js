import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIND_SPEED_COLOR_RAMP,
  createDownsampledWindField,
  createWindFieldSampler,
  decodeWindComponent,
  formatKimWindMetaLabel,
  interpolateWindSpeedColor,
  pickWindSpeedColor,
} from './windField.js'

const FIELD = {
  type: 'kim_surface_wind',
  encoding: 'int16-scaled-json-v1',
  scale: 0.01,
  offset: 0,
  grid: {
    nx: 2,
    ny: 2,
    lonMin: 126,
    latMin: 36,
    lonMax: 127,
    latMax: 37,
    dx: 1,
    dy: 1,
  },
  time: {
    tmfc: '2026051800',
    hf: 3,
    validTime: '2026-05-18T03:00:00.000Z',
  },
  u: [0, 1000, 2000, 3000],
  v: [0, 0, 1000, 1000],
}

test('decodeWindComponent applies int16 scale and offset', () => {
  assert.equal(decodeWindComponent(1234, FIELD), 12.34)
})

test('createWindFieldSampler returns 2x2 bilinear interpolation results', () => {
  const sampler = createWindFieldSampler(FIELD)
  const vector = sampler.sample(126.5, 36.5)

  assert.equal(vector.u, 15)
  assert.equal(vector.v, 5)
  assert.equal(Number(vector.speed.toFixed(3)), 15.811)
})

test('createWindFieldSampler returns null outside the grid', () => {
  const sampler = createWindFieldSampler(FIELD)

  assert.equal(sampler.sample(125.99, 36.5), null)
  assert.equal(sampler.sample(126.5, 37.01), null)
})

test('createWindFieldSampler samples exact max bounds when dx/dy are rounded', () => {
  const field = {
    encoding: 'int16-scaled-json-v1',
    scale: 0.01,
    offset: 0,
    grid: {
      nx: 205,
      ny: 169,
      lonMin: 119,
      latMin: 30,
      lonMax: 136,
      latMax: 44,
      dx: 0.083333,
      dy: 0.083333,
    },
    u: Array.from({ length: 205 * 169 }, (_, index) => index),
    v: Array.from({ length: 205 * 169 }, () => 0),
  }
  const sampler = createWindFieldSampler(field)

  assert.equal(sampler.sample(136, 44).u, (205 * 169 - 1) * 0.01)
})

test('createDownsampledWindField keeps bounds and samples a coarser grid', () => {
  const source = {
    encoding: 'int16-scaled-json-v1',
    scale: 1,
    offset: 0,
    grid: {
      nx: 5,
      ny: 5,
      lonMin: 126,
      latMin: 36,
      lonMax: 130,
      latMax: 40,
      dx: 1,
      dy: 1,
    },
    u: Array.from({ length: 25 }, (_, index) => index),
    v: Array.from({ length: 25 }, () => 0),
  }

  const downsampled = createDownsampledWindField(source, 2)

  assert.equal(downsampled.encoding, undefined)
  assert.deepEqual(downsampled.grid, {
    nx: 3,
    ny: 3,
    lonMin: 126,
    latMin: 36,
    lonMax: 130,
    latMax: 40,
    dx: 2,
    dy: 2,
  })
  assert.deepEqual(downsampled.u, [0, 2, 4, 10, 12, 14, 20, 22, 24])
  assert.deepEqual(downsampled.v, [0, 0, 0, 0, 0, 0, 0, 0, 0])
})

test('wind speed ramp keeps fixed thresholds with kt display labels', () => {
  assert.equal(WIND_SPEED_COLOR_RAMP.length, 7)
  assert.equal(pickWindSpeedColor(1).label, '0-4 kt')
  assert.equal(pickWindSpeedColor(23).label, '43+ kt')
})

test('interpolateWindSpeedColor only blends near speed bin boundaries', () => {
  assert.equal(interpolateWindSpeedColor(0), 'rgba(0, 126, 255, 0.38)')
  assert.equal(interpolateWindSpeedColor(1), 'rgba(0, 126, 255, 0.38)')
  assert.equal(interpolateWindSpeedColor(2), 'rgba(0, 173, 210, 0.38)')
  assert.equal(interpolateWindSpeedColor(2.25), 'rgba(0, 202, 182, 0.38)')
  assert.equal(interpolateWindSpeedColor(2.4), 'rgba(0, 220, 165, 0.38)')
  assert.equal(interpolateWindSpeedColor(3.5), 'rgba(0, 220, 165, 0.38)')
  assert.equal(interpolateWindSpeedColor(23), 'rgba(224, 4, 176, 0.38)')
  assert.equal(interpolateWindSpeedColor(24), 'rgba(222, 0, 190, 0.38)')
})

test('formatKimWindMetaLabel renders a compact model height and valid time label', () => {
  assert.equal(formatKimWindMetaLabel(FIELD), 'KIM 8km · 10m · 05/18 12:00 KST')
})
