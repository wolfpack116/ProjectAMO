import { useCallback, useEffect, useState } from 'react'

import { getPlaybackDelayMs } from './weatherTimeline.js'
import { normalizeNwpTimes } from './timelineRailModel.js'

// Owns the unified timeline state (selected absolute time, play/pause, speed) and the playback loop.
// Lives in the weather-overlays feature module per ADR 0001 — MapView only renders the rail.
export function useTimelineRail() {
  const [selectedMs, setSelectedMs] = useState(null) // null = live (newest frame)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // User scrub pauses playback; programmatic playback advances via setSelectedMs directly.
  const scrub = useCallback((ms) => {
    setIsPlaying(false)
    setSelectedMs(Number.isFinite(ms) ? ms : null)
  }, [])

  const togglePlay = useCallback(() => setIsPlaying((prev) => !prev), [])

  return { selectedMs, setSelectedMs, scrub, isPlaying, togglePlay, speed, setSpeed }
}

// Advances selectedMs through the ordered frame times while playing. Separate hook so it can read
// the tick list produced after the overlay model runs, without adding effects to MapView.
export function useTimelinePlayback({ isPlaying, speed, pastTicksMs = [], nwpTimes = [], setSelectedMs }) {
  const ordered = buildOrderedTimes(pastTicksMs, nwpTimes)
  const orderedKey = ordered.join(',')

  useEffect(() => {
    if (!isPlaying || ordered.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setSelectedMs((prev) => {
        const currentIndex = Number.isFinite(prev) ? nearestIndex(ordered, prev) : ordered.length - 1
        const nextIndex = currentIndex >= ordered.length - 1 ? 0 : currentIndex + 1
        return ordered[nextIndex]
      })
    }, getPlaybackDelayMs(speed))
    return () => window.clearInterval(timer)
    // orderedKey captures tick-list changes without depending on a fresh array identity each render.
  }, [isPlaying, speed, orderedKey, setSelectedMs]) // eslint-disable-line react-hooks/exhaustive-deps
}

function buildOrderedTimes(pastTicksMs, nwpTimes) {
  const future = normalizeNwpTimes(nwpTimes).map((time) => time.ms)
  const all = [...(Array.isArray(pastTicksMs) ? pastTicksMs : []), ...future]
    .filter((ms) => Number.isFinite(ms))
  return [...new Set(all)].sort((a, b) => a - b)
}

function nearestIndex(list, ms) {
  let best = 0
  let bestDelta = Infinity
  list.forEach((value, index) => {
    const delta = Math.abs(value - ms)
    if (delta < bestDelta) {
      bestDelta = delta
      best = index
    }
  })
  return best
}
