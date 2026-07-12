import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeBriefing } from '../src/briefing/briefing-composer.js'

const poly = { type:'Polygon', coordinates: [[[125,32],[128,32],[128,35],[125,35],[125,32]]] }
const request = {
  flightRule:'IFR', departureAirport:'RKSI', arrivalAirport:'RKPC', alternateAirport:'RKPK',
  routeGeometry:{ type:'LineString', coordinates:[[126.45,37.46],[126.5,33.5]] },
  etd:'2026-06-26T09:00:00Z', eta:'2026-06-26T10:30:00Z', plannedCruiseAltitudeFt:9000,
}
const obs = { observation:{ wind:{raw:'27008KT',speed:8}, visibility:{value:9999}, clouds:[{amount:'FEW',base:3000}], weather:[], temperature:{air:18,dewpoint:9}, qnh:{value:1018}, display:{wind:'27008KT',clouds:'FEW030',temperature:'18/09',qnh:'Q1018',weather:'-'} } }
const data = {
  metar:{ airports:{ RKSI:{header:{icao:'RKSI'},...obs}, RKPC:{header:{icao:'RKPC'},...obs}, RKPK:{header:{icao:'RKPK'},...obs} } },
  taf:{ airports:{} },
  sigmet:{ items:[
    { id:'on', phenomenon_code:'SEV_ICE', phenomenon_label:'Severe Icing', valid_from:'2026-06-26T08:00:00Z', valid_to:'2026-06-26T14:00:00Z', geometry:poly, altitude:{lower_fl:60,upper_fl:120,lower_uom:'FL',upper_uom:'FL'} },
    { id:'near', phenomenon_code:'SEV_TURB', phenomenon_label:'Severe Turbulence', valid_from:'2026-06-26T08:00:00Z', valid_to:'2026-06-26T14:00:00Z', geometry:poly, altitude:{lower_fl:300,upper_fl:400,lower_uom:'FL',upper_uom:'FL'} },
  ] },
  airmet:{ items:[] },
}

test('integration: 3D briefing payload is internally consistent', () => {
  const b = composeBriefing(request, data)
  assert.equal(b.sections.adverse.hazards.length, 2)
  const enc = b.sections.adverse.hazards.find((h) => h.code === 'SEV_ICE')
  const near = b.sections.adverse.hazards.find((h) => h.code === 'SEV_TURB')
  assert.equal(enc.encounter, 'on')
  assert.equal(near.encounter, 'nearby')
  assert.equal(b.sections.adverse.level, 'red')
  assert.equal(b.sections.enroute.encounters.length, 1)
  assert.equal(b.sections.enroute.encounters[0].code, 'SEV_ICE')
  assert.equal(b.sections.enroute.plannedCruiseAltitudeFt, 9000)
  assert.equal(b.sections.current.airports.length, 3)
})
