import assert from 'node:assert/strict'
import test from 'node:test'

import { buildInitialCollectionJobs } from '../src/index.js'

test('ADS-B is not scheduled — it is collected on demand by the /api/adsb route', () => {
  assert.equal(
    buildInitialCollectionJobs().some(([type]) => type === 'adsb'),
    false,
  )
})
