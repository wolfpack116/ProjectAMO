import { useEffect, useRef, useState } from 'react'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

const DRAW_STYLES = [
  {
    id: 'sb-poly-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    paint: { 'fill-opacity': 0 },
  },
  {
    id: 'sb-poly-fill-active',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.3 },
  },
  {
    id: 'sb-poly-stroke',
    type: 'line',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-join': 'round' },
  },
]

const PREVIEW_SRC = 'sb-preview'
const PREVIEW_LINE_LAYER = 'sb-preview-line'
const PREVIEW_POINTS_LAYER = 'sb-preview-points'

function setPreview(map, verts, mousePos) {
  const src = map.getSource(PREVIEW_SRC)
  if (!src) return
  const features = []
  const coords = mousePos ? [...verts, mousePos] : [...verts]
  if (coords.length >= 2) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} })
  }
  for (const v of verts) {
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: v }, properties: {} })
  }
  src.setData({ type: 'FeatureCollection', features })
}

/**
 * Reusable polygon-drawing controller for an existing Mapbox map instance.
 * Does not create or own the map; the caller is responsible for the map lifecycle.
 */
export function usePolygonDraw(map) {
  const drawRef = useRef(null)
  const isDrawingRef = useRef(false)
  const vertsRef = useRef([])
  const mousePosRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [vertCount, setVertCount] = useState(0)
  const [polyCount, setPolyCount] = useState(0)
  const [hasSelection, setHasSelection] = useState(false)

  useEffect(() => {
    if (!map) return undefined

    const draw = new MapboxDraw({ displayControlsDefault: false, styles: DRAW_STYLES })
    map.addControl(draw)
    drawRef.current = draw

    function addPreviewLayers() {
      if (map.getSource(PREVIEW_SRC)) return
      map.addSource(PREVIEW_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: PREVIEW_LINE_LAYER,
        type: 'line',
        source: PREVIEW_SRC,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [4, 2] },
      })
      map.addLayer({
        id: PREVIEW_POINTS_LAYER,
        type: 'circle',
        source: PREVIEW_SRC,
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#3b82f6' },
      })
    }

    map.on('load', addPreviewLayers)

    function finalize() {
      const verts = vertsRef.current
      if (verts.length < 3) return
      draw.add({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...verts, verts[0]]] },
        properties: {},
      })
      vertsRef.current = []
      mousePosRef.current = null
      isDrawingRef.current = false
      setDrawing(false)
      setVertCount(0)
      setPolyCount(draw.getAll().features.length)
      map.getCanvas().style.cursor = ''
      map.doubleClickZoom.enable()
      setPreview(map, [], null)
    }

    function onClick(e) {
      if (!isDrawingRef.current) return
      const { lng, lat } = e.lngLat
      const verts = vertsRef.current

      // 더블클릭 닫기 (click 이벤트가 detail=2로 두 번째 클릭으로 옴)
      if (e.originalEvent.detail >= 2) {
        if (verts.length >= 3) finalize()
        return
      }

      // 첫 번째 점 클릭 시 닫기 (15px 이내)
      if (verts.length >= 3) {
        const fp = map.project(verts[0])
        const cp = map.project([lng, lat])
        if (Math.hypot(fp.x - cp.x, fp.y - cp.y) < 15) {
          finalize()
          return
        }
      }

      verts.push([lng, lat])
      setVertCount(verts.length)
      setPreview(map, verts, mousePosRef.current)
    }

    function onDrawCreate() { setPolyCount(draw.getAll().features.length) }
    function onDrawDelete() { setPolyCount(draw.getAll().features.length); setHasSelection(false) }
    function onDrawSelectionChange(e) { setHasSelection(e.features.length > 0) }

    function onMouseMove(e) {
      if (!isDrawingRef.current) return
      mousePosRef.current = [e.lngLat.lng, e.lngLat.lat]
      setPreview(map, vertsRef.current, mousePosRef.current)
    }

    map.on('click', onClick)
    map.on('draw.create', onDrawCreate)
    map.on('draw.delete', onDrawDelete)
    map.on('draw.selectionchange', onDrawSelectionChange)
    map.on('mousemove', onMouseMove)

    return () => {
      map.off('load', addPreviewLayers)
      map.off('click', onClick)
      map.off('draw.create', onDrawCreate)
      map.off('draw.delete', onDrawDelete)
      map.off('draw.selectionchange', onDrawSelectionChange)
      map.off('mousemove', onMouseMove)
      try {
        if (map.getLayer(PREVIEW_LINE_LAYER)) map.removeLayer(PREVIEW_LINE_LAYER)
        if (map.getLayer(PREVIEW_POINTS_LAYER)) map.removeLayer(PREVIEW_POINTS_LAYER)
        if (map.getSource(PREVIEW_SRC)) map.removeSource(PREVIEW_SRC)
        map.removeControl(draw)
      } catch {
        // map may already be torn down by the owning component
      }
      drawRef.current = null
    }
  }, [map])

  function handleStart() {
    if (!map) return
    vertsRef.current = []
    mousePosRef.current = null
    isDrawingRef.current = true
    setDrawing(true)
    setVertCount(0)
    map.getCanvas().style.cursor = 'crosshair'
    map.doubleClickZoom.disable()
  }

  function handleCancel() {
    if (!map) return
    vertsRef.current = []
    mousePosRef.current = null
    isDrawingRef.current = false
    setDrawing(false)
    setVertCount(0)
    map.getCanvas().style.cursor = ''
    map.doubleClickZoom.enable()
    setPreview(map, [], null)
  }

  function handleUndo() {
    if (!map || !isDrawingRef.current || vertsRef.current.length === 0) return
    vertsRef.current.pop()
    setVertCount(vertsRef.current.length)
    setPreview(map, vertsRef.current, mousePosRef.current)
  }

  function handleDeleteSelected() {
    const draw = drawRef.current
    if (!draw) return
    draw.trash()
    setPolyCount(draw.getAll().features.length)
    setHasSelection(false)
  }

  function handleDeleteAll() {
    const draw = drawRef.current
    if (!draw) return
    draw.deleteAll()
    setPolyCount(0)
    setHasSelection(false)
  }

  function addVertex(lng, lat) {
    if (!map) return
    vertsRef.current.push([lng, lat])
    setVertCount(vertsRef.current.length)
    setPreview(map, vertsRef.current, mousePosRef.current)
  }

  return {
    drawing,
    vertCount,
    polyCount,
    hasSelection,
    handleStart,
    handleCancel,
    handleUndo,
    handleDeleteSelected,
    handleDeleteAll,
    addVertex,
  }
}
