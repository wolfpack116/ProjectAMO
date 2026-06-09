import { useEffect, useRef, useState } from 'react'

const EMPTY_FC = { type: 'FeatureCollection', features: [] }
const POLL_MS = 60 * 1000

export function useFlightCategory() {
  const [geojson, setGeojson] = useState(EMPTY_FC)
  const etagRef = useRef(null)

  useEffect(() => {
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
    const timer = setInterval(fetchData, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return { geojson }
}
