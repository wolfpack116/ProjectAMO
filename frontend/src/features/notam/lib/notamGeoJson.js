import { deriveTimeState, formatAltitude } from './notamViewModel.js'

// "DDMMSS[.s]N DDDMMSS[.s]E" (NOTAM E)본문 PSN) → [lon,lat]. 못 읽으면 null.
export function parsePsnPoint(text) {
  const m = String(text || '').match(/(\d{2})(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])\D{0,4}(\d{3})(\d{2})(\d{2}(?:\.\d+)?)\s*([EW])/)
  if (!m) return null
  const lat = (Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600) * (m[4] === 'S' ? -1 : 1)
  const lon = (Number(m[5]) + Number(m[6]) / 60 + Number(m[7]) / 3600) * (m[8] === 'W' ? -1 : 1)
  return (Number.isFinite(lat) && Number.isFinite(lon)) ? [lon, lat] : null
}

function centroid(geometry) {
  const pts = []
  if (geometry?.type === 'Point') return geometry.coordinates
  if (geometry?.type === 'Polygon') pts.push(...(geometry.coordinates[0] || []))
  else if (geometry?.type === 'LineString') pts.push(...(geometry.coordinates || []))
  else if (geometry?.type === 'MultiPolygon') for (const poly of geometry.coordinates) pts.push(...(poly[0] || []))
  const v = pts.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]))
  if (v.length === 0) return null
  return [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length]
}

// 지도 표시용 지오메트리: 장애물=PSN 정확한 점 / 시설=공항 한 점(중심) / 구역 계열=원래 폴리곤.
// (목록·표·공항탭은 원본 item.geometry 안 씀 — 지도 렌더/줌만 해당.)
export function displayGeometry(item) {
  const g = item?.geometry
  if (!g) return null
  if (item.category === 'obstacle') {
    const p = parsePsnPoint(item.summary) || parsePsnPoint(item.rawText)
    return p ? { type: 'Point', coordinates: p } : g
  }
  if (item.category === 'facility') {
    const c = centroid(g)
    return c ? { type: 'Point', coordinates: c } : g
  }
  return g
}

// 백엔드 페이로드 → GeoJSON. 지오메트리 없는 항목만 제외.
// scope:'fir'(전국 폴리곤)도 포함하되, 레이어에서 fill 없이 외곽선만 그려 화면을 덮지 않게 함
// (notamLayers.js 의 scope 기반 filter 참조). LineString(회랑형)도 유지 — 브리핑 자동매칭만 Phase C에서 제외.
export function notamToFeatureCollection(payload, nowMs = Date.now()) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  return {
    type: 'FeatureCollection',
    features: items
      .map((it) => ({ it, geom: displayGeometry(it) }))
      .filter(({ geom }) => geom?.type && geom?.coordinates)
      .map(({ it, geom }) => ({
        type: 'Feature',
        id: it.id,
        properties: {
          id: it.id,
          category: it.category || 'other',
          scope: it.scope || 'airport',
          timeState: deriveTimeState(it.valid_from, it.valid_to, nowMs),
          summary: it.summary || '',
          altitude: formatAltitude(it.altitude),
          location: it.location || '',
        },
        geometry: geom,
      })),
  }
}

export default { notamToFeatureCollection }
