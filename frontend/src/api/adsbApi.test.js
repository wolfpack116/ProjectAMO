import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchAdsbData } from './adsbApi.js'

test('fetchAdsbData is temporarily disabled without calling the ADS-B API', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error
  const errors = []
  let called = false

  globalThis.fetch = async () => {
    called = true
    return { ok: false, status: 503 }
  }
  console.error = (...args) => errors.push(args)

  try {
    const data = await fetchAdsbData()
    assert.equal(data, null)
    assert.equal(called, false)
    assert.deepEqual(errors, [])
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
  }
})
