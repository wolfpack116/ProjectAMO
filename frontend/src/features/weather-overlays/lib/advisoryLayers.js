import { phenomenonKo } from '../../../shared/weather/phenomenonKo.js'

export const ADVISORY_LAYER_DEFS = {
  sigmet: {
    sourceId: 'kma-sigmet-advisories',
    fillLayerId: 'kma-sigmet-advisories-fill',
    lineLayerId: 'kma-sigmet-advisories-line',
    iconLayerId: 'kma-sigmet-advisories-icon',
    color: '#dc2626',
    label: 'SIGMET',
  },
  // 해외(NOAA) SIGMET — 국내와 별도 소스/레이어라 독립 토글. 렌더는 SIGMET과 동일(빨강 실선).
  sigmet_intl: {
    sourceId: 'noaa-sigmet-advisories',
    fillLayerId: 'noaa-sigmet-advisories-fill',
    lineLayerId: 'noaa-sigmet-advisories-line',
    iconLayerId: 'noaa-sigmet-advisories-icon',
    color: '#dc2626',
    label: 'SIGMET(해외)',
  },
  airmet: {
    sourceId: 'kma-airmet-advisories',
    fillLayerId: 'kma-airmet-advisories-fill',
    lineLayerId: 'kma-airmet-advisories-line',
    iconLayerId: 'kma-airmet-advisories-icon',
    color: '#f59e0b',
    label: 'AIRMET',
  },
}

export function advisorySymbolUrl(kind, phenomenonCode) {
  const code = String(phenomenonCode || '').trim().toUpperCase()
  if (!code) return null
  const folder = kind.startsWith('sigmet') ? 'icon_SIGMET' : 'icon_AIRMET'
  const file = `${code}.png`
  return `/Symbols/Reference%20Symbols/${folder}/${encodeURIComponent(file)}`
}

function ensureMapImage(map, id, url) {
  if (!id || !url || map.hasImage(id)) return
  map.loadImage(url, (error, image) => {
    if (error || !image || map.hasImage(id)) return
    map.addImage(id, image)
  })
}

function formatAltitude(item) {
  const altitude = item?.altitude

  if (!altitude) {
    return ''
  }

  const lower = altitude.lower_fl ? `FL${altitude.lower_fl}` : ''
  const upper = altitude.upper_fl ? `FL${altitude.upper_fl}` : ''

  if (lower && upper) {
    return `${lower}-${upper}`
  }

  return upper || lower
}

function formatMotion(item) {
  const motion = item?.motion

  if (!motion || !Number.isFinite(motion.speed_kt) || motion.speed_kt <= 0) {
    return ''
  }

  return Number.isFinite(motion.direction_deg)
    ? `${Math.round(motion.direction_deg)}deg ${Math.round(motion.speed_kt)}KT`
    : `${Math.round(motion.speed_kt)}KT`
}

// 지도 라벨은 공간이 좁아 한글명만(코드 생략). 없으면 영문 라벨→코드.
function formatLabel(item, kind) {
  const base = kind.startsWith('sigmet') ? 'SIGMET' : 'AIRMET'
  const phenomenon = phenomenonKo(item?.phenomenon_code)
    || item?.phenomenon_label || item?.phenomenon_code || ''
  const sequence = item?.sequence_number ? ` ${item.sequence_number}` : ''
  return `${base}${sequence}${phenomenon ? ` ${phenomenon}` : ''}`
}

// ponytail: weatherOverlayModel.formatSigwxStamp와 동일한 분단위 포맷. 순환참조 피하려 로컬.
function fmtMinute(iso, tz = 'KST') {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms + (tz === 'KST' ? 9 * 3600000 : 0))
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${tz}`
}

function formatDescription(item, kind, tz = 'KST') {
  const parts = [
    formatLabel(item, kind),
    item?.valid_from && item?.valid_to ? `${fmtMinute(item.valid_from, tz)} ~ ${fmtMinute(item.valid_to, tz)}` : '',
    formatAltitude(item),
    formatMotion(item),
  ].filter(Boolean)

  return parts.join('\n')
}

function bboxCenter(item) {
  const bbox = item?.bbox

  if (!bbox) {
    return null
  }

  const lon = (bbox.min_lon + bbox.max_lon) / 2
  const lat = (bbox.min_lat + bbox.max_lat) / 2

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }

  return [lon, lat]
}

function geometryCenter(geometry) {
  const coordinates = geometry?.coordinates?.[0]

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null
  }

  const points = coordinates.filter((point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]))

  if (points.length === 0) {
    return null
  }

  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ]
}

export function advisoryItemsToFeatureCollection(payload, kind, tz = 'KST') {
  const items = Array.isArray(payload?.items) ? payload.items : []

  return {
    type: 'FeatureCollection',
    features: items
      .filter((item) => item?.geometry?.type && item?.geometry?.coordinates)
      .map((item, index) => ({
        type: 'Feature',
        id: item.id || `${kind}-${index}`,
        properties: {
          id: item.id || `${kind}-${index}`,
          kind,
          label: formatLabel(item, kind),
          phenomenon: item.phenomenon_code || '',
          phenomenonLabel: item.phenomenon_label || '',
          sequence: item.sequence_number || '',
          validFrom: item.valid_from || '',
          validTo: item.valid_to || '',
          altitude: formatAltitude(item),
          motion: formatMotion(item),
          description: formatDescription(item, kind, tz),
        },
        geometry: item.geometry,
      })),
  }
}

export function advisoryItemsToLabelFeatureCollection(payload, kind, tz = 'KST') {
  const items = Array.isArray(payload?.items) ? payload.items : []

  return {
    type: 'FeatureCollection',
    features: items
      .map((item, index) => {
        const center = bboxCenter(item) || geometryCenter(item.geometry)

        if (!center) {
          return null
        }

        return {
          type: 'Feature',
          id: item.id || `${kind}-label-${index}`,
          properties: {
            id: item.id || `${kind}-${index}`,
          kind,
          label: formatLabel(item, kind),
          iconKey: item.phenomenon_code ? `${kind}-${item.phenomenon_code}` : '',
          iconUrl: advisorySymbolUrl(kind, item.phenomenon_code) || '',
          description: formatDescription(item, kind, tz),
        },
          geometry: {
            type: 'Point',
            coordinates: center,
          },
        }
      })
      .filter(Boolean),
  }
}

export function addAdvisoryLayers(map, kind, featureData, labelData) {
  const def = ADVISORY_LAYER_DEFS[kind]

  if (!def) {
    return
  }

  if (!map.getSource(def.sourceId)) {
    map.addSource(def.sourceId, {
      type: 'geojson',
      data: featureData,
    })
  }

  const labelSourceId = `${def.sourceId}-labels`

  if (!map.getSource(labelSourceId)) {
    map.addSource(labelSourceId, {
      type: 'geojson',
      data: labelData,
    })
  }

  if (!map.getLayer(def.fillLayerId)) {
    map.addLayer({
      id: def.fillLayerId,
      type: 'fill',
      source: def.sourceId,
      slot: 'top',
      paint: {
        'fill-color': def.color,
        'fill-opacity': kind.startsWith('sigmet') ? 0.16 : 0.12,
      },
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
    })
  }

  if (!map.getLayer(def.lineLayerId)) {
    map.addLayer({
      id: def.lineLayerId,
      type: 'line',
      source: def.sourceId,
      slot: 'top',
      paint: {
        'line-color': def.color,
        'line-opacity': 0.9,
        'line-width': kind.startsWith('sigmet') ? 2.4 : 2,
        'line-dasharray': kind.startsWith('sigmet') ? [1, 0] : [2, 1.5],
      },
    })
  }

  labelData.features.forEach((feature) => {
    ensureMapImage(map, feature.properties?.iconKey, feature.properties?.iconUrl)
  })

  if (!map.getLayer(def.iconLayerId)) {
    map.addLayer({
      id: def.iconLayerId,
      type: 'symbol',
      source: labelSourceId,
      slot: 'top',
      layout: {
        'icon-image': ['get', 'iconKey'],
        'icon-size': 1.0,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-offset': [0, -22],
      },
      filter: ['!=', ['get', 'iconKey'], ''],
    })
  }
  // 공항 기호·이름 레이어 위로 올려 가려지지 않게(데이터 갱신마다 최상단 재확정).
  if (map.getLayer(def.iconLayerId) && typeof map.moveLayer === 'function') map.moveLayer(def.iconLayerId)
}

export function updateAdvisoryLayerData(map, kind, featureData, labelData) {
  const def = ADVISORY_LAYER_DEFS[kind]

  if (!def) {
    return
  }

  addAdvisoryLayers(map, kind, featureData, labelData)
  map.getSource(def.sourceId)?.setData(featureData)
  map.getSource(`${def.sourceId}-labels`)?.setData(labelData)
}

export function setAdvisoryVisibility(map, kind, isVisible) {
  const def = ADVISORY_LAYER_DEFS[kind]

  if (!def) {
    return
  }

  const visibility = isVisible ? 'visible' : 'none'

  for (const layerId of [def.fillLayerId, def.lineLayerId, def.iconLayerId]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility)
    }
  }
}
