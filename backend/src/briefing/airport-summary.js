import { categoryFor, levelForCategory } from './flight-category.js'

export function ceilingFromClouds(clouds) {
  const bases = (clouds ?? [])
    .filter((c) => c && (c.amount === 'BKN' || c.amount === 'OVC') && Number.isFinite(c.base))
    .map((c) => c.base)
  return bases.length ? Math.min(...bases) : null
}

function field(text, flag) { return { text: text ?? '-', flag: Boolean(flag) } }

export function summarizeAirport(role, metar) {
  if (!metar?.observation) {
    return { role, icao: metar?.header?.icao ?? null, category: 'UNKNOWN', level: 'gray', fields: {}, raw: null }
  }
  const obs = metar.observation
  const visibilityM = obs.visibility?.cavok ? 9999 : obs.visibility?.value
  const ceilingFt = ceilingFromClouds(obs.clouds)
  const category = categoryFor({ visibilityM, ceilingFt })
  const gust = obs.wind?.gust

  const fields = {
    wind: field(obs.display?.wind, Number.isFinite(gust) && gust >= 30),
    visibility: field(String(visibilityM ?? '-'), Number.isFinite(visibilityM) && visibilityM < 5000),
    ceiling: field(obs.display?.clouds, Number.isFinite(ceilingFt) && ceilingFt < 1000),
    temp: field(obs.display?.temperature, false),
    weather: field(obs.display?.weather || '-', (obs.weather ?? []).length > 0),
    qnh: field(obs.display?.qnh, false),
  }

  return {
    role,
    icao: metar.header?.icao ?? null,
    category,
    level: levelForCategory(category),
    fields,
    raw: null, // 원문 METAR 문자열 노출은 Phase 4에서 추가
  }
}

export default { ceilingFromClouds, summarizeAirport }
