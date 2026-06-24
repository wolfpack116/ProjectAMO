import assert from 'node:assert/strict'
import test from 'node:test'

import { buildInitialCollectionJobs } from '../src/index.js'

test('ADS-B collection runs in the initial collection jobs', () => {
  assert.equal(
    buildInitialCollectionJobs().some(([type]) => type === 'adsb'),
    true,
  )
})
