const TRANSITION_FT = 14000
const MAG_VAR_DEG = 8 // Korea ~8°W; magnetic = true + west variation

export function formatAltitude(ft) {
  const n = Number(ft)
  if (!Number.isFinite(n)) return '—'
  if (n >= TRANSITION_FT) return `FL${Math.round(n / 100)}`
  return `${Math.round(n).toLocaleString()} ft`
}

export function stepAltitude(ft, dir) {
  const base = Math.round(Number(ft) / 500) * 500
  return Math.max(0, base + dir * 500)
}

export function vfrCruiseHint(magCourseDeg) {
  const c = ((Number(magCourseDeg) % 360) + 360) % 360
  return c < 180
    ? 'VFR 권장: 홀수천 + 500 ft (예: 9,500)'
    : 'VFR 권장: 짝수천 + 500 ft (예: 8,500)'
}

export function initialBearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function magneticCourse(trueCourseDeg) {
  return ((Number(trueCourseDeg) + MAG_VAR_DEG) % 360 + 360) % 360
}
