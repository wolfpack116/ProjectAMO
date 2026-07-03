import { deriveTimeState, formatAltitude } from './notamViewModel.js'

// 백엔드 페이로드 → GeoJSON. 지오메트리 없는 항목만 제외.
// scope:'fir'(전국 폴리곤)도 포함하되, 레이어에서 fill 없이 외곽선만 그려 화면을 덮지 않게 함
// (notamLayers.js 의 scope 기반 filter 참조). LineString(회랑형)도 유지 — 브리핑 자동매칭만 Phase C에서 제외.
export function notamToFeatureCollection(payload, nowMs = Date.now()) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  return {
    type: 'FeatureCollection',
    features: items
      .filter((it) => it?.geometry?.type && it?.geometry?.coordinates)
      .map((it) => ({
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
        geometry: it.geometry,
      })),
  }
}

export default { notamToFeatureCollection }
