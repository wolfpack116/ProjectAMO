import { altitudeAtDistanceFt } from './planned-altitude.js'

const KT_PER_MS = 1.94384
const LEVEL_RANK = { '약': 1, '중': 2, '심': 3 }

function sortedLevels(levels) {
  return [...(levels ?? [])]
    .filter((L) => Number.isFinite(L.altFt) && Array.isArray(L.values))
    .sort((a, b) => a.altFt - b.altFt)
}

// 각 거리 샘플에서 계획고도 alt(d)에 해당하는 값을 두 기압면 사이에서 구한다.
// mode 'worst': 위험 등급(착빙/난류) → 두 레벨 중 큰 값. mode 'interp': 연속값(바람/기온) → 선형 보간.
// nullOutside: 계획고도가 레벨 커버리지 밖이면 null(저고도 한정 KTG용).
function seriesAtAltitude(levels, totalDistanceNm, cruiseAltitudeFt, pick, { mode = 'interp', nullOutside = false } = {}) {
  const sorted = sortedLevels(levels)
  if (sorted.length === 0) return []
  const minAlt = sorted[0].altFt
  const maxAlt = sorted[sorted.length - 1].altFt
  const n = sorted[0].values.length
  const out = []
  for (let i = 0; i < n; i += 1) {
    const d = sorted[0].values[i]?.distanceNm
    const alt = altitudeAtDistanceFt(d, totalDistanceNm, cruiseAltitudeFt)
    if (nullOutside && (alt < minAlt || alt > maxAlt)) { out.push({ distanceNm: d, value: null }); continue }
    let lo = sorted[0]
    let hi = sorted[sorted.length - 1]
    for (let k = 0; k < sorted.length - 1; k += 1) {
      if (sorted[k].altFt <= alt && alt <= sorted[k + 1].altFt) { lo = sorted[k]; hi = sorted[k + 1]; break }
    }
    const vLo = pick(lo.values[i])
    const vHi = pick(hi.values[i])
    let val
    if (vLo == null && vHi == null) {
      val = null
    } else if (mode === 'worst') {
      val = Math.max(vLo ?? -Infinity, vHi ?? -Infinity)
    } else if (vLo == null) {
      val = vHi
    } else if (vHi == null) {
      val = vLo
    } else {
      const span = hi.altFt - lo.altFt
      const w = span > 0 ? Math.max(0, Math.min(1, (alt - lo.altFt) / span)) : 0
      val = vLo + (vHi - vLo) * w
    }
    out.push({ distanceNm: d, value: Number.isFinite(val) ? val : null })
  }
  return out
}

function roundInterval(iv) {
  return { startNm: Math.round(iv.startNm), endNm: Math.round(iv.endNm), level: iv.level }
}

function thresholdIntervals(series, classify) {
  const intervals = []
  let cur = null
  for (const p of series) {
    const lvl = p.value == null ? null : classify(p.value)
    if (lvl) {
      if (!cur) cur = { startNm: p.distanceNm, endNm: p.distanceNm, level: lvl }
      else { cur.endNm = p.distanceNm; if (LEVEL_RANK[lvl] > LEVEL_RANK[cur.level]) cur.level = lvl }
    } else if (cur) {
      intervals.push(roundInterval(cur)); cur = null
    }
  }
  if (cur) intervals.push(roundInterval(cur))
  return intervals
}

// 착빙 등급(정수)·KTG(EDR형). 임계값은 실측 분포 기반의 보수적 근사 — 추후 튜닝 대상.
function classifyIcing(g) { return g >= 3 ? '심' : g >= 2 ? '중' : g >= 1 ? '약' : null }
function classifyKtg(v) { return v >= 0.45 ? '심' : v >= 0.30 ? '중' : v >= 0.15 ? '약' : null }

function peak(series) { let best = null; for (const p of series) if (p.value != null && (!best || p.value > best.value)) best = p; return best }
function trough(series) { let best = null; for (const p of series) if (p.value != null && (!best || p.value < best.value)) best = p; return best }

export function summarizeEnrouteModel({ crossSection, turbulence, totalDistanceNm, cruiseAltitudeFt }) {
  const elements = []
  const kim = crossSection?.levels ?? []
  if (kim.length) {
    const icing = thresholdIntervals(
      seriesAtAltitude(kim, totalDistanceNm, cruiseAltitudeFt, (e) => e?.icing, { mode: 'worst' }),
      classifyIcing,
    )
    if (icing.length) elements.push({ kind: 'icing', label: '착빙 가능성', intervals: icing })

    const wind = peak(seriesAtAltitude(
      kim, totalDistanceNm, cruiseAltitudeFt,
      (e) => (e?.u != null && e?.v != null) ? Math.hypot(e.u, e.v) * KT_PER_MS : null,
      { mode: 'interp' },
    ))
    if (wind) elements.push({ kind: 'wind', label: '순항 바람(최대)', valueKt: Math.round(wind.value), atNm: Math.round(wind.distanceNm) })

    const temp = trough(seriesAtAltitude(kim, totalDistanceNm, cruiseAltitudeFt, (e) => e?.t, { mode: 'interp' }))
    if (temp) elements.push({ kind: 'temp', label: '순항 기온(최저)', valueC: Math.round(temp.value) })
  }
  const ktg = turbulence?.levels ?? []
  if (ktg.length) {
    const turb = thresholdIntervals(
      seriesAtAltitude(ktg, totalDistanceNm, cruiseAltitudeFt, (e) => e?.ktg, { mode: 'worst', nullOutside: true }),
      classifyKtg,
    )
    if (turb.length) elements.push({ kind: 'turbulence', label: '난류', intervals: turb })
  }
  return { elements }
}

export default { summarizeEnrouteModel }
