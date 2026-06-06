import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectNearestForecastHour } from '../src/processors/kim-forecast-hour.js'

test('picks the smallest valid time at or after now', () => {
  const tmfc = '2026060600'
  const nowMs = Date.UTC(2026, 5, 6, 5) // 05:00Z — run+5h, nearest future = hf6
  assert.equal(selectNearestForecastHour({ tmfc, nowMs, candidateHours: [0, 3, 6, 9] }), 6)
})

test('falls back to last candidate when now is past all valid times', () => {
  const tmfc = '2026060600'
  const nowMs = Date.UTC(2026, 5, 7, 0) // +24h, beyond [0..9]
  assert.equal(selectNearestForecastHour({ tmfc, nowMs, candidateHours: [0, 3, 6, 9] }), 9)
})

test('returns first candidate when run is in the future', () => {
  const tmfc = '2026060612'
  const nowMs = Date.UTC(2026, 5, 6, 6) // before run
  assert.equal(selectNearestForecastHour({ tmfc, nowMs, candidateHours: [0, 3, 6] }), 0)
})
