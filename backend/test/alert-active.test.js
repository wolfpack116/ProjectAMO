import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickActiveFlight } from '../src/me/alerts.js'

// 고정 기준시각(2026-07-08 09:00Z)
const NOW = Date.parse('2026-07-08T09:00:00Z')
const iso = (h) => new Date(NOW + h * 3600 * 1000).toISOString()

test('pickActiveFlight: 감시창(ETD-2h) 안 비행만 후보', () => {
  const flights = [
    { id: 1, etd: iso(1), alertStartMinBeforeEtd: 120 },   // ETD 1h 뒤 → 창 안(시작 -1h)
    { id: 2, etd: iso(5), alertStartMinBeforeEtd: 120 },   // ETD 5h 뒤 → 아직 창 밖
  ]
  assert.equal(pickActiveFlight(flights, NOW).id, 1)
})

test('pickActiveFlight: 겹치면 가장 임박한 것', () => {
  const flights = [
    { id: 1, etd: iso(1.5), alertStartMinBeforeEtd: 360 }, // 6h창
    { id: 2, etd: iso(0.5), alertStartMinBeforeEtd: 360 }, // 더 임박
  ]
  assert.equal(pickActiveFlight(flights, NOW).id, 2)
})

test('pickActiveFlight: ETD 지난 것은 제외(창 종료=ETD)', () => {
  const flights = [{ id: 1, etd: iso(-0.5), alertStartMinBeforeEtd: 120 }] // 30분 전 출발
  assert.equal(pickActiveFlight(flights, NOW), null)
})

test('pickActiveFlight: 창 진입 전이면 null', () => {
  const flights = [{ id: 1, etd: iso(4), alertStartMinBeforeEtd: 120 }] // 시작은 ETD-2h=2h 뒤
  assert.equal(pickActiveFlight(flights, NOW), null)
})
