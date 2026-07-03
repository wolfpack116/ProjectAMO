import { deriveTimeState, formatAltitude } from './notamViewModel.js'

// 백엔드 페이로드 → GeoJSON. scope:'fir'(전국 폴리곤)과 지오메트리 없는 항목은 지도에서 제외.
// (FIR 342건을 다 그리면 화면이 붉게 뒤덮임 — 리스트에서만 노출. spec FIR 광역 스코프 참조.)
// LineString(회랑형)은 지도/탭에 노출하므로 유지 — 브리핑 자동매칭에서만 제외(Phase C).
export function notamToFeatureCollection(payload, nowMs = Date.now()) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  return {
    type: 'FeatureCollection',
    features: items
      .filter((it) => it?.scope !== 'fir' && it?.geometry?.type && it?.geometry?.coordinates)
      .map((it) => ({
        type: 'Feature',
        id: it.id,
        properties: {
          id: it.id,
          category: it.category || 'other',
          timeState: deriveTimeState(it.valid_from, it.valid_to, nowMs),
          summary: it.summary || '',
          altitude: formatAltitude(it.altitude),
          location: it.location || '',
        },
        geometry: it.geometry,
      })),
  }
}

export default { notamToFeatureCollection }
