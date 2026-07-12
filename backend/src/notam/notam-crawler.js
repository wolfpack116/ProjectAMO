import { chromium } from 'playwright'
import config from '../config.js'

const NOTAM_URL = 'https://aim.koca.go.kr/xNotam/index.do?type=search2&language=ko_KR'

export function isKml(text) {
  return typeof text === 'string' && text.includes('<kml')
}

// KOCA는 간헐적으로 "유효한 빈 KML"(placemark 0개)을 내려줌 — 기본검색이 아직 안 채워진 순간 등.
// 그걸 그대로 저장하면 좋은 latest.json이 빈 것으로 덮여 웹에서 NOTAM이 사라짐. → placemark 수로 판별.
export function countPlacemarks(kml) {
  return (String(kml || '').match(/<Placemark\b/gi) || []).length
}

// 한 번 접속→다운로드 시도. { kml } 반환(빈 것도 그대로 반환 — 판정은 호출부에서).
async function downloadOnce(ctx) {
  const page = await ctx.newPage()
  try {
    await page.goto(NOTAM_URL, { waitUntil: 'networkidle', timeout: config.notam.timeout_ms })
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: config.notam.timeout_ms }),
      page.click('a:has-text("KML다운로드")'),
    ])
    const stream = await download.createReadStream()
    let kml = ''
    for await (const chunk of stream) kml += chunk.toString('utf8')
    return kml
  } finally {
    await page.close()
  }
}

// Downloads the KOCA "유효 NOTAM" KML in the site's default 24h window.
// The form hard-caps the window at 24h (validateAndSearch clamps to-date to from+1day),
// so we do NOT touch the date fields — the page-load default already ran the search.
// 빈 KML(placemark 0)이면 최대 3회 재시도. 끝까지 비면 throw → 프로세서가 이전 스냅샷 유지(saved:false).
export async function crawlNotamKml() {
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ acceptDownloads: true })
    let lastKml = ''
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const kml = await downloadOnce(ctx)
      lastKml = kml
      if (isKml(kml) && countPlacemarks(kml) > 0) {
        return { kml, fetchedAt: new Date().toISOString() }
      }
    }
    if (!isKml(lastKml)) throw new Error('crawlNotamKml: response is not KML')
    throw new Error('crawlNotamKml: KML had no placemarks after retries (keeping previous snapshot)')
  } finally {
    await browser.close()
  }
}

export default { crawlNotamKml, isKml, countPlacemarks }
