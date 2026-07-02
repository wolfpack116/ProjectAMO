import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAltitude, stepAltitude, vfrCruiseHint, initialBearingDeg, nearestVfrCruiseAltitude } from './altitude.js'

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

test('nearestVfrCruiseAltitude snaps to direction-correct odd/even+500', () => {
  // 동쪽(90°): 홀수천+500. 9,000 → 9,500
  assert.equal(nearestVfrCruiseAltitude(9000, 90), 9500)
  // 서쪽(270°): 짝수천+500. 9,000 → 8,500
  assert.equal(nearestVfrCruiseAltitude(9000, 270), 8500)
  // 이미 준수하면 그대로
  assert.equal(nearestVfrCruiseAltitude(9500, 90), 9500)
  assert.equal(nearestVfrCruiseAltitude(8500, 270), 8500)
  // 5,000 동쪽 → 5,500 / 서쪽 → 4,500
  assert.equal(nearestVfrCruiseAltitude(5000, 90), 5500)
  assert.equal(nearestVfrCruiseAltitude(5000, 270), 4500)
})
