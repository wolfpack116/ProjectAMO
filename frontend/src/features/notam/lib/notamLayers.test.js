import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notamsAtPoint, geometryBounds } from './notamLayers.js'

const ALL = ['restricted', 'danger', 'other']
// 사각형 면: Polygon 과 '닫힌 LineString'(KOCA가 면을 선으로 인코딩) 두 형태
const square = [[126, 36], [127, 36], [127, 37], [126, 37], [126, 36]]
const feats = [
  { properties: { id: 'POLY/26', category: 'restricted' }, geometry: { type: 'Polygon', coordinates: [square] } },
  { properties: { id: 'CLOSEDLINE/26', category: 'danger' }, geometry: { type: 'LineString', coordinates: square } },
  { properties: { id: 'CORRIDOR/26', category: 'restricted' }, geometry: { type: 'LineString', coordinates: [[120, 33], [121, 34]] } },
]

test('notamsAtPoint: point inside Polygon matches', () => {
  const hits = notamsAtPoint(feats, 126.5, 36.5, ALL).map((f) => f.properties.id)
  assert.ok(hits.includes('POLY/26'))
})

test('notamsAtPoint: point inside CLOSED LineString matches (면으로 인코딩된 구역)', () => {
  const hits = notamsAtPoint(feats, 126.5, 36.5, ALL).map((f) => f.properties.id)
  assert.ok(hits.includes('CLOSEDLINE/26'), '닫힌 LineString도 내부 클릭 잡혀야 함')
})

test('notamsAtPoint: open LineString(회랑) is not an area — no interior match', () => {
  const hits = notamsAtPoint(feats, 126.5, 36.5, ALL).map((f) => f.properties.id)
  assert.ok(!hits.includes('CORRIDOR/26'))
})

test('notamsAtPoint: point outside all → empty', () => {
  assert.deepEqual(notamsAtPoint(feats, 100, 10, ALL), [])
})

test('notamsAtPoint: category filter excludes unchecked', () => {
  const hits = notamsAtPoint(feats, 126.5, 36.5, ['restricted']).map((f) => f.properties.id)
  assert.ok(hits.includes('POLY/26'))
  assert.ok(!hits.includes('CLOSEDLINE/26')) // danger 제외됨
})

test('geometryBounds: closed LineString bounds', () => {
  const b = geometryBounds({ type: 'LineString', coordinates: square })
  assert.deepEqual(b, [[126, 36], [127, 37]])
})
