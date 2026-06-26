import { summarizeAirport } from './airport-summary.js'
import { levelForCategory } from './flight-category.js'
import { selectTafAtEta, alternateRequired } from './taf-window.js'
import { buildHazardSection } from './hazard-section.js'
import { buildRouteAxis } from './route-axis.js'

function airportRoles(request) {
  const roles = [
    { role: 'departure', icao: request.departureAirport },
    { role: 'arrival', icao: request.arrivalAirport },
  ]
  if (request.alternateAirport) roles.push({ role: 'alternate', icao: request.alternateAirport })
  return roles
}

const ROLE_LABEL = { departure: '출발', arrival: '도착', alternate: '교체' }

export function composeBriefing(request, data) {
  const metarByIcao = data?.metar?.airports ?? {}
  const tafByIcao = data?.taf?.airports ?? {}

  const axis = buildRouteAxis(request.routeGeometry, 2000)
  const cruiseAltitudeFt = Number(request.plannedCruiseAltitudeFt) || 0

  const adverse = buildHazardSection({
    sigmet: data?.sigmet?.items ?? [],
    airmet: data?.airmet?.items ?? [],
    axis,
    etd: request.etd,
    eta: request.eta,
    cruiseAltitudeFt,
  })

  const airports = airportRoles(request).map(({ role, icao }) =>
    summarizeAirport(role, metarByIcao[icao] ?? { header: { icao } }))

  const arrivalTaf = tafByIcao[request.arrivalAirport] ?? null
  const tafAtEta = selectTafAtEta(arrivalTaf, request.eta)
  const alt = request.flightRule === 'IFR'
    ? alternateRequired(arrivalTaf, request.eta)
    : { required: null, reason: 'VFR' }
  const destination = {
    level: tafAtEta ? levelForCategory(tafAtEta.category) : 'gray',
    taf: tafAtEta,
    alternateRequired: alt.required,
    alternateReason: alt.reason,
  }

  const encounters = adverse.hazards.filter((h) => h.encounter === 'on')
  const enroute = {
    level: encounters.length > 0 ? 'red' : adverse.hazards.length > 0 ? 'amber' : 'green',
    plannedCruiseAltitudeFt: cruiseAltitudeFt,
    encounters,
    crossSectionAvailable: true,
  }

  const summary = [
    { key: 'hazard', label: '위험', level: adverse.level },
    ...airports.map((a) => ({ key: a.icao, label: `${ROLE_LABEL[a.role]} ${a.icao}`, level: a.level })),
  ]

  return {
    meta: {
      departureAirport: request.departureAirport,
      arrivalAirport: request.arrivalAirport,
      alternateAirport: request.alternateAirport ?? null,
      flightRule: request.flightRule,
      etd: request.etd,
      eta: request.eta,
      generatedAt: new Date().toISOString(),
    },
    summary,
    sections: { adverse, enroute, current: { airports }, destination },
    warnings: [],
  }
}

export default { composeBriefing }
