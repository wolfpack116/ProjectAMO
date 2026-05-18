import CanvasWindRenderer from './canvasWindRenderer.js'

const overlays = new WeakMap()

function windVisible(visibility = {}) {
  return !!(visibility.wind && (visibility.windFlow || visibility.windSpeed))
}

function bindMapEvents(map, renderer) {
  const resize = () => renderer.resize()
  const redraw = () => {
    renderer.resize()
    if (renderer.visibility.speed) renderer.drawSpeedLayer()
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

export function syncWindOverlay(map, model = {}) {
  if (!map?.getContainer) return null
  if (!windVisible(model.visibility) || !model.windField) {
    destroyWindOverlay(map)
    return null
  }

  let state = overlays.get(map)
  if (!state) {
    const renderer = new CanvasWindRenderer(map, model.rendererOptions)
    state = {
      renderer,
      cleanup: bindMapEvents(map, renderer),
      windField: null,
    }
    overlays.set(map, state)
  }

  if (state.windField !== model.windField) {
    state.renderer.setData(model.windField)
    state.windField = model.windField
  }

  state.renderer.setVisibility({
    flow: !!(model.visibility.wind && model.visibility.windFlow),
    speed: !!(model.visibility.wind && model.visibility.windSpeed),
  })
  return state
}

export function destroyWindOverlay(map) {
  const state = overlays.get(map)
  if (!state) return
  state.cleanup?.()
  state.renderer.destroy()
  overlays.delete(map)
}

export default {
  syncWindOverlay,
  destroyWindOverlay,
}
