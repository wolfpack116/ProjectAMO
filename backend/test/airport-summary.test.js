import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ceilingFromClouds, summarizeAirport } from '../src/briefing/airport-summary.js'

test('ceilingFromClouds: lowest BKN/OVC base', () => {
  assert.equal(ceilingFromClouds([{amount:'FEW',base:1000},{amount:'BKN',base:800},{amount:'OVC',base:1500}]), 800)
})
test('ceilingFromClouds: no BKN/OVC -> null', () => {
  assert.equal(ceilingFromClouds([{amount:'FEW',base:1000},{amount:'SCT',base:2000}]), null)
})

const metarRkpc = {
  header: { icao: 'RKPC' },
  observation: {
    wind: { raw: '14025G35KT', direction: 140, speed: 25, gust: 35 },
    visibility: { value: 3000, cavok: false },
    clouds: [{ amount: 'BKN', base: 800, raw: 'BKN008' }],
    weather: [{ raw: '-RA' }],
    temperature: { air: 14, dewpoint: 12 },
    qnh: { value: 1009 },
    display: { wind: '14025G35KT', clouds: 'BKN008', temperature: '14/12', qnh: 'Q1009' },
  },
  cavok_flag: false,
}

test('summarizeAirport: RKPC arrival is IFR/red with flagged fields', () => {
  const s = summarizeAirport('arrival', metarRkpc)
  assert.equal(s.icao, 'RKPC')
  assert.equal(s.category, 'IFR')
  assert.equal(s.level, 'red')
  assert.equal(s.fields.visibility.flag, true)
  assert.equal(s.fields.ceiling.flag, true)
  assert.equal(s.fields.wind.flag, true)
  assert.equal(s.fields.qnh.flag, false)
})

test('summarizeAirport: matrix formats (wind kt, vis km, temp ℃, gust)', () => {
  const s = summarizeAirport('arrival', metarRkpc)
  assert.equal(s.fields.wind.text, '140/25kt')
  assert.equal(s.fields.wind.gust, 35)
  assert.equal(s.fields.visibility.text, '3.0km')
  assert.equal(s.fields.temp.text, '14/12℃')
  assert.equal(s.reportType, null) // header.report_type 없으면 null
})

test('summarizeAirport: CAVOK-ish vis ≥10km', () => {
  const s = summarizeAirport('departure', { header: { icao: 'RKSI' }, observation: { ...metarRkpc.observation, visibility: { value: 9999, cavok: true }, wind: { direction: 270, speed: 8, calm: false } } })
  assert.equal(s.fields.visibility.text, '≥10km')
  assert.equal(s.fields.wind.text, '270/08kt')
})

test('summarizeAirport: missing METAR -> unknown', () => {
  const s = summarizeAirport('alternate', null)
  assert.equal(s.category, 'UNKNOWN')
  assert.equal(s.level, 'gray')
})
