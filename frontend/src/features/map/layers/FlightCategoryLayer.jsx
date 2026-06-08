import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

const SOURCE_ID = 'flight-category-source'
const LAYER_ID = 'flight-category-fill'
const POLL_MS = 60 * 1000
const CATEGORY_COLORS = { VFR: '#15803d', IFR: '#f97316', LIFR: '#dc2626' }

export default function FlightCategoryLayer({ map, visible, beforeLayerId }) {
  const etagRef = useRef(null)
  const timerRef = useRef(null)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!map) return

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(LAYER_ID)) {
      const layerDef = {
        id: LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.35,
        },
      }
      if (beforeLayerId && map.getLayer(beforeLayerId)) {
        map.addLayer(layerDef, beforeLayerId)
      } else {
        map.addLayer(layerDef)
      }
    }

    async function fetchData() {
      try {
        const headers = {}
        if (etagRef.current) headers['If-None-Match'] = etagRef.current
        const res = await fetch('/api/weather/flight-category-overlay', { headers })
        if (res.status === 304) return
        if (!res.ok) {
          // 스펙: "API 실패 시 레이어 숨김, 기존 데이터 잔존 없음"
          map.getSource(SOURCE_ID)?.setData({ type: 'FeatureCollection', features: [] })
          if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none')
          return
        }
        const etag = res.headers.get('ETag')
        if (etag) etagRef.current = etag
        const geojson = await res.json()
        map.getSource(SOURCE_ID)?.setData(geojson)
      } catch (e) {
        console.warn('FlightCategoryLayer:', e.message)
      }
    }

    fetchData()
    timerRef.current = setInterval(fetchData, POLL_MS)

    function handleClick(e) {
      const { lat, lng } = e.lngLat
      fetch(`/api/weather/flight-category-overlay/point?lat=${lat}&lon=${lng}`)
        .then((r) => r.ok ? r.json() : null)
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

    map.on('click', LAYER_ID, handleClick)
    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = '' })

    return () => {
      clearInterval(timerRef.current)
      popupRef.current?.remove()
      map.off('click', LAYER_ID, handleClick)
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {}
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map?.getLayer(LAYER_ID)) return
    map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible])

  return null
}
