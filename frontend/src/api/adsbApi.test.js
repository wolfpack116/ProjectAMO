import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchAdsbData } from './adsbApi.js'

test('fetchAdsbData treats missing optional ADS-B data as empty without console error', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error
  const errors = []

  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
  })
  console.error = (...args) => errors.push(args)

  try {
    const data = await fetchAdsbData()
    assert.equal(data, null)
    assert.deepEqual(errors, [])
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
  }
})
