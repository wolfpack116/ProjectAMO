import { useEffect, useRef } from 'react'

const SOURCE_ID = 'flight-category-source'
const LAYER_ID = 'flight-category-fill'
const POLL_MS = 60 * 1000

export default function FlightCategoryLayer({ map, visible, beforeLayerId }) {
  const etagRef = useRef(null)
  const timerRef = useRef(null)

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

    return () => {
      clearInterval(timerRef.current)
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
