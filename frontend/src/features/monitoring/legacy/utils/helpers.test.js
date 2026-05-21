import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  hasHighWindCondition,
  hasPrecipitationWeather,
  hasSpecialWeather,
} from './helpers.js'

describe('monitoring legacy weather helper compatibility', () => {
  it('delegates precipitation semantics used by Airport panel', () => {
    assert.equal(hasPrecipitationWeather({ display: { weather: 'RA' } }), true)
    assert.equal(hasPrecipitationWeather({ display: { weather: 'SHRA' } }), true)
    assert.equal(hasPrecipitationWeather({ display: { weather: 'FG' } }), false)
  })

  it('exposes shared special-weather semantics for monitoring components', () => {
    assert.equal(hasSpecialWeather({ display: { weather: 'TSRA' } }), true)
    assert.equal(hasSpecialWeather({ display: { weather: 'FG' } }), true)
    assert.equal(hasSpecialWeather({ display: { weather: '-SN' } }), true)
    assert.equal(hasSpecialWeather({ display: { weather: 'BR' } }), false)
  })

  it('keeps high-wind display thresholds unchanged', () => {
    assert.equal(hasHighWindCondition({ speed: 25 }), true)
    assert.equal(hasHighWindCondition({ gust: 35 }), true)
    assert.equal(hasHighWindCondition({ speed: 24, gust: 34 }), false)
  })
})
