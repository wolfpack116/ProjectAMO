import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectTafAtEta, alternateRequired } from '../src/briefing/taf-window.js'

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
