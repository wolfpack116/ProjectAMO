import { test } from 'node:test'
import assert from 'node:assert/strict'

import { detectChanges, effectiveMinima } from '../src/alerts/diff.js'

const plan = { minima: { ceilingFt: 500, visibilityM: 1600 } } // IFR 조종사 선

const normalDest = { icao: 'RKPC', ceilingFt: 3000, visibilityM: 9999, alternateRequired: false }
const lowCeilDest = { icao: 'RKPC', ceilingFt: 400, visibilityM: 9999, alternateRequired: false }

test('detectChanges: 목적지 운고 미니마 하락 → CEIL 1건(400<500 → CRITICAL)', () => {
  const changes = detectChanges({ dest: normalDest }, { dest: lowCeilDest }, plan)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].type, 'CEIL')
  assert.equal(changes[0].target, 'RKPC')
  assert.equal(changes[0].severity, 'CRITICAL')
})

test('detectChanges: 무변경 → 0건', () => {
  assert.equal(detectChanges({ dest: normalDest }, { dest: { ...normalDest } }, plan).length, 0)
})

test('detectChanges: 이미 나쁜 상태 지속(prev도 선 아래) → 0건(재발화 억제)', () => {
  assert.equal(detectChanges({ dest: lowCeilDest }, { dest: { ...lowCeilDest } }, plan).length, 0)
})

test('detectChanges: 미니마 미설정 → VFR 프리셋(운고 1000) 적용', () => {
  const m = effectiveMinima(null)
  assert.equal(m.ceilingFt, 1000)
  const dest = { icao: 'RKPC', ceilingFt: 800, visibilityM: 9999, alternateRequired: false } // 800<1000
  const changes = detectChanges({ dest: normalDest }, { dest }, {})
  assert.equal(changes.length, 1)
  assert.equal(changes[0].severity, 'HIGH') // 800>500 → CRITICAL 아님
})

test('detectChanges: 교체공항 필요 플립 → ALTERNATE_FLIP', () => {
  const changes = detectChanges(
    { dest: { ...normalDest, alternateRequired: false } },
    { dest: { ...normalDest, alternateRequired: true } },
    plan,
  )
  assert.equal(changes.length, 1)
  assert.equal(changes[0].type, 'ALTERNATE_FLIP')
})

test('detectChanges: 신규 SIGMET → ENROUTE_HAZARD HIGH, 같은 key 재발행 → 0건', () => {
  const h = [{ key: 'WSKR31-3', isSigmet: true, convective: true, label: 'TS' }]
  const added = detectChanges({ hazards: [] }, { hazards: h }, plan)
  assert.equal(added.length, 1)
  assert.equal(added[0].type, 'ENROUTE_HAZARD')
  assert.equal(added[0].severity, 'HIGH')
  assert.equal(detectChanges({ hazards: h }, { hazards: [...h] }, plan).length, 0)
})

test('detectChanges: 엔루트 착빙 severe(심) 상승 → ENROUTE_ICE_TURB', () => {
  const changes = detectChanges({ enroute: { icing: '중' } }, { enroute: { icing: '심' } }, plan)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].type, 'ENROUTE_ICE_TURB')
  assert.equal(changes[0].target, 'icing')
})

test('detectChanges: 출발 TS 신규 → WX', () => {
  const changes = detectChanges({ dep: { icao: 'RKSI', ts: false } }, { dep: { icao: 'RKSI', ts: true } }, plan)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].type, 'WX')
  assert.equal(changes[0].to, 'TS')
})
