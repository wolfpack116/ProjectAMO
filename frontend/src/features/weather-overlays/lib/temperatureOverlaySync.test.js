import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TEMPERATURE_IMAGE_LAYER_IDS,
  TEMPERATURE_IMAGE_SOURCE_IDS,
  destroyTemperatureOverlay,
  syncTemperatureOverlay,
} from './temperatureOverlaySync.js'

function installDom() {
  const previousDocument = globalThis.document
  const createdCanvases = []
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, 'canvas')
      const calls = []
      const canvas = {
        __calls: calls,
        width: 0,
        height: 0,
        getContext(kind) {
          assert.equal(kind, '2d')
          return {
            createImageData(width, height) {
              calls.push({ method: 'createImageData', args: [width, height] })
              return { data: new Uint8ClampedArray(width * height * 4) }
            },
            putImageData(imageData, x, y) {
              calls.push({ method: 'putImageData', args: [imageData.data.length, x, y] })
            },
          }
        },
        toDataURL(type) {
          calls.push({ method: 'toDataURL', args: [type] })
          return `data:${type};base64,temp`
        },
      }
      createdCanvases.push(canvas)
      return canvas
    },
  }
  return {
    createdCanvases,
    restore() {
      globalThis.document = previousDocument
    },
  }
}

function createMap() {
  const sources = new Map()
  const layers = new Map()
  return {
    sources,
    layers,
    getSource: (id) => sources.get(id),
    addSource(id, source) {
      sources.set(id, {
        ...source,
        updateImage(image) {
          this.url = image.url
          this.coordinates = image.coordinates
          this.updatedImage = image
        },
      })
    },
    removeSource: (id) => sources.delete(id),
    getLayer: (id) => layers.get(id),
    addLayer: (layer) => layers.set(layer.id, { ...layer }),
    removeLayer: (id) => layers.delete(id),
    setLayoutProperty(id, prop, value) {
      const layer = layers.get(id)
      if (layer) layer.layout = { ...(layer.layout || {}), [prop]: value }
    },
  }
}

const FIELD = {
  encoding: 'int16-scaled-json-v1',
  scale: 0.01,
  offset: 0,
  grid: { nx: 2, ny: 2, lonMin: 126, latMin: 36, lonMax: 127, latMax: 37, dx: 1, dy: 1 },
  T: [27315, 26315, -32768, 30315],
}

test('syncTemperatureOverlay creates, updates, hides, and destroys a Mapbox image layer', () => {
  const dom = installDom()
  try {
    const map = createMap()
    syncTemperatureOverlay(map, { temperatureField: FIELD, isVisible: true })

    assert.equal(map.getSource(TEMPERATURE_IMAGE_SOURCE_IDS[0]).type, 'image')
    assert.equal(map.getLayer(TEMPERATURE_IMAGE_LAYER_IDS[0]).type, 'raster')
    assert.match(map.getSource(TEMPERATURE_IMAGE_SOURCE_IDS[0]).url, /^data:image\/png/)
    assert.ok(dom.createdCanvases[0].__calls.some((call) => call.method === 'putImageData'))

    syncTemperatureOverlay(map, { temperatureField: FIELD, isVisible: false })
    assert.equal(map.getLayer(TEMPERATURE_IMAGE_LAYER_IDS[0]).layout.visibility, 'none')

    destroyTemperatureOverlay(map)
    assert.equal(map.getSource(TEMPERATURE_IMAGE_SOURCE_IDS[0]), undefined)
    assert.equal(map.getLayer(TEMPERATURE_IMAGE_LAYER_IDS[0]), undefined)
  } finally {
    dom.restore()
  }
})
