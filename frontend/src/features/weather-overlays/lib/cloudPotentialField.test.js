import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CLOUD_POTENTIAL_COLOR_RAMP,
  decodeCloudPotentialValue,
  decodeSpreadValue,
  pickCloudPotentialColor,
} from './cloudPotentialField.js'

const FIELD = {
  encoding: 'int16-scaled-json-v1',
  scale: 0.01,
  offset: 0,
}

test('decodes spread and cloud potential sentinel values', () => {
  assert.equal(decodeSpreadValue(250, FIELD), 2.5)
  assert.equal(decodeSpreadValue(-32768, FIELD), null)
  assert.equal(decodeCloudPotentialValue(10000, FIELD), 100)
  assert.equal(decodeCloudPotentialValue(-32768, FIELD), null)
})

test('cloud potential ramp marks moist areas green by dewpoint spread and dry areas transparent', () => {
  assert.equal(CLOUD_POTENTIAL_COLOR_RAMP[0].label, '0-1C')
  assert.match(CLOUD_POTENTIAL_COLOR_RAMP[0].color, /^rgba\(/)
  assert.equal(pickCloudPotentialColor(0.5, { level: { id: '700hPa' } }).alpha > pickCloudPotentialColor(3.5, { level: { id: '700hPa' } }).alpha, true)
  assert.equal(pickCloudPotentialColor(4.5, { level: { id: '700hPa' } }).alpha, 0)
  assert.equal(pickCloudPotentialColor(5.5, { level: { id: '500hPa' } }).alpha > 0, true)
})
