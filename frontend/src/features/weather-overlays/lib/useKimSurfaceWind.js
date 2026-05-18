import { useEffect, useMemo, useState } from 'react'
import { fetchKimSurfaceWind, fetchSnapshotMeta } from '../../../api/weatherApi.js'

const REFRESH_INTERVAL_MS = 60_000

function getLowPowerState() {
  if (typeof window === 'undefined') return false
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const saveData = navigator.connection?.saveData
  return !!(reducedMotion || saveData)
}

export function useKimSurfaceWind(enabled) {
  const [windField, setWindField] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState(null)
  const lowPower = useMemo(() => getLowPowerState(), [])

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return undefined
    }

    let cancelled = false
    let currentHash = meta?.hash || null

    async function loadWindField() {
      setStatus((prev) => (prev === 'ready' ? 'refreshing' : 'loading'))
      try {
        const field = await fetchKimSurfaceWind()
        if (cancelled) return
        setWindField(field)
        setMeta({
          hash: field?.content_hash || null,
          tmfc: field?.time?.tmfc || null,
          hf: field?.time?.hf ?? null,
          updated_at: field?.fetched_at || null,
        })
        currentHash = field?.content_hash || null
        setError(null)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) return
        setError(loadError)
        setStatus('error')
      }
    }

    async function pollMeta() {
      try {
        const snapshot = await fetchSnapshotMeta()
        if (cancelled) return
        const nextMeta = snapshot?.kimSurfaceWind || snapshot?.kim_surface_wind || null
        if (!nextMeta?.hash) return
        if (nextMeta.hash !== currentHash) {
          await loadWindField()
        } else {
          setMeta(nextMeta)
        }
      } catch {
        if (!cancelled && !windField) setStatus('error')
      }
    }

    loadWindField()
    const timer = window.setInterval(pollMeta, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled])

  return { windField, status, error, meta, lowPower }
}

export default useKimSurfaceWind
