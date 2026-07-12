import { plannedAltitudeRangeFt } from './planned-altitude.js'

export function classifyEncounter({ startNm, endNm, bandFt }, ctx) {
  if (!bandFt) return { encounter: 'nearby', verticalKnown: false }
  const { minFt, maxFt } = plannedAltitudeRangeFt(startNm, endNm, ctx.totalDistanceNm, ctx.cruiseAltitudeFt)
  const overlap = minFt <= bandFt.highFt && bandFt.lowFt <= maxFt
  return { encounter: overlap ? 'on' : 'nearby', verticalKnown: true }
}

export default { classifyEncounter }
