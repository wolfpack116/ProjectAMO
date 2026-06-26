import { test } from 'node:test'
import assert from 'node:assert/strict'
import { altitudeAtDistanceFt, plannedAltitudeRangeFt, bandToFt } from '../src/briefing/planned-altitude.js'

test('altitudeAtDistanceFt: climbs, cruises, descends', () => {
  const total = 200, cruise = 9000
  assert.equal(altitudeAtDistanceFt(0, total, cruise), 0)
  assert.equal(altitudeAtDistanceFt(15, total, cruise), 9000)   // 15nm*600=9000 → cruise
  assert.equal(altitudeAtDistanceFt(100, total, cruise), 9000)  // mid cruise
  assert.equal(altitudeAtDistanceFt(200, total, cruise), 0)     // arrival
  assert.equal(altitudeAtDistanceFt(190, total, cruise), 3000)  // (200-190)*300
})

test('altitudeAtDistanceFt: short route peaks below cruise', () => {
  const a = altitudeAtDistanceFt(5, 10, 9000)
  assert.ok(a < 9000 && a > 0)
})

test('plannedAltitudeRangeFt over an interval returns [min,max]', () => {
  const r = plannedAltitudeRangeFt(40, 90, 200, 9000)
  assert.equal(r.maxFt, 9000)
  assert.ok(r.minFt <= 9000)
})

test('bandToFt: FL units -> ft', () => {
  assert.deepEqual(bandToFt({ lower_fl: 80, upper_fl: 140, lower_uom: 'FL', upper_uom: 'FL' }), { lowFt: 8000, highFt: 14000 })
})
test('bandToFt: null limits -> surface/high fallback', () => {
  const b = bandToFt({ lower_fl: null, upper_fl: 100, lower_uom: null, upper_uom: 'FL' })
  assert.equal(b.lowFt, 0)
  assert.equal(b.highFt, 10000)
})
test('bandToFt: both null -> null', () => {
  assert.equal(bandToFt({ lower_fl: null, upper_fl: null }), null)
  assert.equal(bandToFt(null), null)
})
