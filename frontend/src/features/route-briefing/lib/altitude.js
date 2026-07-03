// Incheon FIR (RKRR) transition altitude is 14,000 ft / FL140 per the Korean AIP.
const TRANSITION_FT = 14000
// Single FIR-wide approximation of west magnetic variation. 2026 declination
// across RKRR runs ~8.3°W (Busan/Jeju) to ~9.0°W (Seoul/Incheon), mean ~8.6°W;
// 8.5 is representative. Only used for the VFR odd/even cruise hint, which is
// insensitive to the sub-degree spread, so a per-location value isn't warranted.
const MAG_VAR_DEG = 8.5

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

// 방향(자북코스)에 맞는, 현재 고도에서 가장 가까운 VFR 순항고도.
// 동쪽(0–179°)=홀수천+500(3,500/5,500/…), 서쪽(180–359°)=짝수천+500(4,500/6,500/…).
export function nearestVfrCruiseAltitude(currentFt, magCourseDeg) {
  const eastbound = (((Number(magCourseDeg) % 360) + 360) % 360) < 180
  const base = Math.max(500, Number(currentFt) || 0)
  let k = Math.round((base - 500) / 1000) // '천 단위' 인덱스 (해당 고도 = k*1000+500)
  const isOdd = (((k % 2) + 2) % 2) === 1
  if (isOdd !== eastbound) {
    // 패리티 불일치 → k±1 중 현재고도에 더 가까운 쪽(둘 다 올바른 패리티)
    const down = k - 1
    const up = k + 1
    k = Math.abs(base - (down * 1000 + 500)) <= Math.abs(base - (up * 1000 + 500)) ? down : up
  }
  return Math.max(eastbound ? 3500 : 4500, k * 1000 + 500)
}

// minFt(예: 지형고도+안전마진) 이상인 규정 고도 중 가장 낮은 값으로 "올림"한다.
// nearestVfrCruiseAltitude와 달리 아래로 내려가지 않는다 — 지형 여유가 목적이라
// "가까운 값"이 아니라 "기준선을 절대 못 내려가는 최소값"이어야 한다.
export function minVfrCruiseAltitude(minFt, magCourseDeg) {
  const eastbound = (((Number(magCourseDeg) % 360) + 360) % 360) < 180
  const base = Math.max(500, Number(minFt) || 0)
  let k = Math.ceil((base - 500) / 1000) // base 이상이 되는 가장 작은 k
  const isOdd = (((k % 2) + 2) % 2) === 1
  if (isOdd !== eastbound) k += 1 // 패리티 불일치는 위로만 보정(아래로 가면 기준선 밑으로 떨어짐)
  return Math.max(eastbound ? 3500 : 4500, k * 1000 + 500)
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
