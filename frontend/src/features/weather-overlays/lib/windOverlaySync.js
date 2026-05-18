import CanvasWindRenderer from './canvasWindRenderer.js'
import WebGLWindRenderer from './webglWindRenderer.js'

const overlays = new WeakMap()
const canvasFallbackMaps = new WeakSet()

const defaultFactories = {
  createCanvasRenderer(map, options) {
    return new CanvasWindRenderer(map, options)
  },
  createWebGLRenderer(map, options) {
    return new WebGLWindRenderer(map, options)
  },
}

let rendererFactories = defaultFactories

function windVisible(visibility = {}) {
  return !!(visibility.wind && (visibility.windFlow || visibility.windSpeed))
}

function bindMapEvents(map, renderer) {
  const resize = () => renderer.resize()
  const redraw = () => {
    renderer.resize()
    renderer.redraw?.()
  }
  map.on?.('resize', resize)
  map.on?.('moveend', redraw)
  map.on?.('zoomend', redraw)
  return () => {
    map.off?.('resize', resize)
    map.off?.('moveend', redraw)
    map.off?.('zoomend', redraw)
  }
}

function createRenderer(map, options) {
  if (!canvasFallbackMaps.has(map)) {
    try {
      return rendererFactories.createWebGLRenderer(map, {
        ...options,
        onFailure() {
          replaceFailedRendererWithCanvas(map)
        },
      })
    } catch {
      // Fall through to the Canvas fallback.
    }
  }
  try {
    return rendererFactories.createCanvasRenderer(map, options)
  } catch {
    return null
  }
}

function applyVisibility(renderer, visibility = {}) {
  renderer.setVisibility({
    flow: !!(visibility.wind && visibility.windFlow),
    speed: !!(visibility.wind && visibility.windSpeed),
  })
}

function destroyState(map, state) {
  state.cleanup?.()
  state.renderer.destroy()
  overlays.delete(map)
}

function replaceFailedRendererWithCanvas(map) {
  const state = overlays.get(map)
  if (!state) return null
  canvasFallbackMaps.add(map)
  const windField = state.pendingWindField || state.windField
  const visibility = state.visibility
  destroyState(map, state)
  if (!windField) return null

  const renderer = createRenderer(map, state.rendererOptions)
  if (!renderer) return null
  const nextState = {
    cleanup: bindMapEvents(map, renderer),
    dataVersion: state.dataVersion + 1,
    pendingWindField: null,
    renderer,
    rendererOptions: state.rendererOptions,
    visibility,
    windField: null,
  }
  overlays.set(map, nextState)
  syncWindField(map, nextState, windField)
  applyVisibility(renderer, visibility)
  return nextState
}

function ensureRenderer(map, model, state) {
  if (state?.renderer?.failed) {
    canvasFallbackMaps.add(map)
    destroyState(map, state)
    return null
  }
  if (state) return state

  const renderer = createRenderer(map, model.rendererOptions)
  if (!renderer) return null
  const nextState = {
    cleanup: bindMapEvents(map, renderer),
    dataVersion: 0,
    pendingWindField: null,
    renderer,
    rendererOptions: model.rendererOptions,
    visibility: model.visibility,
    windField: null,
  }
  overlays.set(map, nextState)
  return nextState
}

function syncWindField(map, state, windField) {
  if (state.windField === windField && state.pendingWindField == null) return
  state.dataVersion += 1
  const version = state.dataVersion
  state.pendingWindField = windField
  Promise.resolve(state.renderer.setData(windField, {
    version,
    isCurrent() {
      return overlays.get(map) === state && state.dataVersion === version
    },
  }))
    .then((committed) => {
      if (overlays.get(map) !== state) return
      if (state.dataVersion !== version) return
      if (committed === false) {
        state.pendingWindField = null
        return
      }
      state.windField = windField
      state.pendingWindField = null
    })
    .catch(() => {
      if (overlays.get(map) !== state) return
      if (state.dataVersion !== version) return
      state.pendingWindField = null
    })
}

export function syncWindOverlay(map, model = {}) {
  if (!map?.getContainer) return null
  if (!windVisible(model.visibility) || !model.windField) {
    destroyWindOverlay(map)
    return null
  }

  let state = overlays.get(map)
  state = ensureRenderer(map, model, state)
  if (!state) {
    state = ensureRenderer(map, model, overlays.get(map))
  }
  if (!state) return null

  syncWindField(map, state, model.windField)
  state.visibility = model.visibility
  state.rendererOptions = model.rendererOptions
  applyVisibility(state.renderer, model.visibility)
  return state
}

export function destroyWindOverlay(map) {
  const state = overlays.get(map)
  if (!state) return
  destroyState(map, state)
}

export function __setWindOverlayRendererFactoriesForTest(factories) {
  rendererFactories = { ...defaultFactories, ...factories }
}

export function __resetWindOverlayRendererFactoriesForTest() {
  rendererFactories = defaultFactories
}

export default {
  syncWindOverlay,
  destroyWindOverlay,
}
