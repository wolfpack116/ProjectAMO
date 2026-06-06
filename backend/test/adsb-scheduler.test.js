import assert from 'node:assert/strict'
import test from 'node:test'

import { buildInitialCollectionJobs } from '../src/index.js'

test('ADS-B collection is temporarily disabled', () => {
  assert.equal(
    buildInitialCollectionJobs().some(([type]) => type === 'adsb'),
    false,
  )
})
