import assert from 'node:assert/strict'
import test from 'node:test'

import config from '../src/config.js'

test('ADS-B collection runs hourly to avoid repeated upstream failures', () => {
  assert.equal(config.schedule.adsb_interval, '0 * * * *')
})
