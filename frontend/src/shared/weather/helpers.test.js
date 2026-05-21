import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  hasHighWindCondition,
  hasPrecipitationWeather,
  hasSpecialWeather,
} from './helpers.js'

describe('shared weather condition helpers', () => {
  it('detects precipitation weather tokens and ignores NSW', () => {
    assert.equal(hasPrecipitationWeather({ display: { weather: 'RA' } }), true)
    assert.equal(hasPrecipitationWeather({ display: { weather: '-DZ BR' } }), true)
    assert.equal(hasPrecipitationWeather({ display: { weather: 'SHRA' } }), true)
    assert.equal(hasPrecipitationWeather({ display: { weather: 'NSW' } }), false)
    assert.equal(hasPrecipitationWeather({ display: { weather: 'FG' } }), false)
  })

  it('detects special weather used for dashed alert styling', () => {
    assert.equal(hasSpecialWeather({ display: { weather: 'TSRA' } }), true)
    assert.equal(hasSpecialWeather({ display: { weather: 'FG' } }), true)
    assert.equal(hasSpecialWeather({ display: { weather: '-SN' } }), true)
    assert.equal(hasSpecialWeather({ display: { weather: 'BR' } }), false)
    assert.equal(hasSpecialWeather({ display: { weather: 'NSW' } }), false)
  })

  it('detects high wind by sustained speed or gust threshold', () => {
    assert.equal(hasHighWindCondition({ speed: 25, gust: null }), true)
    assert.equal(hasHighWindCondition({ speed: 10, gust: 35 }), true)
    assert.equal(hasHighWindCondition({ speed: 24, gust: 34 }), false)
    assert.equal(hasHighWindCondition({ calm: true, speed: 40, gust: 50 }), false)
  })
})
