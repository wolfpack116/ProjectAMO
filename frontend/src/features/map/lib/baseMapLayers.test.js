import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldShowGeoBoundaries } from './baseMapLayers.js'

test('geo boundaries show on dark basemap and raster weather overlays', () => {
  assert.equal(shouldShowGeoBoundaries({ basemapId: 'dark', metVisibility: {} }), true)
  assert.equal(shouldShowGeoBoundaries({ basemapId: 'standard', metVisibility: { radar: true } }), true)
  assert.equal(shouldShowGeoBoundaries({ basemapId: 'standard', metVisibility: { satellite: true } }), true)
  assert.equal(shouldShowGeoBoundaries({ basemapId: 'standard', metVisibility: {} }), false)
})

test('geo boundaries show on every basemap when NWP overlays are active', () => {
  for (const layerId of ['wind', 'temp', 'cloud', 'icing']) {
    assert.equal(
      shouldShowGeoBoundaries({ basemapId: 'standard', metVisibility: { [layerId]: true } }),
      true,
    )
    assert.equal(
      shouldShowGeoBoundaries({ basemapId: 'satellite', metVisibility: { [layerId]: true } }),
      true,
    )
  }
})

test('geo boundaries ignore NWP toggles when NWP overlays are disabled', () => {
  assert.equal(
    shouldShowGeoBoundaries({
      basemapId: 'standard',
      enableWindOverlay: false,
      metVisibility: { wind: true, temp: true, cloud: true, icing: true },
    }),
    false,
  )
})
