import test from 'node:test'
import assert from 'node:assert/strict'

import WebGLWindRenderer from './webglWindRenderer.js'
import {
  __resetWindOverlayRendererFactoriesForTest,
  __setWindOverlayRendererFactoriesForTest,
  destroyWindOverlay,
  syncWindOverlay,
} from './windOverlaySync.js'

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function createWebGLContext(options = {}) {
  const calls = []
  let nextId = 1
  return {
    __calls: calls,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    TRIANGLE_STRIP: 0x0005,
    TRIANGLES: 0x0004,
    POINTS: 0x0000,
    LINES: 0x0001,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    COLOR_BUFFER_BIT: 0x4000,
    FLOAT: 0x1406,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    BLEND: 0x0be2,
    ZERO: 0,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    createShader(type) {
      const shader = { id: nextId++, type }
      calls.push({ method: 'createShader', args: [type] })
      return shader
    },
    shaderSource(shader, source) {
      calls.push({ method: 'shaderSource', args: [shader, source] })
    },
    compileShader(shader) {
      calls.push({ method: 'compileShader', args: [shader] })
    },
    getShaderParameter(shader, name) {
      calls.push({ method: 'getShaderParameter', args: [shader, name] })
      if (options.failCompile) return false
      return true
    },
    getShaderInfoLog() {
      return options.failCompile ? 'compile failed' : ''
    },
    deleteShader(shader) {
      calls.push({ method: 'deleteShader', args: [shader] })
    },
    createProgram() {
      const program = { id: nextId++ }
      calls.push({ method: 'createProgram', args: [] })
      return program
    },
    attachShader(program, shader) {
      calls.push({ method: 'attachShader', args: [program, shader] })
    },
    linkProgram(program) {
      calls.push({ method: 'linkProgram', args: [program] })
    },
    getProgramParameter(program, name) {
      calls.push({ method: 'getProgramParameter', args: [program, name] })
      if (options.failLink) return false
      return true
    },
    getProgramInfoLog() {
      return options.failLink ? 'link failed' : ''
    },
    createBuffer() {
      const buffer = { id: nextId++ }
      calls.push({ method: 'createBuffer', args: [] })
      return buffer
    },
    bindBuffer(target, buffer) {
      calls.push({ method: 'bindBuffer', args: [target, buffer] })
    },
    bufferData(target, data, usage) {
      calls.push({
        method: 'bufferData',
        args: [target, ArrayBuffer.isView(data) ? data.length : data, usage],
      })
    },
    createTexture() {
      const texture = { id: nextId++ }
      calls.push({ method: 'createTexture', args: [] })
      return texture
    },
    bindTexture(target, texture) {
      calls.push({ method: 'bindTexture', args: [target, texture] })
    },
    texParameteri(target, pname, param) {
      calls.push({ method: 'texParameteri', args: [target, pname, param] })
    },
    activeTexture(textureUnit) {
      calls.push({ method: 'activeTexture', args: [textureUnit] })
    },
    texImage2D(...args) {
      calls.push({ method: 'texImage2D', args })
    },
    viewport(...args) {
      calls.push({ method: 'viewport', args })
    },
    clearColor(...args) {
      calls.push({ method: 'clearColor', args })
    },
    clear(mask) {
      calls.push({ method: 'clear', args: [mask] })
    },
    useProgram(program) {
      calls.push({ method: 'useProgram', args: [program] })
    },
    getAttribLocation(program, name) {
      calls.push({ method: 'getAttribLocation', args: [program, name] })
      return 0
    },
    enableVertexAttribArray(location) {
      calls.push({ method: 'enableVertexAttribArray', args: [location] })
    },
    vertexAttribPointer(...args) {
      calls.push({ method: 'vertexAttribPointer', args })
    },
    getUniformLocation(program, name) {
      calls.push({ method: 'getUniformLocation', args: [program, name] })
      return { program, name }
    },
    uniform1i(location, value) {
      calls.push({ method: 'uniform1i', args: [location, value] })
    },
    uniform1f(location, value) {
      calls.push({ method: 'uniform1f', args: [location, value] })
    },
    uniform2f(location, x, y) {
      calls.push({ method: 'uniform2f', args: [location, x, y] })
    },
    uniform4fv(location, value) {
      calls.push({ method: 'uniform4fv', args: [location, Array.from(value)] })
    },
    uniform1fv(location, value) {
      calls.push({ method: 'uniform1fv', args: [location, Array.from(value)] })
    },
    enable(cap) {
      calls.push({ method: 'enable', args: [cap] })
    },
    disable(cap) {
      calls.push({ method: 'disable', args: [cap] })
    },
    blendFunc(src, dst) {
      calls.push({ method: 'blendFunc', args: [src, dst] })
    },
    drawArrays(...args) {
      calls.push({ method: 'drawArrays', args })
    },
    deleteProgram(program) {
      calls.push({ method: 'deleteProgram', args: [program] })
    },
    deleteBuffer(buffer) {
      calls.push({ method: 'deleteBuffer', args: [buffer] })
    },
    deleteTexture(texture) {
      calls.push({ method: 'deleteTexture', args: [texture] })
    },
  }
}

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

function createCanvas(options = {}) {
  const calls = []
  const listeners = new Map()
  const webglContext = options.webgl ? createWebGLContext(options.webgl === true ? {} : options.webgl) : null
  return {
    __calls: calls,
    __webglContext: webglContext,
    dataset: {},
    style: {},
    width: 0,
    height: 0,
    parentNode: null,
    addEventListener(name, handler) {
      listeners.set(name, handler)
    },
    removeEventListener(name) {
      listeners.delete(name)
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.(event)
    },
    getContext(kind) {
      if (kind === 'webgl' || kind === 'experimental-webgl') return webglContext
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
        setTransform() {},
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        lineWidth: 1,
      }
    },
  }
}

function installDom({ dpr = 1, webgl = false } = {}) {
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  let nextFrameId = 1
  const activeFrames = new Set()

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, 'canvas')
      return createCanvas({ webgl })
    },
  }
  globalThis.window = {
    devicePixelRatio: dpr,
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} }
    },
    requestAnimationFrame() {
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
      __resetWindOverlayRendererFactoriesForTest()
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

test('syncWindOverlay prefers WebGL renderer when WebGL context is available', () => {
  const dom = installDom({ webgl: true })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(state.renderer.type, 'webgl')
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl"]').length, 1)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay falls back to Canvas renderer when WebGL context is unavailable', () => {
  const dom = installDom({ webgl: false })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(state.renderer.type, 'canvas')
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="flow"]').length, 1)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="speed"]').length, 1)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay creates one overlay across repeated sync calls', () => {
  const dom = installDom({ webgl: false })
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })

    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 2)
  } finally {
    dom.restore()
  }
})

test('WebGL renderer stop and destroy cancel animation and remove canvas', () => {
  const dom = installDom({ webgl: true })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(dom.activeFrames.size, 1)
    destroyWindOverlay(map)
    assert.equal(dom.activeFrames.size, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl"]').length, 0)
    assert.equal(state.renderer.destroyed, true)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay stops animation when flow visibility is off', () => {
  const dom = installDom({ webgl: false })
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    assert.equal(dom.activeFrames.size, 1)

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: false, windSpeed: false } })
    assert.equal(dom.activeFrames.size, 0)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay destroys overlay when parent wind visibility turns off', () => {
  const dom = installDom({ webgl: false })
  try {
    const map = createMap()

    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: true, windFlow: true, windSpeed: false } })
    syncWindOverlay(map, { windField: FIELD_A, visibility: { wind: false, windFlow: true, windSpeed: false } })

    assert.equal(dom.activeFrames.size, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 0)
  } finally {
    dom.restore()
  }
})

test('speed layer redraw clears stale pixels on map movement', () => {
  const dom = installDom({ webgl: false })
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
  const dom = installDom({ webgl: false })
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

test('syncWindOverlay preserves particle state when Canvas wind data hot-swaps', () => {
  const dom = installDom({ webgl: false })
  try {
    const map = createMap()

    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })
    const particleRef = state.renderer.particles

    syncWindOverlay(map, {
      windField: FIELD_B,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(state.renderer.particles, particleRef)
    assert.equal(state.renderer.windField, FIELD_B)
  } finally {
    dom.restore()
  }
})

test('WebGL renderer uploads wind data and updates backing-store viewport size', () => {
  const dom = installDom({ dpr: 2, webgl: true })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: true },
    })

    const flowCalls = state.renderer.gl.__calls
    const speedCalls = state.renderer.speedGl.__calls
    assert.ok(flowCalls.some((call) => call.method === 'texImage2D'))
    assert.ok(flowCalls.some((call) => call.method === 'viewport' && call.args[2] === 1280 && call.args[3] === 720))
    assert.ok(speedCalls.some((call) => call.method === 'viewport' && call.args[2] === 1280 && call.args[3] === 720))
    assert.ok(flowCalls.some((call) => call.method === 'drawArrays' && call.args[0] === state.renderer.gl.LINES))
    assert.ok(flowCalls.some((call) => call.method === 'drawArrays' && call.args[0] === state.renderer.gl.POINTS))
    assert.ok(speedCalls.some((call) => call.method === 'drawArrays' && call.args[0] === state.renderer.speedGl.TRIANGLES))
    assert.ok(flowCalls.some((call) => call.method === 'blendFunc' && call.args[0] === state.renderer.gl.ZERO && call.args[1] === state.renderer.gl.SRC_ALPHA))
    assert.ok(flowCalls.some((call) => call.method === 'vertexAttribPointer' && call.args[2] === state.renderer.gl.FLOAT))
  } finally {
    dom.restore()
  }
})

test('WebGL renderer does not draw long stale segments after particle reseed', () => {
  const dom = installDom({ webgl: true })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      rendererOptions: { desktopCap: 64, mobileCap: 64 },
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    const particle = state.renderer.particles[0]
    particle.lon = 126.5
    particle.lat = 36.5
    particle.prevLon = 127
    particle.prevLat = 37
    particle.age = particle.maxAge

    state.renderer.stepParticles()

    assert.equal(particle.prevLon, null)
    assert.equal(particle.prevLat, null)
    const [fromX, fromY, , toX, toY] = state.renderer.particleVertexData
    assert.equal(fromX, toX)
    assert.equal(fromY, toY)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay ignores stale async renderer data commits', async () => {
  const dom = installDom({ webgl: false })
  try {
    const first = createDeferred()
    const second = createDeferred()
    const committedFields = []

    class FakeRenderer {
      constructor() {
        this.type = 'fake'
        this.visibility = { flow: false, speed: false }
      }

      setData(field, commit) {
        const current = committedFields.length === 0 ? first : second
        return current.promise.then(() => {
          if (commit.isCurrent()) committedFields.push(field)
        })
      }

      setVisibility(visibility) {
        this.visibility = visibility
      }

      resize() {}
      start() {}
      stop() {}
      destroy() {
        this.destroyed = true
      }
    }

    __setWindOverlayRendererFactoriesForTest({
      createWebGLRenderer: () => {
        throw new Error('not available')
      },
      createCanvasRenderer: () => new FakeRenderer(),
    })

    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    syncWindOverlay(map, {
      windField: FIELD_B,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    second.resolve()
    await second.promise
    first.resolve()
    await first.promise
    await Promise.resolve()

    assert.deepEqual(committedFields, [FIELD_B])
    assert.equal(state.windField, FIELD_B)
    assert.equal(state.pendingWindField, null)
    assert.equal(state.renderer.type, 'fake')
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay falls back to Canvas on the next sync after WebGL context loss', () => {
  const dom = installDom({ webgl: true })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    const canvas = map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl"]')[0]
    canvas.dispatchEvent({
      type: 'webglcontextlost',
      preventDefault() {},
    })

    assert.equal(state.renderer.failed, true)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl"]').length, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl-speed"]').length, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="flow"]').length, 1)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="speed"]').length, 1)

    const nextState = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(nextState.renderer.type, 'canvas')
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl"]').length, 0)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="flow"]').length, 1)
  } finally {
    dom.restore()
  }
})

test('WebGL renderer constructor cleans up appended canvas when shader init fails', () => {
  const dom = installDom({ webgl: { failCompile: true } })
  try {
    const map = createMap()
    assert.throws(() => new WebGLWindRenderer(map), /compile failed/)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay="webgl"]').length, 0)
  } finally {
    dom.restore()
  }
})

test('syncWindOverlay returns null and cleans up when both WebGL and Canvas renderers fail', () => {
  const dom = installDom({ webgl: false })
  try {
    __setWindOverlayRendererFactoriesForTest({
      createWebGLRenderer: () => {
        throw new Error('webgl failed')
      },
      createCanvasRenderer: () => {
        throw new Error('canvas failed')
      },
    })

    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: false },
    })

    assert.equal(state, null)
    assert.equal(map.container.querySelectorAll('canvas[data-kim-wind-overlay]').length, 0)
  } finally {
    dom.restore()
  }
})

test('WebGL speed shader uses ramp colors without dividing sampled colors by 255', () => {
  const dom = installDom({ webgl: true })
  try {
    const map = createMap()
    const state = syncWindOverlay(map, {
      windField: FIELD_A,
      visibility: { wind: true, windFlow: true, windSpeed: true },
    })

    const fragmentSources = state.renderer.speedGl.__calls
      .filter((call) => call.method === 'shaderSource')
      .map((call) => String(call.args[1]))
    assert.ok(fragmentSources.some((source) => source.includes('22.0')))
    assert.ok(fragmentSources.every((source) => !source.includes('/ 255.0')))
  } finally {
    dom.restore()
  }
})
