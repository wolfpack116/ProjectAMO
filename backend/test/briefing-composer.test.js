import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeBriefing } from '../src/briefing/briefing-composer.js'

const request = {
  flightRule: 'IFR',
  departureAirport: 'RKSI', arrivalAirport: 'RKPC', alternateAirport: 'RKPK',
  routeGeometry: { type:'LineString', coordinates: [[126.45,37.46],[126.5,33.5]] },
  etd: '2026-06-26T09:00:00Z', eta: '2026-06-26T10:30:00Z', plannedCruiseAltitudeFt: 9000,
}

const goodObs = (cat) => ({
  observation: cat === 'VFR'
    ? { wind:{raw:'27008KT',speed:8}, visibility:{value:9999}, clouds:[{amount:'FEW',base:3000}], weather:[], temperature:{air:18,dewpoint:9}, qnh:{value:1018}, display:{wind:'27008KT',clouds:'FEW030',temperature:'18/09',qnh:'Q1018',weather:'-'} }
    : { wind:{raw:'14025G35KT',speed:25,gust:35}, visibility:{value:3000}, clouds:[{amount:'BKN',base:800}], weather:[{raw:'-RA'}], temperature:{air:14,dewpoint:12}, qnh:{value:1009}, display:{wind:'14025G35KT',clouds:'BKN008',temperature:'14/12',qnh:'Q1009',weather:'-RA'} },
})
const data = {
  metar: { airports: { RKSI: { header:{icao:'RKSI'}, ...goodObs('VFR') }, RKPC: { header:{icao:'RKPC'}, ...goodObs('IFR') }, RKPK: { header:{icao:'RKPK'}, ...goodObs('VFR') } } },
  taf: { airports: { RKPC: { header:{icao:'RKPC'}, timeline:[{ time:'2026-06-26T10:00:00Z', visibility:{value:3000}, clouds:[{amount:'BKN',base:600,raw:'BKN006'}], display:{wind:'14020KT',clouds:'BKN006'} }] } } },
  sigmet: { items: [{ id:'s1', phenomenon_code:'SEV_ICE', phenomenon_label:'Severe Icing', valid_from:'2026-06-26T08:00:00Z', valid_to:'2026-06-26T14:00:00Z', geometry:{type:'Polygon',coordinates:[[[125,32],[128,32],[128,35],[125,35],[125,32]]]}, altitude:{lower_fl:60,upper_fl:120,lower_uom:'FL',upper_uom:'FL'} }] },
  airmet: { items: [] },
}

test('composeBriefing returns meta, summary, sections', () => {
  const b = composeBriefing(request, data)
  assert.equal(b.meta.departureAirport, 'RKSI')
  assert.equal(b.sections.adverse.hazards.length, 1)
  assert.equal(b.sections.current.airports.length, 3)
  const dep = b.sections.current.airports.find((a) => a.role === 'departure')
  assert.equal(dep.category, 'VFR')
  assert.equal(b.sections.destination.taf.category, 'IFR')
  assert.equal(b.sections.destination.alternateRequired, true)
})

test('summary board has hazard + 3 airports', () => {
  const b = composeBriefing(request, data)
  const keys = b.summary.map((s) => s.key)
  assert.deepEqual(keys, ['hazard', 'RKSI', 'RKPC', 'RKPK'])
  assert.equal(b.summary.find((s) => s.key === 'hazard').level, 'red')
})

test('banner: worst airport (3-level) + per-airport chain', () => {
  const b = composeBriefing(request, data)
  assert.equal(b.banner.worst.icao, 'RKPC')
  assert.equal(b.banner.worst.category, 'IFR') // IFR stays IFR under 3-level fold
  assert.equal(b.banner.airports.length, 3)
  assert.deepEqual(b.banner.airports.map((a) => a.category), ['VFR', 'IFR', 'VFR'])
})

test('takeoffFcst attaches to airports from data.takeoff_fcst', () => {
  const withTk = { ...data, takeoff_fcst: { airports: { RKSI: { icao: 'RKSI', forecasts: [{ time: '2026-06-26T09:00:00Z', windDir: 270, windSpeedKt: 12, tempC: 18, qnhHpa: 1013 }] } } } }
  const b = composeBriefing(request, withTk)
  const dep = b.sections.current.airports.find((a) => a.role === 'departure')
  assert.equal(dep.takeoffFcst.forecasts.length, 1)
  assert.equal(dep.takeoffFcst.forecasts[0].qnhHpa, 1013)
  const arr = b.sections.current.airports.find((a) => a.role === 'arrival')
  assert.equal(arr.takeoffFcst, null) // RKPC는 이륙예보 없음
})

test('airport warnings merge into adverse (scope + level), sorted, not in enroute encounters', () => {
  const withWarn = {
    ...data,
    warning: { airports: { RKPC: { warnings: [
      { wrng_type_key: 'WIND_SHEAR', wrng_type_name: 'Wind Shear', valid_start: '2026-06-26T09:00:00Z', valid_end: '2026-06-26T11:00:00Z' },
    ] } } },
  }
  const b = composeBriefing(request, withWarn)
  const ws = b.sections.adverse.hazards.find((h) => h.airportScope === 'RKPC')
  assert.ok(ws, 'airport warning present in adverse')
  assert.equal(ws.code, 'WIND_SHEAR')
  assert.equal(ws.level, 'red')
  assert.equal(ws.role, 'arrival')
  // 공항경보는 경로 조우가 아니므로 enroute encounters 미포함
  assert.equal(b.sections.enroute.encounters.some((h) => h.airportScope), false)
})

test('airport warning outside ETD~ETA window is excluded', () => {
  const withWarn = {
    ...data,
    warning: { airports: { RKPC: { warnings: [
      { wrng_type_key: 'WIND_SHEAR', wrng_type_name: 'Wind Shear', valid_start: '2026-06-27T00:00:00Z', valid_end: '2026-06-27T02:00:00Z' },
    ] } } },
  }
  const b = composeBriefing(request, withWarn)
  assert.equal(b.sections.adverse.hazards.some((h) => h.airportScope), false)
})

test('alternate omitted when null', () => {
  const b = composeBriefing({ ...request, alternateAirport: null }, data)
  assert.equal(b.sections.current.airports.length, 2)
})

test('enroute section reflects 3D encounters', () => {
  const b = composeBriefing(request, data)
  assert.ok(b.sections.enroute)
  assert.equal(b.sections.enroute.plannedCruiseAltitudeFt, 9000)
  assert.equal(b.sections.enroute.crossSectionAvailable, true)
  const onCount = b.sections.adverse.hazards.filter((h) => h.encounter === 'on').length
  assert.equal(b.sections.enroute.encounters.length, onCount)
  assert.equal(onCount, 1) // icing FL060-120 ∩ cruise 9000 → 조우
})
