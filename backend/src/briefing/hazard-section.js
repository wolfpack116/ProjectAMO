import { routeIntersectsGeometry, timeWindowsOverlap } from './geo-time-match.js'

function matchItems(items, source, ctx) {
  return (items ?? [])
    .filter((it) => it?.geometry && it.valid_from && it.valid_to)
    .filter((it) => timeWindowsOverlap(ctx.etd, ctx.eta, it.valid_from, it.valid_to))
    .filter((it) => routeIntersectsGeometry(ctx.routeGeometry, it.geometry))
    .map((it) => ({
      source,
      code: it.phenomenon_code,
      label: it.phenomenon_label || it.phenomenon_code,
      validFrom: it.valid_from,
      validTo: it.valid_to,
      onRoute: true,
    }))
}

export function buildHazardSection({ sigmet, airmet, routeGeometry, etd, eta }) {
  const ctx = { routeGeometry, etd, eta }
  const hazards = [
    ...matchItems(sigmet, 'SIGMET', ctx),
    ...matchItems(airmet, 'AIRMET', ctx),
  ]
  const hasSigmet = hazards.some((h) => h.source === 'SIGMET')
  const level = hasSigmet ? 'red' : hazards.length > 0 ? 'amber' : 'green'
  return { level, hazards }
}

export default { buildHazardSection }
