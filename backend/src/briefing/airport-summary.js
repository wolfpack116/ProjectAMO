import { categoryDetail, levelForCategory } from './flight-category.js'

export function ceilingFromClouds(clouds) {
  const bases = (clouds ?? [])
    .filter((c) => c && (c.amount === 'BKN' || c.amount === 'OVC') && Number.isFinite(c.base))
    .map((c) => c.base)
  return bases.length ? Math.min(...bases) : null
}

function field(text, flag) { return { text: text ?? '-', flag: Boolean(flag) } }

// 매트릭스 표출용 포맷 (§5-B): 바람 270/12kt·돌풍 G28, 시정 ≥10km/3.2km.
function formatWindKt(wind) {
  if (!wind) return '-'
  if (wind.calm) return 'CALM'
  const spd = String(wind.speed ?? 0).padStart(2, '0')
  const dir = wind.variable ? 'VRB' : String(wind.direction ?? 0).padStart(3, '0')
  return `${dir}/${spd}kt`
}
function formatVisibilityKm(visibilityM) {
  if (!Number.isFinite(visibilityM)) return '-'
  if (visibilityM >= 9999) return '≥10km'
  return `${(visibilityM / 1000).toFixed(1)}km`
}

export function summarizeAirport(role, metar) {
  if (!metar?.observation) {
    return { role, icao: metar?.header?.icao ?? null, category: 'UNKNOWN', driver: null, level: 'gray', fields: {}, raw: null, observationTime: null, reportType: null }
  }
  const obs = metar.observation
  const visibilityM = obs.visibility?.cavok ? 9999 : obs.visibility?.value
  const ceilingFt = ceilingFromClouds(obs.clouds)
  const { category, driver } = categoryDetail({ visibilityM, ceilingFt })
  const gust = obs.wind?.gust

  const tempText = obs.display?.temperature ? `${obs.display.temperature}℃` : null
  const fields = {
    wind: { ...field(formatWindKt(obs.wind), Number.isFinite(gust) && gust >= 30), gust: Number.isFinite(gust) ? gust : null },
    visibility: field(formatVisibilityKm(visibilityM), Number.isFinite(visibilityM) && visibilityM < 5000),
    ceiling: field(obs.display?.clouds, Number.isFinite(ceilingFt) && ceilingFt < 1000),
    temp: field(tempText, false),
    weather: field(obs.display?.weather || '-', (obs.weather ?? []).length > 0),
    qnh: field(obs.display?.qnh, false),
  }

  return {
    role,
    icao: metar.header?.icao ?? null,
    category,
    driver, // 'ceiling' | 'visibility' | 'both' — 배너 이유 노출용
    level: levelForCategory(category),
    fields,
    observationTime: metar.header?.observation_time ?? null,
    reportType: metar.header?.report_type ?? null, // 'METAR' | 'SPECI'
    raw: null, // 원문 METAR 문자열 노출은 Phase 4에서 추가
  }
}

export default { ceilingFromClouds, summarizeAirport }
