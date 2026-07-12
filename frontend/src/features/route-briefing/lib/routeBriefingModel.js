import { augmentRouteWithProcedures, buildVfrGeoJSON, calcVfrDistance, relabeledWaypoints } from './routePreview.js'

export const FIR_EXIT_AIRPORT = 'FIR_EXIT'
export const FIR_IN_AIRPORT = 'FIR_IN'
export const FIR_IN_ALLOWED_FIXES = new Set(['AGAVO', 'ANDOL', 'APELA', 'ATOTI', 'BEDAR', 'INVOK', 'KALEK', 'KANSU', 'LANAT', 'RUGMA', 'SAPRA'])
export const FIR_OUT_ALLOWED_FIXES = new Set(['AGAVO', 'ANDOL', 'APELA', 'ATOTI', 'BESNA', 'IGRAS', 'INVOK', 'KALEK', 'KANSU', 'LANAT', 'MUGUS', 'RUGMA', 'SAMDO', 'SAPRA'])
export const ROUTE_SEQUENCE_COLORS = {
  airport: '#0f172a',
  sid: '#2563eb',
  star: '#7c3aed',
  iap: '#0ea5e9',
  airway: '#f97316',
  enr: '#f97316',
  waypoint: '#0f766e',
}
export const M_TO_FT = 3.28084
export const BOUNDARY_FIX_FLOW_LABELS = {
  AGAVO: 'Westbound',
  ANDOL: 'Boundary',
  APELA: 'Southeastbound',
  ATOTI: 'Southwestbound',
  BEDAR: 'Southwestbound',
  BESNA: 'Southeastbound',
  IGRAS: 'Boundary',
  INVOK: 'Boundary',
  KALEK: 'Boundary',
  KANSU: 'Eastbound',
  LANAT: 'Eastbound',
  MUGUS: 'Southbound',
  RUGMA: 'Southwestbound',
  SAMDO: 'Southeastbound',
  SAPRA: 'Eastbound',
}

export function getWindDirection(metarData, airport) {
  const value = metarData?.airports?.[airport]?.observation?.wind?.direction
  return Number.isFinite(value) ? value : null
}

function getRunwayHeading(runwayGroup) {
  const match = String(runwayGroup ?? '').match(/(\d{2})/)
  if (!match) return null
  const runwayNumber = Number(match[1])
  if (!Number.isFinite(runwayNumber)) return null
  return (runwayNumber % 36) * 10
}

function getHeadingDifference(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(((a - b + 540) % 360) - 180)
}

export function pickBestRunwayGroup(runwayGroups, windDirection) {
  const unique = [...new Set((runwayGroups ?? []).filter(Boolean))]
  if (unique.length === 0) return null
  if (!Number.isFinite(windDirection)) return unique[0]
  return unique
    .map((runwayGroup) => ({
      runwayGroup,
      heading: getRunwayHeading(runwayGroup),
    }))
    .sort((a, b) => {
      const diffA = getHeadingDifference(a.heading, windDirection)
      const diffB = getHeadingDifference(b.heading, windDirection)
      if (diffA !== diffB) return diffA - diffB
      return (a.heading ?? 0) - (b.heading ?? 0)
    })[0]?.runwayGroup ?? unique[0]
}

export function filterProceduresByRunway(procedures, runwayGroup) {
  if (!runwayGroup) return procedures
  const filtered = procedures.filter((proc) => (proc.runways ?? []).includes(runwayGroup))
  return filtered.length > 0 ? filtered : procedures
}

export function chooseIapKeyForRunway(entry, iapData, runwayGroup) {
  const candidateKeys = entry?.candidateIapKeys ?? []
  if (candidateKeys.length === 0) return null
  if (!runwayGroup) return entry?.defaultIapKey ?? candidateKeys[0]
  return candidateKeys.find((key) =>
    getIapRunwayGroups(iapData?.iapRoutes?.[key]).includes(runwayGroup),
  ) ?? entry?.defaultIapKey ?? candidateKeys[0]
}

function getIapRunwayGroups(iapRoute) {
  return iapRoute?.representativeFor?.runwayGroup ?? iapRoute?.runways ?? []
}

export function formatBoundaryFixLabel(fix) {
  const flowLabel = BOUNDARY_FIX_FLOW_LABELS[fix]
  return flowLabel ? `${fix} (${flowLabel})` : fix
}

export function buildBoundaryFixOptions(routeDirectionMetadata) {
  const seen = new Set()
  const options = Object.values(routeDirectionMetadata?.routes ?? {})
    .flatMap((route) => route?.boundaryFixes ?? [])
    .map((fix) => ({
      value: fix,
      label: formatBoundaryFixLabel(fix),
    }))
    .filter((option) => {
      if (seen.has(option.value)) return false
      seen.add(option.value)
      return true
    })
    .sort((a, b) => a.value.localeCompare(b.value))

  return {
    firInOptions: options.filter((option) => FIR_IN_ALLOWED_FIXES.has(option.value)),
    firExitOptions: options.filter((option) => FIR_OUT_ALLOWED_FIXES.has(option.value)),
  }
}

export function buildIapCandidates(selectedStar, iapData, currentSelectedIapKey = null) {
  if (!selectedStar || !iapData) {
    return { candidates: [], selectedIapKey: null }
  }

  const entry = iapData.starToIapCandidates?.[selectedStar.id]
  if (!entry) {
    return { candidates: [], selectedIapKey: null }
  }

  const candidates = entry.candidateIapKeys.map((key) => ({
    key,
    label: `RWY ${getIapRunwayGroups(iapData.iapRoutes[key]).join(', ') || key}`,
  }))

  return {
    candidates,
    selectedIapKey: candidates.some(({ key }) => key === currentSelectedIapKey)
      ? currentSelectedIapKey
      : entry.defaultIapKey,
  }
}

export function buildVisibleSidOptions(sidOptions, availableSidIds) {
  if (!Array.isArray(availableSidIds)) return sidOptions
  return sidOptions.filter((proc) => availableSidIds.includes(proc.id))
}

export function getAirportElevationFt(airports, icao) {
  const airport = airports.find((item) => item.icao === icao || item.id === icao)
  const elevationFt = Number(
    airport?.elevationFt
    ?? airport?.elevation_ft
    ?? airport?.fieldElevationFt
    ?? airport?.field_elevation_ft
  )
  if (Number.isFinite(elevationFt) && elevationFt >= 0) return Math.round(elevationFt)

  const elevationM = Number(airport?.elevationM ?? airport?.elevation_m)
  if (Number.isFinite(elevationM) && elevationM >= 0) return Math.round(elevationM * M_TO_FT)

  return null
}

export function getVfrAirportAltitudeFt(airports, waypoint) {
  const storedElevationFt = Number(waypoint?.airportElevationFt)
  if (Number.isFinite(storedElevationFt) && storedElevationFt >= 0) return Math.round(storedElevationFt)
  return getAirportElevationFt(airports, waypoint?.id) ?? 0
}

// 불러온 좌표 배열을 수동 VFR 빌더(buildVfrRoute, routePlanner.js)와 동일한 shape의
// routeResult + vfrWaypoints로 변환한다. 끝점이 공항으로 스냅됐으면 fixed 경유점(공항
// 표고 포함) — 배너·현재·목적지 섹션이 정상 작동. 스냅 안 됐으면 일반 지점(중간 WP와
// 동일 취급) — 해당 공항 의존 섹션만 자연히 비게 된다(composeBriefing이 빈 ICAO를
// 안전하게 무시함, briefing-composer.js buildBanner 참고).
//
// 참고: previewGeojson은 VFR 지도 렌더링에 쓰이지 않는다(syncVfrWaypointData가
// vfrWaypoints에서 직접 그림, routePreviewSync.js) — 여기선 구조 일관성을 위해서만 채운다.
export function buildVfrRouteFromWaypoints(coords, { departureAirport = null, arrivalAirport = null, airports = [], waypointNames = null } = {}) {
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error('경로 점이 부족합니다')
  }

  const departureElevationFt = departureAirport ? getAirportElevationFt(airports, departureAirport) : null
  const arrivalElevationFt = arrivalAirport ? getAirportElevationFt(airports, arrivalAirport) : null

  const waypoints = relabeledWaypoints(coords.map(([lon, lat], index) => {
    const isFirst = index === 0
    const isLast = index === coords.length - 1
    if (isFirst && departureAirport) {
      return {
        id: departureAirport, uid: crypto.randomUUID(), lon, lat,
        fixed: true, airportElevationFt: departureElevationFt, altitudeFt: departureElevationFt ?? 0,
      }
    }
    if (isLast && arrivalAirport) {
      return {
        id: arrivalAirport, uid: crypto.randomUUID(), lon, lat,
        fixed: true, airportElevationFt: arrivalElevationFt, altitudeFt: arrivalElevationFt ?? 0,
      }
    }
    // 실제 EFB GPX route는 rtept마다 픽스 이름(예: AGAVO)을 싣는다 — 있으면 WPn 대신
    // 그 이름을 쓰고 relabeledWaypoints가 재번호를 매기지 않도록 named:true를 붙인다.
    const realName = waypointNames?.[index]?.trim()
    if (realName) {
      return { id: realName, uid: crypto.randomUUID(), lon, lat, fixed: false, named: true, altitudeFt: null }
    }
    return { id: `WP${index}`, uid: crypto.randomUUID(), lon, lat, fixed: false, altitudeFt: null }
  }))

  return {
    routeResult: {
      flightRule: 'VFR',
      departureAirport: departureAirport ?? '',
      arrivalAirport: arrivalAirport ?? '',
      distanceNm: calcVfrDistance(waypoints),
      previewGeojson: buildVfrGeoJSON(waypoints),
    },
    vfrWaypoints: waypoints,
  }
}

export function buildInitialVfrWaypoints(routeResult, airports) {
  const pts = routeResult?.previewGeojson?.features?.filter((f) => f.properties.role === 'route-preview-point') ?? []
  if (pts.length < 2) return []

  const departureElevationFt = getAirportElevationFt(airports, routeResult.departureAirport)
  const arrivalElevationFt = getAirportElevationFt(airports, routeResult.arrivalAirport)

  return [
    {
      id: routeResult.departureAirport,
      uid: crypto.randomUUID(),
      lon: pts[0].geometry.coordinates[0],
      lat: pts[0].geometry.coordinates[1],
      fixed: true,
      airportElevationFt: departureElevationFt,
      altitudeFt: departureElevationFt ?? 0,
    },
    {
      id: routeResult.arrivalAirport,
      uid: crypto.randomUUID(),
      lon: pts[1].geometry.coordinates[0],
      lat: pts[1].geometry.coordinates[1],
      fixed: true,
      airportElevationFt: arrivalElevationFt,
      altitudeFt: arrivalElevationFt ?? 0,
    },
  ]
}

export function buildIfrSequenceTokens(result, { selectedSid = null, selectedStar = null, selectedIap = null } = {}) {
  const seq = result?.displaySequence ?? []
  const airwayIds = new Set(result?.routeIds ?? [])
  const middleSeq = seq.slice(1, -1)
  const tokens = []

  const departureLabel = seq[0] ?? result?.departureAirport
  if (departureLabel) {
    tokens.push({ kind: 'airport', text: departureLabel })
  }

  if (selectedSid?.name) {
    tokens.push({ kind: 'sid', text: `SID(${selectedSid.name})` })
  }

  middleSeq.forEach((item) => {
    tokens.push({
      kind: airwayIds.has(item) ? 'airway' : 'waypoint',
      text: item,
    })
  })

  if (selectedStar?.name) {
    tokens.push({ kind: 'star', text: `STAR(${selectedStar.name})` })
  }

  if (selectedIap) {
    const iapName = selectedIap.sourceProcedure || selectedIap.fullName || selectedIap.name
    if (iapName) {
      tokens.push({ kind: 'iap', text: `IAP(${iapName})` })
    }
  }

  const arrivalLabel = result?.arrivalAirport || seq[seq.length - 1]
  if (arrivalLabel) {
    tokens.push({ kind: 'airport', text: arrivalLabel })
  }

  return tokens
}

export function buildIfrDistanceBreakdown({ routeResult, selectedSid = null, selectedStar = null, selectedIap = null }) {
  const airwayDist = Number(routeResult?.distanceNm || 0)
  const sidDist = Number(selectedSid?.fixes?.reduce((acc, f) => acc + (f.legDistanceNm || 0), 0) || 0)
  const starDist = Number(selectedStar?.fixes?.reduce((acc, f) => acc + (f.legDistanceNm || 0), 0) || 0)
  const iapDist = Number(selectedIap?.fixes?.reduce((acc, f) => acc + (f.legDistanceNm || 0), 0) || 0)
  const totalDistanceNm = Number((airwayDist + sidDist + starDist + iapDist).toFixed(1))
  const items = [
    { kind: 'sid', label: 'SID', value: sidDist },
    { kind: 'enr', label: 'ENR', value: airwayDist },
    { kind: 'star', label: 'STAR', value: starDist },
    { kind: 'iap', label: 'IAP', value: iapDist },
  ].filter((item) => item.value > 0)

  return { totalDistanceNm, items }
}

export function getCurrentRouteLineString({ routeResult, vfrWaypoints = [], selectedSid = null, selectedStar = null, selectedIap = null }) {
  if (!routeResult) return null

  if (routeResult.flightRule === 'VFR') {
    if (vfrWaypoints.length < 2) return null
    return {
      type: 'LineString',
      coordinates: vfrWaypoints.map((wp) => [wp.lon, wp.lat]),
    }
  }

  const displayGeojson = augmentRouteWithProcedures(routeResult.previewGeojson, selectedSid, selectedStar, selectedIap)
  const lineFeature = displayGeojson.features.find((feature) => feature.properties.role === 'route-preview-line')
  return lineFeature?.geometry ?? null
}

export function buildRoutePreviewModel(routeState) {
  const {
    routeForm,
    routeResult,
    vfrWaypoints,
    selectedSid,
    selectedStar,
    selectedIap,
    navpointsById,
  } = routeState
  const isFirInMode = routeForm?.flightRule === 'IFR' && routeForm?.departureAirport === FIR_IN_AIRPORT
  const isFirExitMode = routeForm?.flightRule === 'IFR' && routeForm?.arrivalAirport === FIR_EXIT_AIRPORT
  const selectedBoundaryFix =
    (isFirInMode && routeForm?.entryFix) ||
    (isFirExitMode && routeForm?.exitFix) ||
    null

  return {
    routeResult,
    vfrWaypoints,
    selectedSid,
    selectedStar,
    selectedIap,
    selectedBoundaryFix,
    selectedBoundaryNavpoint: selectedBoundaryFix ? navpointsById?.[selectedBoundaryFix] : null,
  }
}
