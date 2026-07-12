import { XMLParser } from 'fast-xml-parser'
import { toArray, text, number } from './parse-utils.js'

// 이륙예보(AirInfoService/getAirInfo) 파서.
// item: icaoCode·airportName·tmFc(KST YYYYMMDDHHmm)·wd(풍향°)·ws(풍속kt)·ta(기온℃)·qnh(inHg×100).
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item',
  parseTagValue: false,
})

const INHG_TO_HPA = 33.8639

function getItems(doc) {
  return toArray(doc?.response?.body?.items?.item || doc?.body?.items?.item)
}
function getResultCode(doc) {
  return String(doc?.response?.header?.resultCode || doc?.header?.resultCode || '').trim()
}

// tmFc(KST YYYYMMDDHHmm) → UTC ISO. 프론트 formatBriefingTime이 tz 변환하므로 UTC로 저장.
export function tmFcKstToIso(tmFc) {
  const m = String(tmFc || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (!m) return null
  const utcMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 9 * 3600 * 1000
  return new Date(utcMs).toISOString()
}

export function parse(xmlString, icao) {
  const doc = parser.parse(xmlString)
  const code = getResultCode(doc)
  if (code !== '00' && code !== '03') return null

  const items = getItems(doc)
  const forecasts = items
    .map((it) => {
      const qnhRaw = number(text(it.qnh)) // inHg×100
      const qnhInHg = Number.isFinite(qnhRaw) ? qnhRaw / 100 : null
      const wd = number(text(it.wd))
      const ws = number(text(it.ws))
      const ta = number(text(it.ta))
      return {
        time: tmFcKstToIso(text(it.tmFc)),
        tmFc: text(it.tmFc),
        windDir: Number.isFinite(wd) ? wd : null,
        windSpeedKt: Number.isFinite(ws) ? ws : null,
        tempC: Number.isFinite(ta) ? ta : null,
        qnhHpa: qnhInHg != null ? Math.round(qnhInHg * INHG_TO_HPA) : null,
      }
    })
    .filter((f) => f.time)

  if (forecasts.length === 0) return null
  return {
    icao: text(items[0]?.icaoCode) || icao,
    airportName: text(items[0]?.airportName) || null,
    forecasts,
  }
}

export default { parse, tmFcKstToIso }
