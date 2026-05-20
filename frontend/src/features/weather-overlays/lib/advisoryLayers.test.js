import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADVISORY_LAYER_DEFS,
  addAdvisoryLayers,
  advisoryItemsToLabelFeatureCollection,
} from './advisoryLayers.js'

function createMap() {
  const sources = new Map()
  const layers = new Map()
  return {
    layers,
    addSource(id, source) {
      sources.set(id, source)
    },
    getSource(id) {
      return sources.get(id) ?? null
    },
    addLayer(layer) {
      layers.set(layer.id, layer)
    },
    getLayer(id) {
      return layers.get(id) ?? null
    },
    hasImage() {
      return true
    },
    loadImage() {},
    addImage() {},
  }
}

test('advisory map markers render icon layer without map text labels', () => {
  const map = createMap()
  const featureData = { type: 'FeatureCollection', features: [] }
  const labelData = advisoryItemsToLabelFeatureCollection({
    items: [{
      id: 'sigmet-1',
      phenomenon_code: 'TURB',
      sequence_number: '002',
      bbox: { min_lon: 126, max_lon: 128, min_lat: 36, max_lat: 38 },
    }],
  }, 'sigmet')

  addAdvisoryLayers(map, 'sigmet', featureData, labelData)

  assert.ok(map.getLayer(ADVISORY_LAYER_DEFS.sigmet.iconLayerId))
  assert.equal([...map.layers.values()].some((layer) => layer.layout?.['text-field']), false)
})
