import { routeIntervalInGeometry, timeWindowsOverlap } from './geo-time-match.js'
import { bandToFt } from './planned-altitude.js'
import { classifyEncounter } from './hazard-matcher.js'

function matchItems(items, source, ctx) {
  const out = []
  for (const it of (items ?? [])) {
    if (!it?.geometry || !it.valid_from || !it.valid_to) continue
    if (!timeWindowsOverlap(ctx.etd, ctx.eta, it.valid_from, it.valid_to)) continue
    const interval = routeIntervalInGeometry(ctx.axis, it.geometry)
    if (!interval.entered) continue
    const bandFt = bandToFt(it.altitude)
    const { encounter, verticalKnown } = classifyEncounter(
      { startNm: interval.startNm, endNm: interval.endNm, bandFt },
      { totalDistanceNm: ctx.axis?.totalDistanceNm, cruiseAltitudeFt: ctx.cruiseAltitudeFt },
    )
    out.push({
      source,
      code: it.phenomenon_code,
      label: it.phenomenon_label || it.phenomenon_code,
      validFrom: it.valid_from,
      validTo: it.valid_to,
      onRoute: true,
      encounter,
      verticalKnown,
      bandFt,
      routeIntervalNm: { startNm: interval.startNm, endNm: interval.endNm },
    })
  }
  return out
}

// 보수적 위험별 레벨: SIGMET은 red, 단 "수직 확인되고 내 고도 밖(nearby)"이면 amber로만 완화.
// 밴드 미상 SIGMET(verticalKnown=false)은 under-alarm 금지로 red 유지. AIRMET은 항상 amber.
function hazardLevel(h) {
  if (h.source === 'SIGMET') return (h.verticalKnown && h.encounter === 'nearby') ? 'amber' : 'red'
  return 'amber'
}
const LEVEL_RANK = { green: 0, amber: 1, red: 2 }

export function buildHazardSection({ sigmet, airmet, axis, etd, eta, cruiseAltitudeFt }) {
  const ctx = { axis, etd, eta, cruiseAltitudeFt }
  const hazards = [
    ...matchItems(sigmet, 'SIGMET', ctx),
    ...matchItems(airmet, 'AIRMET', ctx),
  ]
  const level = hazards.reduce(
    (acc, h) => (LEVEL_RANK[hazardLevel(h)] > LEVEL_RANK[acc] ? hazardLevel(h) : acc),
    'green',
  )
  return { level, hazards }
}

export default { buildHazardSection }
