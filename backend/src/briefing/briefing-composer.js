import { summarizeAirport } from './airport-summary.js'
import { selectTafAtEta, alternateRequired } from './taf-window.js'
import { buildHazardSection } from './hazard-section.js'

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

  const adverse = buildHazardSection({
    sigmet: data?.sigmet?.items ?? [],
    airmet: data?.airmet?.items ?? [],
    routeGeometry: request.routeGeometry,
    etd: request.etd,
    eta: request.eta,
  })

  const airports = airportRoles(request).map(({ role, icao }) =>
    summarizeAirport(role, metarByIcao[icao] ?? { header: { icao } }))

  const arrivalTaf = tafByIcao[request.arrivalAirport] ?? null
  const tafAtEta = selectTafAtEta(arrivalTaf, request.eta)
  const alt = request.flightRule === 'IFR'
    ? alternateRequired(arrivalTaf, request.eta)
    : { required: null, reason: 'VFR' }
  const destination = {
    level: tafAtEta ? (tafAtEta.category === 'VFR' ? 'green' : tafAtEta.category === 'MVFR' ? 'amber' : 'red') : 'gray',
    taf: tafAtEta,
    alternateRequired: alt.required,
    alternateReason: alt.reason,
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
    sections: { adverse, current: { airports }, destination },
    warnings: [],
  }
}

export default { composeBriefing }
