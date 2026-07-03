// 외부 경로 파일(GeoJSON/GPX/KML)을 우리 VFR 경유점 파이프라인이 먹을 수 있는
// [lon,lat] 좌표 배열로 바꾸는 순수 함수 모음. UI/상태 없음 — useRouteBriefing이 호출한다.
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
import { DOMParser as NodeDOMParser } from '@xmldom/xmldom'
import { greatCircleNm } from './routePreview.js'

// 브라우저는 전역 DOMParser를 우선 쓰고, 전역이 없는 환경(node --test)에선 xmldom로
// 폴백한다. 두 구현 모두 표준 DOM Level 1 API(getElementsByTagName·getAttribute·
// textContent)를 지원하므로 이후 코드는 어느 쪽이 만든 doc인지 신경 쓸 필요 없다.
function getDomParserCtor() {
  return typeof DOMParser !== 'undefined' ? DOMParser : NodeDOMParser
}

// 지도 maxBounds(frontend/src/features/map/mapConfig.js MAP_CONFIG.maxBounds)와 동일한
// 한국 FIR 근사 경계. 숫자 4개뿐이라 별도 import로 feature 간 결합을 만들지 않고 값만 미러링.
const KOREA_FIR_BOUNDS = { minLon: 116, maxLon: 139, minLat: 26, maxLat: 44 }

export function isWithinKoreaFir(lon, lat) {
  return (
    Number.isFinite(lon) && Number.isFinite(lat) &&
    lon >= KOREA_FIR_BOUNDS.minLon && lon <= KOREA_FIR_BOUNDS.maxLon &&
    lat >= KOREA_FIR_BOUNDS.minLat && lat <= KOREA_FIR_BOUNDS.maxLat
  )
}

function detectFileKind(name) {
  const ext = String(name ?? '').toLowerCase().split('.').pop()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'kml') return 'kml'
  return 'geojson'
}

// 파일 텍스트 → 중간 표현. GeoJSON은 그대로 파싱, GPX는 DOM(다음 스텝에서 후보 추출 시
// 직접 순회), KML은 togeojson으로 변환. GPX/KML 파싱 실패(malformed XML) 감지는 이 계획
// 범위 밖 — 브라우저 DOMParser는 malformed XML에서도 예외를 던지지 않고 <parsererror>
// 요소를 문서에 심는 방식이라, xmldom과 동일하게 동작을 보장할 테스트가 없는 채로 감지
// 로직만 넣는 건 미검증 코드가 된다(YAGNI). 필요해지면 전용 테스트와 함께 추가한다.
export function parseRouteFile(name, text) {
  const kind = detectFileKind(name)
  if (kind === 'geojson') {
    let geojson
    try {
      geojson = JSON.parse(text)
    } catch {
      throw new Error('파일을 읽을 수 없습니다 (GeoJSON/GPX/KML 확인)')
    }
    return { format: 'geojson', geojson }
  }
  const Ctor = getDomParserCtor()
  const doc = new Ctor().parseFromString(text, 'text/xml')
  if (kind === 'gpx') return { format: 'gpx', doc }
  return { format: 'kml', geojson: kmlToGeoJSON(doc) }
}

function extractGeoJsonPaths(geojson) {
  const candidates = []
  const features = geojson?.type === 'FeatureCollection' ? geojson.features : [geojson]
  let routeIdx = 0
  const pointCoords = []
  for (const feature of features ?? []) {
    const geom = feature?.geometry
    if (!geom) continue
    if (geom.type === 'LineString' && geom.coordinates?.length >= 2) {
      routeIdx += 1
      candidates.push({ label: feature.properties?.name || `경로 ${routeIdx}`, kind: 'route', coords: geom.coordinates })
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates ?? []) {
        if (line.length >= 2) {
          routeIdx += 1
          candidates.push({ label: feature.properties?.name || `경로 ${routeIdx}`, kind: 'route', coords: line })
        }
      }
    } else if (geom.type === 'Point' && geom.coordinates?.length === 2) {
      pointCoords.push(geom.coordinates)
    }
  }
  if (candidates.length === 0 && pointCoords.length >= 2) {
    candidates.push({ label: '지점 모음', kind: 'points', coords: pointCoords })
  }
  return candidates
}

function coordsFromGpxPoints(nodeList) {
  return Array.from(nodeList)
    .map((el) => [Number(el.getAttribute('lon')), Number(el.getAttribute('lat'))])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
}

function extractGpxPaths(doc) {
  const candidates = []
  const rtes = Array.from(doc.getElementsByTagName('rte'))
  rtes.forEach((rte, i) => {
    const coords = coordsFromGpxPoints(rte.getElementsByTagName('rtept'))
    if (coords.length >= 2) {
      const nameEl = rte.getElementsByTagName('name')[0]
      candidates.push({ label: nameEl?.textContent?.trim() || `경로 ${i + 1}`, kind: 'route', coords })
    }
  })
  const trks = Array.from(doc.getElementsByTagName('trk'))
  trks.forEach((trk, i) => {
    const coords = coordsFromGpxPoints(trk.getElementsByTagName('trkpt'))
    if (coords.length >= 2) {
      const nameEl = trk.getElementsByTagName('name')[0]
      candidates.push({ label: nameEl?.textContent?.trim() || `궤적 ${i + 1}`, kind: 'track', coords })
    }
  })
  if (candidates.length === 0) {
    const wpts = coordsFromGpxPoints(doc.getElementsByTagName('wpt'))
    if (wpts.length >= 2) candidates.push({ label: '지점 모음', kind: 'points', coords: wpts })
  }
  return candidates
}

// parseRouteFile의 결과에서 "선택 가능한 경로 후보" 목록을 뽑는다. 파일에 경로가
// 여러 개면 전부 반환 — 고르는 건 호출부(useRouteBriefing) 책임.
export function extractRoutePaths(parsed) {
  if (parsed.format === 'gpx') return extractGpxPaths(parsed.doc)
  return extractGeoJsonPaths(parsed.geojson)
}

export function simplifyRoute(coords, maxPts = 20) {
  return coords
}

export function snapEndpointsToAirports(coords, airports, thresholdNm = 5) {
  return { departureAirport: null, arrivalAirport: null }
}
