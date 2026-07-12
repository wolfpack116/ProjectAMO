import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeEtaIso } from './etaCalc.js'

test('computeEtaIso adds distance/speed hours to ETD', () => {
  // 180nm / 120kt = 1.5h
  assert.equal(
    computeEtaIso('2026-06-26T09:00:00Z', 180, 120),
    '2026-06-26T10:30:00Z',
  )
})
test('computeEtaIso returns null on bad input', () => {
  assert.equal(computeEtaIso('2026-06-26T09:00:00Z', 0, 0), null)
  assert.equal(computeEtaIso('nope', 180, 120), null)
})
