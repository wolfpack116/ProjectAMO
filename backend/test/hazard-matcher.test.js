import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyEncounter } from '../src/briefing/hazard-matcher.js'

const ctx = { totalDistanceNm: 200, cruiseAltitudeFt: 9000 }

test('on: planned altitude overlaps band over interval', () => {
  const r = classifyEncounter({ startNm: 40, endNm: 90, bandFt: { lowFt: 8000, highFt: 14000 } }, ctx)
  assert.equal(r.encounter, 'on')
  assert.equal(r.verticalKnown, true)
})
test('nearby: band entirely above planned altitude', () => {
  const r = classifyEncounter({ startNm: 40, endNm: 90, bandFt: { lowFt: 20000, highFt: 30000 } }, ctx)
  assert.equal(r.encounter, 'nearby')
  assert.equal(r.verticalKnown, true)
})
test('nearby + verticalKnown false when band null', () => {
  const r = classifyEncounter({ startNm: 40, endNm: 90, bandFt: null }, ctx)
  assert.equal(r.encounter, 'nearby')
  assert.equal(r.verticalKnown, false)
})
