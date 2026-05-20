import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildSnapshotMetaFromData,
  fetchSnapshotMeta,
  loadChangedWeatherData,
  loadDeferredWeatherData,
  loadWeatherData,
} from '../api/weatherApi.js'
import { detectSnapshotChanges, hasSnapshotChanges } from './snapshotMeta.js'

const REFRESH_INTERVAL_MS = 60_000

function useWeatherPolling() {
  const [weatherData, setWeatherData] = useState(null)
  const snapshotMetaRef = useRef(null)
  const loadedDeferredKeysRef = useRef(new Set())

  useEffect(() => {
    let mounted = true
    let polling = false

    async function fetchInitialData() {
      try {
        const data = await loadWeatherData()
        if (!mounted) return
        setWeatherData(data)
        snapshotMetaRef.current = buildSnapshotMetaFromData(data)
      } catch (err) {
        console.warn('[App] Weather data fetch failed:', err.message)
      }
    }

    async function pollChangedData() {
      if (polling) return
      if (!snapshotMetaRef.current) {
        await fetchInitialData()
        return
      }
      polling = true

      try {
        const latestMeta = await fetchSnapshotMeta()
        if (!mounted || !latestMeta) return

        const changes = detectSnapshotChanges(snapshotMetaRef.current, latestMeta)
        if (!hasSnapshotChanges(changes)) return

        const changedData = await loadChangedWeatherData(changes, {
          deferredKeys: loadedDeferredKeysRef.current,
        })
        if (!mounted) return

        setWeatherData((prev) => {
          const nextData = { ...(prev || {}), ...changedData }
          snapshotMetaRef.current = buildSnapshotMetaFromData(nextData)
          return nextData
        })
      } catch (err) {
        console.warn('[App] Weather incremental fetch failed:', err.message)
      } finally {
        polling = false
      }
    }

    fetchInitialData()
    const timer = window.setInterval(pollChangedData, REFRESH_INTERVAL_MS)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [])

  const requestDeferredWeatherData = useCallback(async (keys = []) => {
    const missingKeys = keys.filter((key) => !loadedDeferredKeysRef.current.has(key))
    if (missingKeys.length === 0) return
    missingKeys.forEach((key) => loadedDeferredKeysRef.current.add(key))

    try {
      const deferredData = await loadDeferredWeatherData(missingKeys)
      setWeatherData((prev) => {
        const nextData = { ...(prev || {}), ...deferredData }
        snapshotMetaRef.current = buildSnapshotMetaFromData(nextData)
        return nextData
      })
    } catch (err) {
      missingKeys.forEach((key) => loadedDeferredKeysRef.current.delete(key))
      console.warn('[App] Weather deferred fetch failed:', err.message)
    }
  }, [])

  return { weatherData, requestDeferredWeatherData }
}

export default useWeatherPolling
