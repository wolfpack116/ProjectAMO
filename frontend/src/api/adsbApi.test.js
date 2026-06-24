import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchAdsbData } from './adsbApi.js'

test('fetchAdsbData fetches /api/adsb and returns the payload', async () => {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => ({ type: 'adsb', aircraft: [] }) }
  }

  try {
    const data = await fetchAdsbData()
    assert.deepEqual(calls, ['/api/adsb'])
    assert.deepEqual(data, { type: 'adsb', aircraft: [] })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchAdsbData returns null when the backend has no snapshot (503)', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({ ok: false, status: 503 })

  try {
    const data = await fetchAdsbData()
    assert.equal(data, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
