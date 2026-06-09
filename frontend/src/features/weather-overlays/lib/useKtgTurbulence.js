import { useEffect, useRef, useState } from 'react'
import { fetchKtgGrid, fetchKtgIndex } from '../../../api/weatherApi.js'

const DEFAULT_ALT_FT = 3000

function isAbortError(error) {
  return error?.name === 'AbortError'
}

export function useKtgTurbulence(enabled) {
  const [altLevelsFt, setAltLevelsFt] = useState([])
  const [selectedAltFt, setSelectedAltFtState] = useState(DEFAULT_ALT_FT)
  const [ktgGrid, setKtgGrid] = useState(null)
  const [ktgGridKey, setKtgGridKey] = useState(null)
  const [status, setStatus] = useState('idle')
  const cacheRef = useRef(new Map())
  const requestTokenRef = useRef(0)

  // Fetch index to get available altitude levels.
  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return undefined
    }
    const controller = new AbortController()
    let cancelled = false
    async function loadIndex() {
      try {
        const index = await fetchKtgIndex({ signal: controller.signal })
        if (cancelled) return
        const levels = index?.altLevelsFt ?? []
        setAltLevelsFt(levels)
        if (levels.length === 0) {
          setStatus('unavailable')
          return
        }
        // If the current selection is not in the list, pick the closest level.
        if (levels.length > 0) {
          setSelectedAltFtState((prev) => {
            if (levels.includes(prev)) return prev
            return levels.reduce((best, ft) => (Math.abs(ft - prev) < Math.abs(best - prev) ? ft : best))
          })
        }
      } catch (err) {
        if (cancelled || isAbortError(err)) return
        setStatus('error')
      }
    }
    loadIndex()
    return () => { cancelled = true; controller.abort() }
  }, [enabled])

  // Fetch grid for selected altitude.
  useEffect(() => {
    if (!enabled || !selectedAltFt) return undefined
    const key = `ktg:${selectedAltFt}`
    if (cacheRef.current.has(key)) {
      setKtgGrid(cacheRef.current.get(key))
      setKtgGridKey(key)
      setStatus('ready')
      return undefined
    }
    const token = requestTokenRef.current + 1
    requestTokenRef.current = token
    const controller = new AbortController()
    async function loadGrid() {
      setStatus((prev) => (prev === 'ready' ? 'refreshing' : 'loading'))
      setKtgGridKey(null)
      try {
        const data = await fetchKtgGrid({ altFt: selectedAltFt }, { signal: controller.signal })
        if (requestTokenRef.current !== token || controller.signal.aborted) return
        cacheRef.current.set(key, data)
        setKtgGrid(data)
        setKtgGridKey(key)
        setStatus('ready')
      } catch (err) {
        if (isAbortError(err) || requestTokenRef.current !== token) return
        setKtgGrid(null)
        setKtgGridKey(null)
        setStatus('error')
      }
    }
    loadGrid()
    return () => controller.abort()
  }, [enabled, selectedAltFt])

  function setSelectedAltFt(altFt) {
    setSelectedAltFtState(altFt)
  }

  return {
    ktgGrid: ktgGridKey ? ktgGrid : null,
    altLevelsFt,
    selectedAltFt,
    setSelectedAltFt,
    status,
  }
}

export default useKtgTurbulence
