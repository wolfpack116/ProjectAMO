import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uvToWind, altitudeAtDistance, pickColumns, buildRawWindsTable } from './rawWindsModel.js'

test('uvToWind: westerly (from 270) — u<0,v=0', () => {
  // 서풍(270에서 불어옴)은 동쪽으로 이동 → u>0, v=0. 반대로 u<0,v=0 = 동풍(090).
  const w = uvToWind(-10, 0)
  assert.equal(w.dir, '090')
  assert.equal(w.speedKt, Math.round(10 * 1.94384))
})
test('uvToWind: south wind (from 180) — v>0', () => {
  const w = uvToWind(0, 10) // v>0 = 남쪽으로 이동 → 북풍? met dir = atan2(0,-10)=180 → from 180
  assert.equal(w.dir, '180')
})
test('uvToWind: null on non-finite', () => {
  assert.equal(uvToWind(null, 3), null)
})

test('altitudeAtDistance: linear interpolation', () => {
  const pts = [{ distanceNm: 0, altitudeFt: 0 }, { distanceNm: 10, altitudeFt: 10000 }]
  assert.equal(altitudeAtDistance(pts, 5), 5000)
  assert.equal(altitudeAtDistance(pts, -1), 0) // clamp low
  assert.equal(altitudeAtDistance(pts, 20), 10000) // clamp high
})

test('pickColumns: keeps first+last when capping', () => {
  const ms = Array.from({ length: 12 }, (_, i) => ({ label: `W${i}`, distanceNm: i }))
  const cols = pickColumns(ms, 5)
  assert.equal(cols.length, 5)
  assert.equal(cols[0].label, 'W0')
  assert.equal(cols[4].label, 'W11')
})

test('buildRawWindsTable: rows/cols + route-altitude highlight (diagonal)', () => {
  const crossSection = {
    levels: [
      { altFt: 10000, values: [{ distanceNm: 0, t: -5, u: 5, v: 0 }, { distanceNm: 100, t: -6, u: 6, v: 0 }] },
      { altFt: 30000, values: [{ distanceNm: 0, t: -40, u: 20, v: 0 }, { distanceNm: 100, t: -42, u: 22, v: 0 }] },
    ],
  }
  const verticalProfile = {
    markers: [{ label: 'DEP', distanceNm: 0 }, { label: 'ARR', distanceNm: 100 }],
    flightPlan: { profile: { points: [{ distanceNm: 0, altitudeFt: 1000 }, { distanceNm: 100, altitudeFt: 30000 }] } },
  }
  const t = buildRawWindsTable(crossSection, verticalProfile)
  assert.equal(t.columns.length, 2)
  assert.equal(t.rows.length, 2)
  // DEP(alt~1000) → 최근접 10000 층(row0), ARR(alt 30000) → row1
  assert.equal(t.rows[0].cells[0].highlight, true)
  assert.equal(t.rows[1].cells[1].highlight, true)
  assert.equal(t.rows[0].cells[1].highlight, false)
  assert.equal(t.rows[0].fl, 'FL100')
  assert.equal(t.rows[1].fl, 'FL300')
})

test('buildRawWindsTable: null when no data', () => {
  assert.equal(buildRawWindsTable(null, null), null)
  assert.equal(buildRawWindsTable({ levels: [] }, { markers: [] }), null)
})
