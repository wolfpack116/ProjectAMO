import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAltitude, stepAltitude, vfrCruiseHint, initialBearingDeg } from './altitude.js'

test('formatAltitude shows feet below transition, FL at/above', () => {
  assert.equal(formatAltitude(9000), '9,000 ft')
  assert.equal(formatAltitude(13500), '13,500 ft')
  assert.equal(formatAltitude(14000), 'FL140')
  assert.equal(formatAltitude(18000), 'FL180')
})

test('stepAltitude snaps to 500-ft grid and clamps at 0', () => {
  assert.equal(stepAltitude(9000, 1), 9500)
  assert.equal(stepAltitude(9000, -1), 8500)
  assert.equal(stepAltitude(9200, 1), 9500)
  assert.equal(stepAltitude(0, -1), 0)
})

test('vfrCruiseHint picks odd/even by magnetic course', () => {
  assert.match(vfrCruiseHint(90), /홀수/)
  assert.match(vfrCruiseHint(200), /짝수/)
})

test('initialBearingDeg is ~south for RKSS -> RKPC', () => {
  const b = initialBearingDeg(37.55, 126.79, 33.51, 126.49)
  assert.ok(b > 175 && b < 190, `expected ~south, got ${b}`)
})
