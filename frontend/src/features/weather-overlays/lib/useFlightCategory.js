import { useEffect, useRef, useState } from 'react'
import { useKimSnapshotMeta } from './useKimSnapshotMeta.js'

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export function useFlightCategory() {
  const [geojson, setGeojson] = useState(EMPTY_FC)
  const etagRef = useRef(null)
  const snapshot = useKimSnapshotMeta(true)
  const fcHash = snapshot?.flightCategory?.hash ?? null
  const hasSnapshot = snapshot !== null

  useEffect(() => {
    if (!hasSnapshot) return
    let cancelled = false
    async function fetchData() {
      try {
        const headers = {}
        if (etagRef.current) headers['If-None-Match'] = etagRef.current
        const res = await fetch('/api/weather/flight-category-overlay', { headers })
        if (cancelled) return
        if (res.status === 304) return
        if (!res.ok) return
        const etag = res.headers.get('ETag')
        if (etag) etagRef.current = etag
        const data = await res.json()
        if (!cancelled) setGeojson(data)
      } catch {
        // transient network error — retain last known data
      }
    }
    fetchData()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSnapshot, fcHash])

  return { geojson }
}
