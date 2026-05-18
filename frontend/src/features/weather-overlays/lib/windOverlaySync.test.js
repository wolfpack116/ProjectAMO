import test from 'node:test'
import assert from 'node:assert/strict'

import {
  destroyWindOverlay,
  syncWindOverlay,
} from './windOverlaySync.js'

function createContainer() {
  const children = []
  return {
    children,
    appendChild(node) {
      node.parentNode = this
      children.push(node)
    },
    removeChild(node) {
      const index = children.indexOf(node)
      if (index >= 0) children.splice(index, 1)
      node.parentNode = null
    },
    querySelectorAll(selector) {
      if (selector === 'canvas[data-kim-wind-overlay]') {
        return children.filter((child) => child.dataset?.kimWindOverlay)
      }
      const roleMatch = selector.match(/^canvas\[data-kim-wind-overlay="([^"]+)"\]$/)
      if (roleMatch) {
        return children.filter((child) => child.dataset?.kimWindOverlay === roleMatch[1])
      }
      return []
    },
    getBoundingClientRect() {
      return { width: 640, height: 360 }
    },
  }
}

function createCanvas() {
  const calls = []
  return {
    __calls: calls,
    dataset: {},
    style: {},
    width: 0,
    height: 0,
    getContext() {
      return {
        clearRect(...args) { calls.push({ method: 'clearRect', args }) },
        fillRect(...args) { calls.push({ method: 'fillRect', args }) },
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        save() {},
        restore() {},
        scale() {},
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        lineWidth: 1,
      }
    },
  }
}

function installDom() {
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  let nextFrameId = 1
  const activeFrames = new Set()

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, 'canvas')
      return createCanvas()
    },
  }
  globalThis.window = {
    devicePixelRatio: 1,
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} }
    },
    requestAnimationFrame(callback) {
      const id = nextFrameId++
      activeFrames.add(id)
      return id
    },
    cancelAnimationFrame(id) {
      activeFrames.delete(id)
    },
    addEventListener() {},
    removeEventListener() {},
  }

  return {
    activeFrames,
    restore() {
      globalThis.document = previousDocument
      globalThis.window = previousWindow
    },
  }
}

function createMap(container = createContainer()) {
  return {
    container,
    events: new Map(),
    getContainer() {
      return container
    },
    on(eventName, handler) {
      this.events.set(eventName, handler)
    },
    off(eventName) {
      this.events.delete(eventName)
    },
    getBounds() {
      return {
        getWest: () => 126,
        getEast: () => 127,
        getSouth: () => 36,
        getNorth: () => 37,
      }
    },
    project([lon, lat]) {
      return { x: (lon - 126) * 640, y: (37 - lat) * 360 }
    },
    unproject([x, y]) {
      return { lng: 126 + x / 640, lat: 37 - y / 360 }
    },
  }
}

const FIELD_A = {
  encoding: 'int16-scaled-json-v1',
  scale: 1,
  offset: 0,
  grid: { nx: 2, ny: 2, lonMin: 126, latMin: 36, lonMax: 127, latMax: 37, dx: 1, dy: 1 },
  u: [1, 1, 1, 1],
  v: [0, 0, 0, 0],
}

const FIELD_B = {
  ...FIELD_A,
  u: [2, 2, 2, 2],
}

test('syncWindOverlay creates one canvas across repeated sync calls', () => {
  const dom = installDom()
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })

    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 2)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="flow"]').length, 1)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="speed"]').length, 1)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay stops animation when flow visibility is off and destroy removes rAF loop', () => {
  const dom = installDom()
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    assert.equal(dom.activeFrames.size, 1)

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: false, windSpeed: false } })
    assert.equal(dom.activeFrames.size, 0)

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    destroyWindOverlay(map)
    assert.equal(dom.activeFrames.size, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 0)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay destroys overlay when parent wind visibility turns off', () => {
  const dom = installDom()
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    assert.equal(dom.activeFrames.size, 1)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 2)

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: false, windFlow: true, windSpeed: false } })
    assert.equal(dom.activeFrames.size, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 0)
  } finally {
    dom.restore()
  }
})

test('speed layer redraw clears stale pixels on map movement', () => {
  const dom = installDom()
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: false, windSpeed: true } })
    const speedCanvas = map.container.querySelectorAll('canvas[data-kim-wind-overlay="speed"]')[0]
    const initialClearCount = speedCanvas.__calls.filter((call) => call.method === 'clearRect').length

    map.events.get('moveend')()

    const nextClearCount = speedCanvas.__calls.filter((call) => call.method === 'clearRect').length
    assert.ok(nextClearCount > initialClearCount)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay forwards low-power renderer options', () => {
  const dom = installDom()
  try {
    const map = createMap()

    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      rendererOptions: { desktopCap: 1000, mobileCap: 1000, frameCap: 15 },
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(state.renderer.options.desktopCap, 1000)
    assert.equal(state.renderer.options.mobileCap, 1000)
    assert.equal(state.renderer.options.frameCap, 15)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay preserves particle state when wind data hot-swaps', () => {
  const dom = installDom()
  try {
    const map = createMap()

    const first = syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    const particleRef = first.renderer.particles
    syncWindOverlay(map, { windField: FIELD_B, visibility: { wind: true, windFlow: true, windSpeed: false } })

    assert.equal(first.renderer.particles, particleRef)
    assert.equal(first.renderer.windField, FIELD_B)
  } finally {
    dom.restore()
  }
})
