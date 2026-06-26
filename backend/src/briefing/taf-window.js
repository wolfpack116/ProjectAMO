import { categoryFor } from './flight-category.js'
import { ceilingFromClouds } from './airport-summary.js'

function entryMetrics(entry) {
  const visibilityM = entry.visibility?.cavok ? 9999 : entry.visibility?.value
  const ceilingFt = ceilingFromClouds(entry.clouds)
  return { visibilityM, ceilingFt }
}

export function selectTafAtEta(taf, etaIso) {
  const timeline = taf?.timeline ?? []
  if (timeline.length === 0) return null
  const eta = Date.parse(etaIso)
  if (!Number.isFinite(eta)) return null

  let best = null
  for (const entry of timeline) {
    const t = Date.parse(entry.time)
    if (!Number.isFinite(t)) continue
    const delta = Math.abs(t - eta)
    if (!best || delta < best.delta) {
      const { visibilityM, ceilingFt } = entryMetrics(entry)
      best = { delta, entry: { time: entry.time, ...entry.display, category: categoryFor({ visibilityM, ceilingFt }) } }
    }
  }
  return best?.entry ?? null
}

// 1-2-3 근사: ETA ±1h 구간에서 운고<2000ft 또는 시정<5000m이면 교체공항 필요.
export function alternateRequired(taf, etaIso) {
  const timeline = taf?.timeline ?? []
  const eta = Date.parse(etaIso)
  if (timeline.length === 0 || !Number.isFinite(eta)) return { required: null, reason: 'TAF 없음' }
  const windowMs = 60 * 60 * 1000

  for (const entry of timeline) {
    const t = Date.parse(entry.time)
    if (!Number.isFinite(t) || Math.abs(t - eta) >= windowMs) continue
    const { visibilityM, ceilingFt } = entryMetrics(entry)
    const lowCeiling = Number.isFinite(ceilingFt) && ceilingFt < 2000
    const lowVis = Number.isFinite(visibilityM) && visibilityM < 5000
    if (lowCeiling || lowVis) {
      return { required: true, reason: 'ETA±1h 운고<2000ft 또는 시정<5000m' }
    }
  }
  return { required: false, reason: 'ETA±1h 최저치 충족' }
}

export default { selectTafAtEta, alternateRequired }
