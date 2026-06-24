import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { MAP_CONFIG, BASEMAP_OPTIONS } from '../map/mapConfig.js'

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

export default function SandboxPage() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const drawRef = useRef(null)
  const isDrawingRef = useRef(false)
  const vertsRef = useRef([])
  const mousePosRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [vertCount, setVertCount] = useState(0)
  const [polyCount, setPolyCount] = useState(0)
  const [hasSelection, setHasSelection] = useState(false)
  const [coordInput, setCoordInput] = useState({ lat: '', lng: '' })
  const [coordError, setCoordError] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) {
      setError('VITE_MAPBOX_TOKEN is required.')
      return
    }

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: BASEMAP_OPTIONS[0].style,
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      maxBounds: MAP_CONFIG.maxBounds,
    })
    mapRef.current = map

    const draw = new MapboxDraw({ displayControlsDefault: false, styles: DRAW_STYLES })
    map.addControl(draw)
    drawRef.current = draw

    map.on('load', () => {
      map.addSource(PREVIEW_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'sb-preview-line',
        type: 'line',
        source: PREVIEW_SRC,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [4, 2] },
      })
      map.addLayer({
        id: 'sb-preview-points',
        type: 'circle',
        source: PREVIEW_SRC,
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#3b82f6' },
      })
    })

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

    map.on('click', (e) => {
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
    })

    map.on('draw.create', () => setPolyCount(draw.getAll().features.length))
    map.on('draw.delete', () => { setPolyCount(draw.getAll().features.length); setHasSelection(false) })
    map.on('draw.selectionchange', (e) => setHasSelection(e.features.length > 0))

    map.on('mousemove', (e) => {
      if (!isDrawingRef.current) return
      mousePosRef.current = [e.lngLat.lng, e.lngLat.lat]
      setPreview(map, vertsRef.current, mousePosRef.current)
    })

    return () => {
      map.remove()
      mapRef.current = null
      drawRef.current = null
    }
  }, [])

  function handleStart() {
    const map = mapRef.current
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
    const map = mapRef.current
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
    const map = mapRef.current
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

  function handleCoordAdd(e) {
    e.preventDefault()
    const lat = parseFloat(coordInput.lat)
    const lng = parseFloat(coordInput.lng)
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCoordError('위도는 -90 ~ 90 사이 숫자여야 합니다.')
      return
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setCoordError('경도는 -180 ~ 180 사이 숫자여야 합니다.')
      return
    }
    setCoordError('')
    const map = mapRef.current
    if (!map) return
    vertsRef.current.push([lng, lat])
    setVertCount(vertsRef.current.length)
    setPreview(map, vertsRef.current, mousePosRef.current)
    setCoordInput({ lat: '', lng: '' })
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div style={labelStyle}>샌드박스 / 테스트 페이지</div>

      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!drawing ? (
          <>
            <button onClick={handleStart} style={btnStyle('#2563eb')}>구역 그리기</button>
            {hasSelection && (
              <button onClick={handleDeleteSelected} style={btnStyle('#ef4444')}>선택 구역 삭제</button>
            )}
            {polyCount > 0 && (
              <button onClick={handleDeleteAll} style={btnStyle('#6b7280')}>전체 구역 삭제 ({polyCount})</button>
            )}
            {polyCount > 0 && !hasSelection && (
              <div style={counterStyle}>구역 클릭 시 선택</div>
            )}
          </>
        ) : (
          <>
            <button onClick={handleCancel} style={btnStyle('#6b7280')}>그리기 취소</button>
            <button onClick={handleUndo} disabled={vertCount === 0} style={btnStyle(vertCount === 0 ? '#9ca3af' : '#f59e0b')}>
              마지막 점 취소
            </button>
            <div style={counterStyle}>{vertCount}개 점 찍음</div>
            <form onSubmit={handleCoordAdd} style={coordFormStyle}>
              <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 4, fontWeight: 600 }}>좌표 직접 입력</div>
              <label style={coordLabelStyle}>
                위도
                <input
                  type="number"
                  step="any"
                  placeholder="예: 37.5"
                  value={coordInput.lat}
                  onChange={e => setCoordInput(p => ({ ...p, lat: e.target.value }))}
                  style={coordInputStyle}
                />
              </label>
              <label style={coordLabelStyle}>
                경도
                <input
                  type="number"
                  step="any"
                  placeholder="예: 126.9"
                  value={coordInput.lng}
                  onChange={e => setCoordInput(p => ({ ...p, lng: e.target.value }))}
                  style={coordInputStyle}
                />
              </label>
              {coordError && <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 2 }}>{coordError}</div>}
              <button type="submit" style={{ ...btnStyle('#2563eb'), marginTop: 4, width: '100%' }}>점 추가</button>
            </form>
          </>
        )}
      </div>

      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#f66', fontSize: 14 }}>
          {error}
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

const labelStyle = {
  position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
  zIndex: 10, background: 'rgba(0,0,0,0.55)', color: '#fff',
  fontSize: 12, padding: '4px 12px', borderRadius: 4, pointerEvents: 'none',
  letterSpacing: '0.03em',
}

const counterStyle = {
  fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.5)',
  padding: '3px 8px', borderRadius: 4, textAlign: 'center',
}

const coordFormStyle = {
  background: 'rgba(15,23,42,0.85)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 160,
}

const coordLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  fontSize: 11,
  color: '#94a3b8',
}

const coordInputStyle = {
  width: 90,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 3,
  color: '#fff',
  fontSize: 11,
  padding: '3px 6px',
  outline: 'none',
}

function btnStyle(bg) {
  return {
    background: bg, color: '#fff', border: 'none', borderRadius: 4,
    padding: '7px 14px', fontSize: 13, fontWeight: 600,
    cursor: bg === '#9ca3af' ? 'not-allowed' : 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
  }
}
