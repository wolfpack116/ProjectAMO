import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCeilingFt, parseFloorFt, zoneAltitude, loadAirspaceZoneItems } from '../src/briefing/airspace-zones.js'

test('parseCeilingFt: numeric with AMSL ref', () => {
  assert.deepEqual(parseCeilingFt('6 000 AMSL'), { value: 6000, ref: 'AMSL' })
})

test('parseCeilingFt: numeric with AGL ref', () => {
  assert.deepEqual(parseCeilingFt('3 000 AGL'), { value: 3000, ref: 'AGL' })
})

test('parseCeilingFt: UNL → no ceiling', () => {
  assert.deepEqual(parseCeilingFt('UNL'), { value: null, ref: null })
})

test('parseFloorFt: GND/SFC → 0', () => {
  assert.equal(parseFloorFt('GND'), 0)
  assert.equal(parseFloorFt('SFC'), 0)
})

test('parseFloorFt: numeric floor', () => {
  assert.equal(parseFloorFt('2 000 AMSL'), 2000)
})

test('zoneAltitude: combines ceiling + floor into notamBandToFt-compatible shape', () => {
  assert.deepEqual(zoneAltitude('6 000 AMSL', 'GND'), { lower: 0, upper: 6000, unit: 'FT', ref: 'AMSL' })
  assert.deepEqual(zoneAltitude('UNL', 'GND'), { lower: 0, upper: null, unit: 'FT', ref: null })
})

test('loadAirspaceZoneItems: reads real data files, returns NOTAM-shaped items with permanent validity', () => {
  const items = loadAirspaceZoneItems()
  assert.ok(items.length > 100, `expected many zones across restricted/prohibited/danger, got ${items.length}`)
  const categories = new Set(items.map((i) => i.category))
  assert.deepEqual([...categories].sort(), ['danger', 'prohibited', 'restricted'])
  for (const it of items) {
    assert.ok(it.id)
    assert.ok(it.geometry)
    assert.ok(it.valid_from && it.valid_to)
    assert.equal(it.altitude.unit, 'FT')
  }
})

test('loadAirspaceZoneItems: id is the plain zone code, not an internal composite (readable in briefing UI)', () => {
  const items = loadAirspaceZoneItems()
  const r1 = items.find((i) => i.category === 'restricted' && i.id === 'R1')
  assert.ok(r1, 'R1 should be present with id exactly "R1", not "zone-restricted-R1-<idx>"')
})

test('loadAirspaceZoneItems: zones with no altitude data at all (e.g. restricted R14) are excluded', () => {
  // R14는 원본 차트 추출 데이터 자체에 상한·하한이 둘 다 없음(res_lbl_2/3 = null) — 실제 NOTAM의
  // "미상 밴드"와 달리 우리 쪽 정적 데이터 결손이라, 매번 근거 없는 저촉 경보를 띄우는 대신 제외한다.
  const items = loadAirspaceZoneItems()
  assert.equal(items.find((i) => i.id === 'R14'), undefined)
})
