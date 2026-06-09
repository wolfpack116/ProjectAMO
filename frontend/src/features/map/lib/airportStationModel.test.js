import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AIRPORT_CATEGORY_COLORS,
  AIRPORT_CATEGORY_UNKNOWN_COLOR,
  buildAirportStationMarkerModel,
} from './airportStationModel.js'

function buildMetar(overrides = {}) {
  return {
    header: {
      observation_time: '2026-06-07T03:00:00Z',
      issue_time: '2026-06-07T03:00:00Z',
    },
    observation: {
      wind: {
        direction: 40,
        speed: 8,
        gust: null,
        calm: false,
        variable: false,
      },
      visibility: {
        value: 9999,
        cavok: false,
      },
      weather: [],
      clouds: [],
      display: {
        clouds: 'NSC',
        weather_icon: 'NSW',
      },
      ...overrides,
    },
  }
}

test('buildAirportStationMarkerModel returns VFR clear marker with no ceiling weather or wind surprises', () => {
  const model = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      visibility: { value: 9999, cavok: true },
      display: { clouds: 'NSC', weather_icon: 'CAVOK' },
    }),
  })

  assert.equal(model.flightCategory, 'VFR')
  assert.equal(model.categoryColor, AIRPORT_CATEGORY_COLORS.VFR)
  assert.equal(model.skyCover, 'clear')
  assert.equal(model.stationIconId, 'airport-station-vfr-clear')
  assert.equal(model.visibilityText, '9999')
  assert.equal(model.ceilingText, '')
  assert.equal(model.weatherIconId, '')
  assert.equal(model.windIconId, 'airport-wind-010')
  assert.equal(model.windDirection, 40)
})

test('buildAirportStationMarkerModel returns IFR from low visibility and LIFR from airport minima', () => {
  const ifrModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      visibility: { value: 4000, cavok: false },
    }),
  })
  const lifrModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKPC' },
    metar: buildMetar({
      visibility: { value: 250, cavok: false },
    }),
  })

  assert.equal(ifrModel.flightCategory, 'IFR')
  assert.equal(ifrModel.categoryColor, AIRPORT_CATEGORY_COLORS.IFR)
  assert.equal(ifrModel.stationIconId, 'airport-station-ifr-clear')
  assert.equal(lifrModel.flightCategory, 'LIFR')
  assert.equal(lifrModel.categoryColor, AIRPORT_CATEGORY_COLORS.LIFR)
  assert.equal(lifrModel.stationIconId, 'airport-station-lifr-clear')
})

test('FEW and SCT clouds affect sky cover but do not create ceiling text', () => {
  const fewModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      clouds: [{ amount: 'FEW', base: 1500, raw: 'FEW015' }],
      display: { clouds: 'FEW015', weather_icon: 'NSW' },
    }),
  })
  const sctModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      clouds: [{ amount: 'SCT', base: 1000, raw: 'SCT010' }],
      display: { clouds: 'SCT010', weather_icon: 'NSW' },
    }),
  })

  assert.equal(fewModel.skyCover, 'few')
  assert.equal(fewModel.ceilingText, '')
  assert.equal(sctModel.skyCover, 'sct')
  assert.equal(sctModel.ceilingText, '')
})

test('BKN, OVC, and VV clouds create ceiling text using the lowest ceiling layer', () => {
  const model = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      clouds: [
        { amount: 'VV', base: 1200, raw: 'VV012' },
        { amount: 'BKN', base: 600, raw: 'BKN006' },
        { amount: 'OVC', base: 2500, raw: 'OVC025' },
      ],
      display: { clouds: 'VV012 BKN006 OVC025', weather_icon: 'NSW' },
    }),
  })

  assert.equal(model.skyCover, 'ovc')
  assert.equal(model.ceilingText, '006')
  assert.equal(model.flightCategory, 'IFR')
})

test('present weather and reduced-visibility weather produce weather icons, but clear/cloud fallback visuals do not', () => {
  const rainModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      weather: [{ phenomena: ['RA'] }],
      display: { clouds: 'BKN030', weather_icon: 'RA' },
    }),
  })
  const mistModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      weather: [{ phenomena: ['BR'] }],
      display: { clouds: 'SCT030', weather_icon: 'BR' },
    }),
  })
  const clearModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      display: { clouds: 'NSC', weather_icon: 'CAVOK' },
    }),
  })

  assert.equal(rainModel.weatherIconId, 'airport-wx-rain')
  assert.equal(mistModel.weatherIconId, 'airport-wx-mist')
  assert.equal(clearModel.weatherIconId, '')
})

test('NSW and cloud-only fallback visuals do not produce map weather icons', () => {
  const nswModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      clouds: [{ amount: 'BKN', base: 3000, raw: 'BKN030' }],
      display: { clouds: 'BKN030', weather_icon: 'NSW' },
    }),
  })

  assert.equal(nswModel.weatherIconId, '')
})

test('fog qualifiers still produce weather icons on the map', () => {
  const model = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      weather: [{ descriptor: 'MI', phenomena: ['FG'] }],
      display: { clouds: 'SCT002', weather_icon: 'MIFG' },
    }),
  })

  assert.equal(model.weatherIconId, 'airport-wx-fog')
})

test('calm wind produces no wind barb; low-speed non-calm uses minimum 5kt bucket', () => {
  const calmModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      wind: { calm: true, speed: 0, direction: null, variable: false },
    }),
  })
  const tinyWindModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      wind: { calm: false, speed: 2, direction: 120, variable: false },
    }),
  })

  assert.equal(calmModel.windIconId, '')
  assert.equal(calmModel.windDirection, null)
  assert.equal(tinyWindModel.windIconId, 'airport-wind-005')
  assert.equal(tinyWindModel.windDirection, 120)
})

test('wind buckets round to the nearest five knots and cap at sixty', () => {
  const lightModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      wind: { calm: false, speed: 6, direction: 130, variable: false },
    }),
  })
  const strongModel = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      wind: { calm: false, speed: 68, direction: 250, variable: false },
    }),
  })

  assert.equal(lightModel.windIconId, 'airport-wind-005')
  assert.equal(lightModel.windDirection, 130)
  assert.equal(strongModel.windIconId, 'airport-wind-060')
  assert.equal(strongModel.windDirection, 250)
})

test('missing visibility and ceiling fall back to an unknown station marker color', () => {
  const model = buildAirportStationMarkerModel({
    airport: { icao: 'RKSI' },
    metar: buildMetar({
      visibility: { value: null, cavok: false },
      clouds: [],
      display: { clouds: '', weather_icon: '' },
      wind: { calm: true, speed: 0, direction: null, variable: false },
    }),
  })

  assert.equal(model.flightCategory, 'UNKNOWN')
  assert.equal(model.categoryColor, AIRPORT_CATEGORY_UNKNOWN_COLOR)
  assert.equal(model.stationIconId, 'airport-station-unknown-clear')
})
