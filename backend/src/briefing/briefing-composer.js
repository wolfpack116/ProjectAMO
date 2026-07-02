import { summarizeAirport } from './airport-summary.js'
import { levelForCategory, to3Level } from './flight-category.js'
import { buildDestination } from './taf-window.js'
import { buildHazardSection } from './hazard-section.js'
import { buildRouteAxis } from './route-axis.js'
import { timeWindowsOverlap } from './geo-time-match.js'

function airportRoles(request) {
  const roles = [
    { role: 'departure', icao: request.departureAirport },
    { role: 'arrival', icao: request.arrivalAirport },
  ]
  if (request.alternateAirport) roles.push({ role: 'alternate', icao: request.alternateAirport })
  return roles
}

const ROLE_LABEL = { departure: '출발', arrival: '도착', alternate: '교체' }

// 공항경보(AIRPORT_WARNINGS) → adverse hazard 유사 shape. 경로 지오 없음(공항 스코프),
// dep/arr/alt ICAO + ETD~ETA 시간 겹침만. WIND_SHEAR는 red, 그 외 amber.
function buildAirportWarningHazards(warningData, roles, etd, eta) {
  const byIcao = warningData?.airports ?? {}
  const out = []
  for (const { role, icao } of roles) {
    for (const w of (byIcao[icao]?.warnings ?? [])) {
      // 유효시간 있으면 겹칠 때만, 없으면 포함(누락 방지).
      if (w.valid_start && w.valid_end && !timeWindowsOverlap(etd, eta, w.valid_start, w.valid_end)) continue
      out.push({
        source: '공항경보',
        code: w.wrng_type_key,
        label: w.wrng_type_name || w.wrng_type_key,
        validFrom: w.valid_start,
        validTo: w.valid_end,
        encounter: 'on',
        verticalKnown: true,
        bandFt: null,
        routeIntervalNm: null,
        airportScope: icao,
        role,
        level: w.wrng_type_key === 'WIND_SHEAR' ? 'red' : 'amber',
      })
    }
  }
  return out
}
const CAT_RANK = { VFR: 0, IFR: 1, LIFR: 2 } // 3레벨 표시 기준(MVFR fold 후)

// Go/No-go 배너: 실측 METAR 있는 공항 중 최악(3레벨) + 이유(운고/시정), 공항별 3레벨 체인.
function buildBanner(airports) {
  const scored = airports
    .filter((a) => a.category && a.category !== 'UNKNOWN')
    .map((a) => ({ icao: a.icao, role: a.role, category: to3Level(a.category), driver: a.driver }))
  if (scored.length === 0) return { worst: null, airports: [] }
  const worst = scored.reduce((acc, x) => ((CAT_RANK[x.category] ?? -1) > (CAT_RANK[acc.category] ?? -1) ? x : acc))
  return { worst, airports: scored }
}

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
    airportWarnings: buildAirportWarningHazards(data?.warning, airportRoles(request), request.etd, request.eta),
  })

  const amosByIcao = data?.amos?.airports ?? {}
  const takeoffByIcao = data?.takeoff_fcst?.airports ?? {}
  const airports = airportRoles(request).map(({ role, icao }) => ({
    ...summarizeAirport(role, metarByIcao[icao] ?? { header: { icao } }),
    amos: amosByIcao[icao] ?? null, // ② 도착 행 확장(AMOS 지상실황) — 프론트에서 buildAmosConsoleModel 재사용
    takeoffFcst: takeoffByIcao[icao] ?? null, // ② 출발 행 확장(이륙예보 매시 wd/ws/ta/qnh)
  }))

  const banner = buildBanner(airports)

  const arrivalTaf = tafByIcao[request.arrivalAirport] ?? null
  const alternateTaf = request.alternateAirport ? (tafByIcao[request.alternateAirport] ?? null) : null
  const destination = buildDestination(arrivalTaf, request.eta, { alternateTaf, alternateIcao: request.alternateAirport ?? null, flightRule: request.flightRule })
  destination.level = destination.category ? levelForCategory(destination.category) : 'gray'

  // 경로 조우만(공항경보는 경로 지오 없음 → enroute encounters 제외).
  const encounters = adverse.hazards.filter((h) => h.encounter === 'on' && !h.airportScope)
  const enroute = {
    // adverse와 동일한 보수 레벨을 따른다(밴드 미상 SIGMET이 ④에서만 amber로 새지 않도록).
    level: adverse.level,
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
    banner,
    sections: { adverse, enroute, current: { airports }, destination },
    warnings: [],
  }
}

export default { composeBriefing }
