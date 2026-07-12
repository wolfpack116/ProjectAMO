import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAltitude, stepAltitude, vfrCruiseHint, initialBearingDeg, nearestVfrCruiseAltitude, minVfrCruiseAltitude } from './altitude.js'

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

test('minVfrCruiseAltitude: 기준선 이상 중 가장 낮은 규정 고도로 올림(가까운 값 아님)', () => {
  // 최고지형 2,314ft + 1,000ft 마진 = 3,314ft 이상 필요.
  // 동쪽: 3,500(홀수+500 중 최소). 서쪽: 4,500(짝수+500 시작값, 3,314보다 이미 큼).
  assert.equal(minVfrCruiseAltitude(3314, 90), 3500)
  assert.equal(minVfrCruiseAltitude(3314, 270), 4500)
  // 6,200ft 이상 필요: 동쪽 7,500(5,500은 미달), 서쪽 6,500.
  assert.equal(minVfrCruiseAltitude(6200, 90), 7500)
  assert.equal(minVfrCruiseAltitude(6200, 270), 6500)
  // 정확히 규정 고도와 일치하면 그대로(불필요하게 올리지 않음).
  assert.equal(minVfrCruiseAltitude(5500, 90), 5500)
  assert.equal(minVfrCruiseAltitude(6500, 270), 6500)
})
