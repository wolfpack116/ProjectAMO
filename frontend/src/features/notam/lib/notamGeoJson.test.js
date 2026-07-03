import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notamToFeatureCollection } from './notamGeoJson.js'

const now = Date.parse('2026-07-03T06:00:00Z')
const base = {
  fetched_at: '2026-07-03T06:00:00Z', horizon_hours: 24,
  items: [
    { id: 'G1/26', category: 'restricted', scope: 'airport', location: 'RKSI',
      valid_from: '2026-07-03T00:00:00Z', valid_to: '2026-07-03T12:00:00Z',
      altitude: { lower: 0, upper: 999, unit: 'FL', ref: null }, summary: 'GPS RAIM',
      geometry: { type: 'Polygon', coordinates: [[[126,37],[127,37],[127,38],[126,38],[126,37]]] } },
    { id: 'D9/26', category: 'danger', scope: 'fir', location: 'RKRR',
      valid_from: '2026-07-03T00:00:00Z', valid_to: '2026-07-04T00:00:00Z',
      altitude: null, summary: 'FIR-wide', geometry: { type: 'Polygon', coordinates: [[[124,33],[132,33],[132,39],[124,39],[124,33]]] } },
    { id: 'A2/26', category: 'facility', scope: 'airport', location: 'RKSS',
      valid_from: '2026-07-03T00:00:00Z', valid_to: '2026-07-03T12:00:00Z',
      altitude: null, summary: 'no geom', geometry: null },
    { id: 'L5/26', category: 'danger', scope: 'airport', location: 'RKPC',
      valid_from: '2026-07-03T00:00:00Z', valid_to: '2026-07-03T12:00:00Z',
      altitude: null, summary: 'corridor', geometry: { type: 'LineString', coordinates: [[126,35],[127,36]] } },
  ],
}

test('excludes scope:fir and null-geometry items', () => {
  const fc = notamToFeatureCollection(base, now)
  assert.equal(fc.type, 'FeatureCollection')
  const ids = fc.features.map((f) => f.properties.id)
  assert.ok(!ids.includes('D9/26'), 'FIR scope excluded from map')
  assert.ok(!ids.includes('A2/26'), 'null-geometry excluded')
})

test('keeps LineString geometry (map/tab exposure; only briefing-matching excludes it)', () => {
  const fc = notamToFeatureCollection(base, now)
  const line = fc.features.find((f) => f.properties.id === 'L5/26')
  assert.ok(line, 'LineString NOTAM survives GeoJSON conversion')
  assert.equal(line.geometry.type, 'LineString')
})

test('feature carries category + precomputed timeState + formatted altitude', () => {
  const f = notamToFeatureCollection(base, now).features.find((x) => x.properties.id === 'G1/26')
  assert.equal(f.properties.category, 'restricted')
  assert.equal(f.properties.timeState, 'active')
  assert.equal(f.properties.altitude, '전고도')
  assert.equal(f.geometry.type, 'Polygon')
})

test('empty / missing payload → empty collection', () => {
  assert.deepEqual(notamToFeatureCollection(null, now).features, [])
  assert.deepEqual(notamToFeatureCollection({ items: [] }, now).features, [])
})
