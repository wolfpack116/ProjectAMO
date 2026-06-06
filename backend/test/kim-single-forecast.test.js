import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCollectedForecastHours } from '../src/processors/kim-surface-wind-processor.js'

test('single_forecast reduces to one nearest-future hf', () => {
  const hours = resolveCollectedForecastHours({
    tmfc: '2026060600',
    nowMs: Date.UTC(2026, 5, 6, 5),
    candidateHours: [0, 3, 6, 9, 12],
    single: true,
  })
  assert.deepEqual(hours, [6])
})

test('single_forecast=false keeps full candidate set', () => {
  const hours = resolveCollectedForecastHours({
    tmfc: '2026060600',
    nowMs: Date.UTC(2026, 5, 6, 5),
    candidateHours: [0, 3, 6],
    single: false,
  })
  assert.deepEqual(hours, [0, 3, 6])
})
