import mapboxgl from 'mapbox-gl'
import { setMapLayerVisible } from '../../map/lib/mapLayerUtils.js'

export const FC_SOURCE_ID = 'flight-category-source'
export const FC_LAYER_ID = 'flight-category-fill'
export const FC_SOURCE_IDS = [FC_SOURCE_ID]
export const FC_LAYER_IDS = [FC_LAYER_ID]

export const CATEGORY_COLORS = { VFR: '#15803d', IFR: '#f97316', LIFR: '#dc2626' }

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export function addFlightCategoryLayer(map, beforeLayerId) {
  if (!map.getSource(FC_SOURCE_ID)) {
    map.addSource(FC_SOURCE_ID, { type: 'geojson', data: EMPTY_FC })
  }
  if (!map.getLayer(FC_LAYER_ID)) {
    const def = {
      id: FC_LAYER_ID,
      type: 'fill',
      source: FC_SOURCE_ID,
      layout: { visibility: 'none' },
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.35 },
    }
    if (beforeLayerId && map.getLayer(beforeLayerId)) {
      map.addLayer(def, beforeLayerId)
    } else {
      map.addLayer(def)
    }
  }
}

export function syncFlightCategoryLayer(map, { geojson, visible, beforeLayerId }) {
  addFlightCategoryLayer(map, beforeLayerId)
  map.getSource(FC_SOURCE_ID)?.setData(geojson || EMPTY_FC)
  setMapLayerVisible(map, FC_LAYER_ID, !!visible)
}

export function removeFlightCategoryLayer(map) {
  try {
    if (map.getLayer(FC_LAYER_ID)) map.removeLayer(FC_LAYER_ID)
    if (map.getSource(FC_SOURCE_ID)) map.removeSource(FC_SOURCE_ID)
  } catch {}
}

export function bindFlightCategoryClick(map, popupRef) {
  function handleClick(e) {
    const { lat, lng } = e.lngLat
    fetch(`/api/weather/flight-category-overlay/point?lat=${lat}&lon=${lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.error) return
        const color = CATEGORY_COLORS[d.category] || '#94a3b8'
        const visStr = d.vis_m >= 9999 ? '9,999m+' : `${d.vis_m.toLocaleString()}m`
        const ceilStr = d.ceil_ft == null || d.ceil_ft >= 25000 ? '—' : `${d.ceil_ft.toLocaleString()}ft`
        const html = `<div style="font-family:'Noto Sans KR',sans-serif;padding:2px 0">
          <div style="font-size:13px;font-weight:800;color:${color};margin-bottom:5px">${d.category}</div>
          <div style="font-size:12px;line-height:1.8;color:#1e293b">
            <span style="color:#64748b;font-weight:600">시정</span>&nbsp;${visStr}<br/>
            <span style="color:#64748b;font-weight:600">운고</span>&nbsp;${ceilStr}
          </div>
        </div>`
        popupRef.current?.remove()
        popupRef.current = new mapboxgl.Popup({ closeButton: true, offset: 8, maxWidth: '160px' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map)
      })
      .catch(() => {})
  }

  function onEnter() { map.getCanvas().style.cursor = 'pointer' }
  function onLeave() { map.getCanvas().style.cursor = '' }

  map.on('click', FC_LAYER_ID, handleClick)
  map.on('mouseenter', FC_LAYER_ID, onEnter)
  map.on('mouseleave', FC_LAYER_ID, onLeave)

  return () => {
    map.off('click', FC_LAYER_ID, handleClick)
    map.off('mouseenter', FC_LAYER_ID, onEnter)
    map.off('mouseleave', FC_LAYER_ID, onLeave)
    popupRef.current?.remove()
  }
}
