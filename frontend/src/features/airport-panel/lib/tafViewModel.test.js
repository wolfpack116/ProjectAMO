import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildTafViewModel, formatTafHour, groupTafSlots } from './tafViewModel.js'

function futureSlot(offsetHours, weather, overrides = {}) {
  return {
    time: new Date(Date.now() + offsetHours * 3600 * 1000).toISOString(),
    display: { weather, visibility: '9999' },
    visibility: { value: 9999 },
    wind: { direction: 180, speed: 8, unit: 'KT' },
    clouds: [{ amount: 'BKN', base: 2500 }],
    ...overrides,
  }
}

describe('airport TAF view model weather highlighting', () => {
  it('exposes precipitation and special-weather flags per slot', () => {
    const taf = {
      header: { valid_start: '2026-05-21T06:00:00Z', valid_end: '2026-05-22T12:00:00Z' },
      timeline: [
        futureSlot(2, 'RA'),
        futureSlot(3, 'FG'),
        futureSlot(4, 'NSW'),
      ],
    }

    const model = buildTafViewModel(taf, 'RKSI')

    assert.deepEqual(model.slots.map((slot) => slot.hasPrecipitation), [true, false, false])
    assert.deepEqual(model.slots.map((slot) => slot.isSpecialWeather), [false, true, false])
  })

  it('keeps contiguous group width calculation unchanged', () => {
    const groups = groupTafSlots(
      [{ key: 'A' }, { key: 'A' }, { key: 'B' }, { key: 'A' }],
      (item) => item.key,
    )

    assert.deepEqual(groups.map((group) => group.key), ['A', 'B', 'A'])
    assert.deepEqual(groups.map((group) => group.width), ['50%', '25%', '25%'])
  })

  it('formats invalid TAF hour safely', () => {
    assert.equal(formatTafHour('bad-date'), '--')
  })
})
