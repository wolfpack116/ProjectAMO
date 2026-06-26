import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHazardSection } from '../src/briefing/hazard-section.js'

const onRoutePoly = { type:'Polygon', coordinates: [[[125,32],[128,32],[128,35],[125,35],[125,32]]] }
const offRoutePoly = { type:'Polygon', coordinates: [[[100,10],[101,10],[101,11],[100,11],[100,10]]] }
const route = { type:'LineString', coordinates: [[126.45,37.46],[126.5,33.5]] }

const sigmet = [
  { id:'s1', phenomenon_code:'SEV_ICE', phenomenon_label:'Severe Icing', valid_from:'2026-06-26T08:00:00Z', valid_to:'2026-06-26T14:00:00Z', geometry:onRoutePoly },
  { id:'s2', phenomenon_code:'TC', phenomenon_label:'Tropical Cyclone', valid_from:'2026-06-26T08:00:00Z', valid_to:'2026-06-26T14:00:00Z', geometry:offRoutePoly },
]

test('buildHazardSection keeps on-route + time-overlapping hazards', () => {
  const sec = buildHazardSection({ sigmet, airmet: [], routeGeometry: route, etd:'2026-06-26T09:00:00Z', eta:'2026-06-26T10:30:00Z' })
  const codes = sec.hazards.map((h) => h.code)
  assert.deepEqual(codes, ['SEV_ICE'])
  assert.equal(sec.hazards[0].source, 'SIGMET')
  assert.equal(sec.level, 'red')
})

test('buildHazardSection drops time-disjoint hazards', () => {
  const sec = buildHazardSection({ sigmet, airmet: [], routeGeometry: route, etd:'2026-06-26T15:00:00Z', eta:'2026-06-26T16:00:00Z' })
  assert.equal(sec.hazards.length, 0)
  assert.equal(sec.level, 'green')
})

test('AIRMET classified amber, SIGMET red', () => {
  const airmet = [{ id:'a1', phenomenon_code:'MOD_TURB', phenomenon_label:'Moderate Turbulence', valid_from:'2026-06-26T08:00:00Z', valid_to:'2026-06-26T14:00:00Z', geometry:onRoutePoly }]
  const sec = buildHazardSection({ sigmet: [], airmet, routeGeometry: route, etd:'2026-06-26T09:00:00Z', eta:'2026-06-26T10:30:00Z' })
  assert.equal(sec.hazards[0].source, 'AIRMET')
  assert.equal(sec.level, 'amber')
})
