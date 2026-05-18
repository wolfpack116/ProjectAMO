import test from 'node:test'
import assert from 'node:assert/strict'

import { fetchKimSurfaceWind } from './weatherApi.js'

test('fetchKimSurfaceWind falls back to XMLHttpRequest when fetch is unavailable', async () => {
  const originalFetch = globalThis.fetch
  const originalXhr = globalThis.XMLHttpRequest

  globalThis.fetch = undefined
  globalThis.XMLHttpRequest = class {
    open(method, url) {
      this.method = method
      this.url = url
    }

    send() {
      this.status = 200
      this.responseText = JSON.stringify({ type: 'kim_surface_wind' })
      this.onload()
    }
  }

  try {
    const data = await fetchKimSurfaceWind()
    assert.equal(data.type, 'kim_surface_wind')
  } finally {
    globalThis.fetch = originalFetch
    globalThis.XMLHttpRequest = originalXhr
  }
})
