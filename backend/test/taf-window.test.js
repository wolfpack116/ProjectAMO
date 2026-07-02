import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectTafAtEta, alternateRequired, buildDestination } from '../src/briefing/taf-window.js'

const taf = {
  header: { icao: 'RKPC' },
  timeline: [
    { time: '2026-06-26T09:00:00Z', visibility:{value:9999,cavok:false}, clouds:[{amount:'SCT',base:3000,raw:'SCT030'}], display:{wind:'18010KT',clouds:'SCT030'} },
    { time: '2026-06-26T10:00:00Z', visibility:{value:3000,cavok:false}, clouds:[{amount:'BKN',base:600,raw:'BKN006'}], display:{wind:'14020KT',clouds:'BKN006'} },
    { time: '2026-06-26T11:00:00Z', visibility:{value:9999,cavok:false}, clouds:[{amount:'SCT',base:2000,raw:'SCT020'}], display:{wind:'18010KT',clouds:'SCT020'} },
  ],
}

test('selectTafAtEta picks the timeline entry nearest ETA', () => {
  const e = selectTafAtEta(taf, '2026-06-26T10:05:00Z')
  assert.equal(e.time, '2026-06-26T10:00:00Z')
  assert.equal(e.category, 'IFR')
})

test('alternateRequired true when ETA window breaches 2000ft/5000m', () => {
  const r = alternateRequired(taf, '2026-06-26T10:05:00Z')
  assert.equal(r.required, true)
})

test('alternateRequired false when ETA window is good', () => {
  const r = alternateRequired(taf, '2026-06-26T09:00:00Z')
  assert.equal(r.required, false)
})

test('selectTafAtEta returns null when no TAF', () => {
  assert.equal(selectTafAtEta(null, '2026-06-26T10:00:00Z'), null)
})

const richTaf = {
  header: { icao: 'RKPC', issued: '2026-06-26T05:00:00Z', valid_start: '2026-06-26T06:00:00Z', valid_end: '2026-06-27T12:00:00Z' },
  base: { wind: { direction: 70, speed: 8, calm: false }, vis: 9999, cavok_flag: false, clouds: [{ amount: 'SCT', base: 3000, raw: 'SCT030' }], wx: [] },
  change_groups: [
    { type: 'TEMPO', start: '2026-06-26T08:00:00Z', end: '2026-06-26T12:00:00Z', wind: null, vis: 3200, cavok_flag: false, clouds_touched: true, clouds: [{ amount: 'BKN', base: 800, raw: 'BKN008' }], wx_touched: true, wx: [{ raw: '-RA' }] },
  ],
  timeline: taf.timeline,
}

test('buildDestination: periods (base+TEMPO), categories, timeline, raw, alternate', () => {
  const altTaf = { header: { icao: 'RKPU', valid_start: '2026-06-26T06:00:00Z', valid_end: '2026-06-27T12:00:00Z' }, timeline: [
    { time: '2026-06-26T11:00:00Z', visibility: { value: 9999, cavok: false }, clouds: [{ amount: 'SCT', base: 4000 }] },
  ] }
  const d = buildDestination(richTaf, '2026-06-26T10:00:00Z', { alternateTaf: altTaf, flightRule: 'IFR' })
  assert.equal(d.icao, 'RKPC')
  assert.equal(d.periods.length, 2)
  assert.equal(d.periods[0].type, 'base')
  assert.equal(d.periods[0].category, 'VFR')
  assert.equal(d.periods[1].type, 'TEMPO')
  assert.equal(d.periods[1].category, 'IFR') // vis 3200 → IFR, ceiling 800 → IFR
  assert.equal(d.periods[1].vis, '3.2km')
  assert.ok(d.timeline.length === 3)
  assert.ok(d.raw.startsWith('TAF RKPC'))
  assert.equal(d.alternate.icao, 'RKPU')
  assert.equal(d.alternate.category, 'VFR')
})
