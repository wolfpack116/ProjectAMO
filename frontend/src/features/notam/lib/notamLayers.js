import { TIME_STATE, NOTAM_CATEGORIES } from './notamViewModel.js'

// NOTAM Mapbox 레이어: 색 = 시간상태 3색(카테고리 무관 균일), 형태 = 색맹 대비(채움/반채움/외곽선).
// advisoryLayers.js 패턴을 따름. 줌 분기(마커↔폴리곤)는 이 코드베이스 선례 없음 →
// ponytail: minzoom/maxzoom=9 가설로 두고 브라우저 스모크(Task 10)에서 실검증·조정.
// 색 hex: design-language.md §5 --level-red/amber/gray (flight-category/advisory와 동일 팔레트).
const LEVEL = { red: '#c0291f', amber: '#92400e', gray: '#475569' }
const TIME_COLOR = [
  'match', ['get', 'timeState'],
  'active', LEVEL.red,
  'soon', LEVEL.amber,
  /* upcoming */ LEVEL.gray,
]
const POLYGON_FILTER = ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']]
const NOT_FIR = ['!=', ['get', 'scope'], 'fir']
const IS_FIR = ['==', ['get', 'scope'], 'fir']

export const NOTAM_SOURCE_IDS = ['notam-src']
export const NOTAM_LAYER_IDS = ['notam-fill', 'notam-line', 'notam-fir-line', 'notam-marker']

const CATEGORY_LABEL = Object.fromEntries(NOTAM_CATEGORIES.map((c) => [c.id, c.label]))
export function catLabel(id) {
  return CATEGORY_LABEL[id] || '기타'
}

export function addNotamLayers(map, featureData) {
  if (!map.getSource('notam-src')) {
    map.addSource('notam-src', { type: 'geojson', data: featureData })
  }
  // 공항 구역 폴리곤/라인 — 모든 줌에서 표시(줌 제한 없음). fill은 아주 옅게(활주로를 "덮어" 비행금지처럼 안 보이게), 경계선 위주. 내부 클릭 시 팝업.
  if (!map.getLayer('notam-fill')) {
    map.addLayer({
      id: 'notam-fill', type: 'fill', source: 'notam-src', slot: 'top',
      paint: { 'fill-color': TIME_COLOR, 'fill-opacity': 0.07 },
      filter: ['all', POLYGON_FILTER, NOT_FIR],
    })
  }
  if (!map.getLayer('notam-line')) {
    map.addLayer({
      id: 'notam-line', type: 'line', source: 'notam-src', slot: 'top',
      paint: { 'line-color': TIME_COLOR, 'line-width': 1.8, 'line-opacity': 0.95 },
      filter: NOT_FIR,
    })
  }
  // FIR(전국) 공지는 fill 없이 점선 외곽선만, 모든 줌에서 — 화면을 덮지 않으면서 존재를 보여줌.
  // (내부 클릭은 point-in-polygon으로 판정 — notamsAtPoint. 투명 fill은 클릭이 잘 안 잡혀 안 씀.)
  if (!map.getLayer('notam-fir-line')) {
    map.addLayer({
      id: 'notam-fir-line', type: 'line', source: 'notam-src', slot: 'top',
      paint: { 'line-color': TIME_COLOR, 'line-width': 1.2, 'line-opacity': 0.55, 'line-dasharray': [3, 2] },
      filter: IS_FIR,
    })
  }
  if (!map.getLayer('notam-marker')) {
    // 형태 단서(색맹 대비): 발효중=채운 원 / 곧발효=반채움(진한 테두리+옅은 채움) / 예정=외곽선만.
    map.addLayer({
      id: 'notam-marker', type: 'circle', source: 'notam-src', slot: 'top',
      // Point 지오메트리만 — 필터 없으면 폴리곤/라인 꼭짓점마다 점이 찍힘. 모든 줌에서 표시(확대해도 사라지지 않게).
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': ['match', ['get', 'timeState'], 'upcoming', 'rgba(0,0,0,0)', TIME_COLOR],
        'circle-opacity': ['match', ['get', 'timeState'], 'soon', 0.4, 'active', 0.85, 0],
        'circle-stroke-color': TIME_COLOR,
        'circle-stroke-width': 2,
        'circle-radius': 6,
      },
    })
  }
  if (map.getLayer('notam-marker') && typeof map.moveLayer === 'function') map.moveLayer('notam-marker')
}

export function updateNotamLayerData(map, featureData) {
  addNotamLayers(map, featureData)
  map.getSource('notam-src')?.setData(featureData)
}

export function setNotamVisibility(map, isVisible) {
  const v = isVisible ? 'visible' : 'none'
  for (const id of NOTAM_LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
}

export function setNotamCategoryFilter(map, activeCategoryIds) {
  const catFilter = ['in', ['get', 'category'], ['literal', activeCategoryIds]]
  if (map.getLayer('notam-fill')) map.setFilter('notam-fill', ['all', POLYGON_FILTER, NOT_FIR, catFilter])
  if (map.getLayer('notam-line')) map.setFilter('notam-line', ['all', NOT_FIR, catFilter])
  if (map.getLayer('notam-fir-line')) map.setFilter('notam-fir-line', ['all', IS_FIR, catFilter])
  if (map.getLayer('notam-marker')) map.setFilter('notam-marker', ['all', ['==', ['geometry-type'], 'Point'], catFilter])
}

// 겹침 팝업 HTML(목업 surface D): 1건 상세 / 2~3건 미니리스트 / 4건+ 상위3 + "전체 목록에서 보기".
// 클릭 지점이 폴리곤 내부인지 직접 판정(ray casting) — 렌더/줌/투명도와 무관하게 클릭 인식.
function ringContains(ring, lng, lat) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    const hit = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    if (hit) inside = !inside
  }
  return inside
}
function geometryContains(geometry, lng, lat) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') return ringContains(geometry.coordinates[0] || [], lng, lat)
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).some((poly) => ringContains(poly[0] || [], lng, lat))
  return false
}

// 클릭 좌표를 포함하는 폴리곤 NOTAM들(카테고리 필터 반영). 점/선은 queryRenderedFeatures가 담당.
export function notamsAtPoint(features, lng, lat, activeCategoryIds) {
  return (features || []).filter((f) =>
    activeCategoryIds.includes(f.properties?.category) && geometryContains(f.geometry, lng, lat))
}

// 지오메트리 경계 [[minLon,minLat],[maxLon,maxLat]] — 목록→지도 줌인(fitBounds)용.
export function geometryBounds(geometry) {
  if (!geometry) return null
  const pts = []
  if (geometry.type === 'Point') pts.push(geometry.coordinates)
  else if (geometry.type === 'LineString') pts.push(...geometry.coordinates)
  else if (geometry.type === 'Polygon') pts.push(...(geometry.coordinates[0] || []))
  else if (geometry.type === 'MultiPolygon') for (const poly of geometry.coordinates) pts.push(...(poly[0] || []))
  const valid = pts.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  if (valid.length === 0) return null
  const lons = valid.map((p) => p[0]); const lats = valid.map((p) => p[1])
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]]
}

export const NOTAM_HIGHLIGHT_LAYER_IDS = ['notam-hl-fill', 'notam-hl-line', 'notam-hl-point']
const HL_COLOR = '#0ea5e9' // 시간상태색(red/amber/gray)과 구분되는 '선택' 강조색
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export function addNotamHighlight(map) {
  if (!map.getSource('notam-hl-src')) map.addSource('notam-hl-src', { type: 'geojson', data: EMPTY_FC })
  if (!map.getLayer('notam-hl-fill')) {
    map.addLayer({ id: 'notam-hl-fill', type: 'fill', source: 'notam-hl-src', slot: 'top',
      paint: { 'fill-color': HL_COLOR, 'fill-opacity': 0.18 }, filter: POLYGON_FILTER })
  }
  if (!map.getLayer('notam-hl-line')) {
    map.addLayer({ id: 'notam-hl-line', type: 'line', source: 'notam-hl-src', slot: 'top',
      paint: { 'line-color': HL_COLOR, 'line-width': 3.5, 'line-opacity': 1 } })
  }
  if (!map.getLayer('notam-hl-point')) {
    map.addLayer({ id: 'notam-hl-point', type: 'circle', source: 'notam-hl-src', slot: 'top',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 12, 'circle-color': HL_COLOR, 'circle-opacity': 0.25, 'circle-stroke-color': HL_COLOR, 'circle-stroke-width': 3 } })
  }
  for (const id of NOTAM_HIGHLIGHT_LAYER_IDS) if (map.getLayer(id) && typeof map.moveLayer === 'function') map.moveLayer(id)
}

export function setNotamHighlight(map, feature) {
  const src = map.getSource('notam-hl-src')
  if (src) src.setData(feature ? { type: 'FeatureCollection', features: [feature] } : EMPTY_FC)
}

export function notamPopupHtml(features) {
  const shown = features.slice(0, features.length <= 3 ? features.length : 3)
  const rows = shown.map((f) => {
    const p = f.properties
    const ts = TIME_STATE[p.timeState] || TIME_STATE.upcoming
    const alt = p.altitude ? ` · ${p.altitude}` : ''
    return `<div class="notam-pop-row">`
      + `<span class="notam-pop-cat">${catLabel(p.category)}</span>`
      + `<span class="notam-pop-id">${p.id}</span>`
      + `<span class="notam-pop-ts ts-${ts.key}">${ts.glyph} ${ts.label}</span>`
      + `<div class="notam-pop-sum">${p.summary || ''}${alt}</div></div>`
  }).join('')
  const header = features.length === 1 ? '' : `<div class="notam-pop-head">이 지점에 ${features.length}건</div>`
  const more = features.length > 3
    ? `<button type="button" class="notam-pop-more" data-loc="${features[0].properties.location || ''}">전체 목록에서 보기 →</button>`
    : ''
  return `<div class="notam-pop">${header}${rows}${more}</div>`
}

export default {
  NOTAM_SOURCE_IDS, NOTAM_LAYER_IDS, NOTAM_HIGHLIGHT_LAYER_IDS, catLabel,
  addNotamLayers, updateNotamLayerData, setNotamVisibility, setNotamCategoryFilter, notamPopupHtml,
  geometryBounds, addNotamHighlight, setNotamHighlight, notamsAtPoint,
}
