export function computeEtaIso(etdIso, distanceNm, speedKt) {
  const etd = Date.parse(etdIso)
  const d = Number(distanceNm)
  const v = Number(speedKt)
  if (!Number.isFinite(etd) || !(d > 0) || !(v > 0)) return null
  const ms = (d / v) * 3600 * 1000
  return new Date(etd + ms).toISOString().replace('.000Z', 'Z')
}
