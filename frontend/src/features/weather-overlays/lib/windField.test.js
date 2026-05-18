import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WIND_SPEED_COLOR_RAMP,
  createWindFieldSampler,
  decodeWindComponent,
  formatKimWindMetaLabel,
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

test('wind speed ramp uses fixed m/s bins rather than field min/max', () => {
  assert.equal(WIND_SPEED_COLOR_RAMP.length, 7)
  assert.equal(pickWindSpeedColor(1).label, '0-2 m/s')
  assert.equal(pickWindSpeedColor(23).label, '22+ m/s')
})

test('formatKimWindMetaLabel renders a compact model height and valid time label', () => {
  assert.equal(formatKimWindMetaLabel(FIELD), 'KIM 8km · 10m · 05/18 12:00 KST')
})
