import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildMetarViewModel } from './metarViewModel.js'

const baseMetar = {
  header: { observation_time: '2026-05-21T10:00:00Z' },
  observation: {
    cavok: false,
    display: { weather: 'TSRA', visibility: '3000', qnh: 'Q1008' },
    visibility: { value: 3000 },
    wind: { direction: 250, speed: 12, gust: 36, unit: 'KT' },
    clouds: [{ amount: 'BKN', base: 1200 }],
    temperature: { air: 19, dewpoint: 17 },
  },
}

describe('airport METAR view model weather highlighting', () => {
  it('exposes precipitation and special-weather flags for current weather card', () => {
    const model = buildMetarViewModel({
      metar: baseMetar,
      amosData: { daily_rainfall: { mm: 2.9 } },
      icao: 'RKSI',
      airportMeta: { runway_hdg: 150 },
    })

    assert.equal(model.precipitationWeather, true)
    assert.equal(model.specialWeather, true)
    assert.equal(model.highWind, true)
    assert.equal(model.weatherKorean, '뇌우')
    assert.equal(model.qnh, '1008 hPa')
    assert.equal(model.rainText, '2.9 mm')
  })

  it('does not mark mist as special or precipitation weather', () => {
    const model = buildMetarViewModel({
      metar: {
        ...baseMetar,
        observation: {
          ...baseMetar.observation,
          display: { ...baseMetar.observation.display, weather: 'BR' },
          weather: [],
        },
      },
      amosData: null,
      icao: 'RKSI',
      airportMeta: { runway_hdg: 150 },
    })

    assert.equal(model.precipitationWeather, false)
    assert.equal(model.specialWeather, false)
  })
})
