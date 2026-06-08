export function parseKstTmToMs(value) {
  const raw = String(value || '').trim()
  if (!/^\d{12}$/.test(raw)) return null
  return Date.UTC(
    Number(raw.slice(0, 4)),
    Number(raw.slice(4, 6)) - 1,
    Number(raw.slice(6, 8)),
    Number(raw.slice(8, 10)) - 9,
    Number(raw.slice(10, 12)),
  )
}

export function formatKstMinute(valueMs, tz = 'KST') {
  if (!Number.isFinite(valueMs)) return '--:--'
  const offset = tz === 'KST' ? 9 * 60 * 60 * 1000 : 0
  const d = new Date(valueMs + offset)
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hour = String(d.getUTCHours()).padStart(2, '0')
  const minute = String(d.getUTCMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute} ${tz}`
}

export function normalizeFrame(frame) {
  const timeMs = parseKstTmToMs(frame?.tm)
  return Number.isFinite(timeMs) ? { ...frame, timeMs } : null
}

export function normalizeFrames(frames) {
  return (Array.isArray(frames) ? frames : [])
    .map(normalizeFrame)
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs)
}

export function pickNearestPreviousFrame(frames, selectedTimeMs) {
  if (!frames.length || !Number.isFinite(selectedTimeMs)) return null
  let selected = null
  for (const frame of frames) {
    if (frame.timeMs <= selectedTimeMs) selected = frame
    else break
  }
  return selected || frames[0]
}

export function buildTimelineTicks(layerFrames) {
  const values = new Set()
  layerFrames.forEach((frames) => frames.forEach((frame) => values.add(frame.timeMs)))
  return [...values].sort((a, b) => a - b)
}

export function getPlaybackDelayMs(speed) {
  const value = Number(speed)
  return Number.isFinite(value) && value > 0 ? Math.round(800 / value) : 800
}

export function shouldUpdateWeatherTimelineSelection(eventType) {
  return ['input', 'change'].includes(eventType)
}
