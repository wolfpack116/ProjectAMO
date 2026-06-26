import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeEnrouteModel } from '../src/briefing/enroute-model.js'

// 2개 KIM 기압면(8000/10000ft), 거리 0/50/100NM. cruise 9000, total 100 → alt(50)=9000.
const crossSection = { levels: [
  { altFt: 8000, values: [
    { distanceNm: 0, icing: 0, u: 0, v: 0, t: 10 },
    { distanceNm: 50, icing: 1, u: 3, v: 4, t: 5 },
    { distanceNm: 100, icing: 0, u: 0, v: 0, t: 8 },
  ] },
  { altFt: 10000, values: [
    { distanceNm: 0, icing: 0, u: 0, v: 0, t: 8 },
    { distanceNm: 50, icing: 0, u: 30, v: 40, t: 3 },
    { distanceNm: 100, icing: 0, u: 0, v: 0, t: 6 },
  ] },
] }
const turbulence = { levels: [
  { altFt: 3000, values: [ { distanceNm: 0, ktg: 0.1 }, { distanceNm: 50, ktg: 0.4 }, { distanceNm: 100, ktg: 0.1 } ] },
  { altFt: 9000, values: [ { distanceNm: 0, ktg: 0.1 }, { distanceNm: 50, ktg: 0.5 }, { distanceNm: 100, ktg: 0.1 } ] },
] }
const ctx = { crossSection, turbulence, totalDistanceNm: 100, cruiseAltitudeFt: 9000 }

test('icing interval where grade>=1 at planned altitude', () => {
  const r = summarizeEnrouteModel(ctx)
  const ice = r.elements.find((e) => e.kind === 'icing')
  assert.ok(ice)
  assert.deepEqual(ice.intervals, [{ startNm: 50, endNm: 50, level: '약' }])
})

test('turbulence interval flags severe at cruise', () => {
  const r = summarizeEnrouteModel(ctx)
  const turb = r.elements.find((e) => e.kind === 'turbulence')
  assert.ok(turb)
  assert.equal(turb.intervals[0].level, '심')   // 0.5 EDR → severe
  assert.equal(turb.intervals[0].startNm, 50)
})

test('wind max and temp min at planned altitude', () => {
  const r = summarizeEnrouteModel(ctx)
  const wind = r.elements.find((e) => e.kind === 'wind')
  const temp = r.elements.find((e) => e.kind === 'temp')
  assert.equal(wind.atNm, 50)
  assert.ok(wind.valueKt >= 50 && wind.valueKt <= 56) // interp of 9.7kt and 97kt at mid → ~53.5kt
  assert.equal(temp.valueC, 4) // interp of 5 and 3
})

test('no model data -> empty elements', () => {
  const r = summarizeEnrouteModel({ crossSection: null, turbulence: null, totalDistanceNm: 100, cruiseAltitudeFt: 9000 })
  assert.deepEqual(r.elements, [])
})

test('KTG outside its altitude coverage is ignored (high cruise)', () => {
  // cruise 35000 → planned altitude above KTG top (9000ft) everywhere near cruise → no turbulence interval
  const r = summarizeEnrouteModel({ ...ctx, cruiseAltitudeFt: 35000, totalDistanceNm: 300 })
  const turb = r.elements.find((e) => e.kind === 'turbulence')
  assert.equal(turb, undefined)
})
