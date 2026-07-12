const CLIMB_FT_PER_NM = 600
const DESCENT_FT_PER_NM = 300
const M_TO_FT = 3.28084
const HIGH_FT = 99999

export function altitudeAtDistanceFt(distanceNm, totalDistanceNm, cruiseAltitudeFt) {
  const d = Number(distanceNm)
  const total = Number(totalDistanceNm)
  const cruise = Number(cruiseAltitudeFt)
  if (!(total > 0) || !(cruise > 0) || !Number.isFinite(d)) return 0
  return Math.max(0, Math.min(cruise, d * CLIMB_FT_PER_NM, (total - d) * DESCENT_FT_PER_NM))
}

export function plannedAltitudeRangeFt(startNm, endNm, totalDistanceNm, cruiseAltitudeFt) {
  const a = Math.max(0, Math.min(startNm, endNm))
  const b = Math.min(totalDistanceNm, Math.max(startNm, endNm))
  const N = 12
  let minFt = Infinity, maxFt = -Infinity
  for (let i = 0; i <= N; i += 1) {
    const d = a + ((b - a) * i) / N
    const alt = altitudeAtDistanceFt(d, totalDistanceNm, cruiseAltitudeFt)
    if (alt < minFt) minFt = alt
    if (alt > maxFt) maxFt = alt
  }
  return { minFt: Number.isFinite(minFt) ? minFt : 0, maxFt: Number.isFinite(maxFt) ? maxFt : 0 }
}

function limitToFt(value, uom) {
  if (value == null || !Number.isFinite(Number(value))) return null
  const v = Number(value)
  const u = String(uom || '').trim().toUpperCase()
  if (u === 'FL') return v * 100
  if (u === 'FT' || u === '[FT_I]') return v
  if (u === 'M') return v * M_TO_FT
  // uom 미상: 작은 값은 FL로 간주(SIGMET 관행), 큰 값은 ft
  return v < 1000 ? v * 100 : v
}

export function bandToFt(altitude) {
  if (!altitude) return null
  const lowFt = limitToFt(altitude.lower_fl, altitude.lower_uom)
  const highFt = limitToFt(altitude.upper_fl, altitude.upper_uom)
  if (lowFt == null && highFt == null) return null
  return { lowFt: lowFt == null ? 0 : lowFt, highFt: highFt == null ? HIGH_FT : highFt }
}

export default { altitudeAtDistanceFt, plannedAltitudeRangeFt, bandToFt }
