import store from '../store.js'
import config from '../config.js'
import { crawlNotamKml } from '../notam/notam-crawler.js'
import { parseNotamKml } from '../parsers/notam-parser.js'

// Q-code 2nd/3rd letter (subject) → category. Facility-family subject codes are listed
// explicitly (spec Q-code table); genuinely unmapped/malformed codes → 'other'.
const SUBJECT_CATEGORY = {
  RP: 'prohibited',
  WM: 'firing',
  RD: 'danger',
  RR: 'restricted', RT: 'restricted', RA: 'restricted',
  OB: 'obstacle', PO: 'obstacle',
  // 항행안전시설(GNSS/ILS/VOR/레이더/무선국) + 공항시설(활주로/유도로/계기접근절차 등)
  GA: 'facility', GW: 'facility', IC: 'facility', IL: 'facility', IN: 'facility', IG: 'facility', ID: 'facility',
  NT: 'facility', CT: 'facility', CP: 'facility', CA: 'facility',
  MR: 'facility', MX: 'facility', MP: 'facility', MD: 'facility', MB: 'facility', MA: 'facility', LX: 'facility',
  FA: 'facility', PI: 'facility', PF: 'facility',
}
const KOREA_FIR_CODES = config.notam.fir_codes

export function categorize(qcode) {
  if (!qcode || !/^Q[A-Z]{4}$/.test(qcode)) return 'other'
  return SUBJECT_CATEGORY[qcode.slice(1, 3)] || 'other'
}

export function deriveScope(location) {
  return KOREA_FIR_CODES.includes(location) ? 'fir' : 'airport'
}

export async function process() {
  let crawled
  try {
    crawled = await crawlNotamKml()
  } catch (err) {
    return { type: 'notam', saved: false, reason: `crawl_failed: ${err.message}`, items: 0 }
  }
  const raw = parseNotamKml(crawled.kml)
  const items = raw.map((r) => ({
    id: r.id,
    series: r.series,
    location: r.location,
    qcode: r.qcode,
    category: categorize(r.qcode),
    scope: deriveScope(r.location),
    valid_from: r.validFrom,
    valid_to: r.validTo,
    altitude: r.altitude,
    summary: r.summary,
    rawText: r.rawText,
    geometry: r.geometry,
  }))
  if (items.length === 0) {
    return { type: 'notam', saved: false, reason: 'empty', items: 0 }
  }
  const result = { fetched_at: crawled.fetchedAt, horizon_hours: config.notam.horizon_hours, items }
  const saveResult = store.save('notam', result)
  return { type: 'notam', saved: saveResult.saved, items: items.length }
}

export default { process, categorize, deriveScope }
