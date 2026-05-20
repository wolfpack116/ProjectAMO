import assert from 'node:assert/strict'
import test from 'node:test'

import { getNextMetVisibility } from './metLayerVisibility.js'

test('getNextMetVisibility makes wind and temp mutually exclusive', () => {
  assert.deepEqual(
    getNextMetVisibility(
      { wind: false, temp: true, cloud: false, windFlow: true, windSpeed: false },
      'wind',
      { lowPower: false },
    ),
    { wind: true, temp: false, cloud: false, windFlow: true, windSpeed: true },
  )

  assert.deepEqual(
    getNextMetVisibility(
      { wind: true, temp: false, cloud: false, windFlow: true, windSpeed: true },
      'temp',
      { lowPower: false },
    ),
    { wind: false, temp: true, cloud: false, windFlow: false, windSpeed: true },
  )

  assert.deepEqual(
    getNextMetVisibility(
      { wind: true, temp: false, cloud: false, windFlow: true, windSpeed: true },
      'cloud',
      { lowPower: false },
    ),
    { wind: false, temp: false, cloud: true, windFlow: false, windSpeed: true },
  )
})

test('getNextMetVisibility keeps wind flow off in low power mode', () => {
  assert.equal(
    getNextMetVisibility(
      { wind: false, temp: false, windFlow: false, windSpeed: false },
      'wind',
      { lowPower: true },
    ).windFlow,
    false,
  )
})
