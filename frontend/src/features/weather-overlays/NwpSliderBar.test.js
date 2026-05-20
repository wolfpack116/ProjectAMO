import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatNwpTimeTick,
  getNwpSliderOptions,
  shouldCommitNwpSelection,
} from './NwpSliderBarModel.js'

const levels = [
  { id: '10m', label: '10m' },
  { id: '925hPa', label: '925' },
]

const times = [
  { hf: 0, validTime: '2026-05-19T12:00:00.000Z' },
  { hf: 2, validTime: '2026-05-19T14:00:00.000Z' },
  { hf: 6, validTime: '2026-05-19T18:00:00.000Z' },
]

test('formatNwpTimeTick shows date on first tick and date changes only', () => {
  assert.equal(formatNwpTimeTick(times[0]), '05/19 21:00')
  assert.equal(formatNwpTimeTick(times[1], times[0]), '23:00')
  assert.equal(formatNwpTimeTick(times[2], times[1]), '05/20 03:00')
})

test('getNwpSliderOptions keeps level slider visible with one future time', () => {
  const options = getNwpSliderOptions({
    levels,
    times: times.slice(0, 1),
    selection: { tmfc: '2026051912', level: '10m', hf: 0 },
    availability: {
      '10m': { 0: {} },
      '925hPa': { 0: {} },
    },
  })

  assert.equal(options.showTimeSlider, false)
  assert.equal(options.showLevelSlider, true)
  assert.deepEqual(options.availableLevels.map((level) => level.id), ['10m', '925hPa'])
})

test('NWP slider commits selection on final interaction events', () => {
  assert.equal(shouldCommitNwpSelection('input'), false)
  assert.equal(shouldCommitNwpSelection('pointermove'), false)
  assert.equal(shouldCommitNwpSelection('change'), true)
  assert.equal(shouldCommitNwpSelection('pointerup'), true)
  assert.equal(shouldCommitNwpSelection('keyup'), true)
  assert.equal(shouldCommitNwpSelection('blur'), true)
})
