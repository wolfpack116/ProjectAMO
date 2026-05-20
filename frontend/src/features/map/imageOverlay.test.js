import test from 'node:test'
import assert from 'node:assert/strict'

import { addOrUpdateImageOverlay } from './imageOverlay.js'

function createMap() {
  const sources = new Map()
  const layers = new Map()
  const addSourceCalls = []
  const removeLayerCalls = []

  return {
    addSourceCalls,
    removeLayerCalls,
    addSource(id, source) {
      addSourceCalls.push({ id, source })
      sources.set(id, source)
    },
    getSource(id) {
      return sources.get(id) ?? null
    },
    getLayer(id) {
      return layers.get(id) ?? null
    },
    addLayer(layer) {
      layers.set(layer.id, layer)
    },
    removeLayer(id) {
      removeLayerCalls.push(id)
      layers.delete(id)
    },
  }
}

test('addOrUpdateImageOverlay installs unchanged frame URL only once', () => {
  const map = createMap()
  const frame = { path: '/data/radar/echo_korea_202605201200.png', bounds: [[30, 120], [40, 130]] }

  assert.equal(addOrUpdateImageOverlay(map, {
    sourceId: 'radar',
    layerId: 'radar-layer',
    frame,
    opacity: 0.88,
  }), true)
  assert.equal(addOrUpdateImageOverlay(map, {
    sourceId: 'radar',
    layerId: 'radar-layer',
    frame,
    opacity: 0.88,
  }), true)

  assert.equal(map.addSourceCalls.length, 1)
  assert.equal(map.removeLayerCalls.length, 0)
})

test('addOrUpdateImageOverlay installs each frame URL once when looping back to a previous frame', () => {
  const map = createMap()

  addOrUpdateImageOverlay(map, {
    sourceId: 'radar',
    layerId: 'radar-layer',
    frame: { path: '/data/radar/echo_korea_202605201200.png', bounds: [[30, 120], [40, 130]] },
    opacity: 0.88,
  })
  addOrUpdateImageOverlay(map, {
    sourceId: 'radar',
    layerId: 'radar-layer',
    frame: { path: '/data/radar/echo_korea_202605201210.png', bounds: [[30, 120], [40, 130]] },
    opacity: 0.88,
  })
  addOrUpdateImageOverlay(map, {
    sourceId: 'radar',
    layerId: 'radar-layer',
    frame: { path: '/data/radar/echo_korea_202605201200.png', bounds: [[30, 120], [40, 130]] },
    opacity: 0.88,
  })

  assert.equal(map.addSourceCalls.length, 2)
  assert.equal(map.removeLayerCalls.length, 2)
})
