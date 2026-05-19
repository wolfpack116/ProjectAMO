import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CELSIUS_TEMPERATURE_COLOR_RAMP,
  decodeTemperatureValue,
  kelvinToCelsius,
  pickTemperatureColor,
  createTemperatureFieldSampler,
} from './temperatureField.js'

const FIELD = {
  encoding: 'int16-scaled-json-v1',
  scale: 0.01,
  offset: 0,
  grid: { nx: 2, ny: 2, lonMin: 126, latMin: 36, lonMax: 127, latMax: 37, dx: 1, dy: 1 },
  T: [27315, 26315, -32768, 30315],
}

test('kelvinToCelsius converts backend Kelvin values for display', () => {
  assert.equal(kelvinToCelsius(273.15), 0)
  assert.equal(kelvinToCelsius(263.15), -10)
})

test('decodeTemperatureValue converts int16 sentinel to null', () => {
  assert.equal(decodeTemperatureValue(27315, FIELD), 273.15)
  assert.equal(decodeTemperatureValue(-32768, FIELD), null)
})

test('temperature color ramp is fixed in Celsius and emphasizes the freezing boundary', () => {
  assert.deepEqual(CELSIUS_TEMPERATURE_COLOR_RAMP.map((entry) => entry.label), [
    '<= -20 C',
    '-20 to -10 C',
    '-10 to 0 C',
    '0 to 10 C',
    '10 to 20 C',
    '20 to 30 C',
    '30 to 40 C',
    '>= 40 C',
  ])
  assert.notEqual(pickTemperatureColor(-3).color, pickTemperatureColor(3).color)
})

test('temperature color ramp interpolates within each Celsius band', () => {
  assert.notEqual(pickTemperatureColor(11).color, pickTemperatureColor(19).color)
})

test('temperature sampler returns null for missing cells', () => {
  const sampler = createTemperatureFieldSampler(FIELD)
  assert.equal(sampler.sample(126, 37), null)
  assert.equal(sampler.sample(127, 36), -10)
})
