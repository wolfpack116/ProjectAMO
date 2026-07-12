import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEtdIso, etdFields, formatBriefingTime } from './briefingTime.js'

test('buildEtdIso interprets wall-clock as UTC when tz=UTC', () => {
  assert.equal(buildEtdIso({ year: 2026, month: 6, day: 27, hour: 11, minute: 50 }, 'UTC'), '2026-06-27T11:50:00Z')
})
test('buildEtdIso interprets wall-clock as KST (UTC+9) when tz=KST', () => {
  // 11:50 KST == 02:50 UTC
  assert.equal(buildEtdIso({ year: 2026, month: 6, day: 27, hour: 11, minute: 50 }, 'KST'), '2026-06-27T02:50:00Z')
})
test('etdFields round-trips an ISO instant back to tz wall-clock', () => {
  assert.deepEqual(etdFields('2026-06-27T02:50:00Z', 'KST'), { year: 2026, month: 6, day: 27, hour: 11, minute: 50 })
  assert.deepEqual(etdFields('2026-06-27T11:50:00Z', 'UTC'), { year: 2026, month: 6, day: 27, hour: 11, minute: 50 })
})
test('formatBriefingTime renders compact tz label', () => {
  assert.equal(formatBriefingTime('2026-06-27T11:50:00Z', 'UTC'), '11:50Z')
  assert.equal(formatBriefingTime('2026-06-27T02:50:00Z', 'KST'), '11:50 KST')
  assert.equal(formatBriefingTime('2026-06-27T11:50:00Z', 'UTC', { withDate: true }), '06-27 11:50Z')
})
test('formatBriefingTime returns dash on invalid input', () => {
  assert.equal(formatBriefingTime(null, 'UTC'), '—')
  assert.equal(formatBriefingTime('nope', 'KST'), '—')
})
