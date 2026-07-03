import { chromium } from 'playwright'
import config from '../config.js'

const NOTAM_URL = 'https://aim.koca.go.kr/xNotam/index.do?type=search2&language=ko_KR'

export function isKml(text) {
  return typeof text === 'string' && text.includes('<kml')
}

// Downloads the KOCA "유효 NOTAM" KML in the site's default 24h window.
// The form hard-caps the window at 24h (validateAndSearch clamps to-date to from+1day),
// so we do NOT touch the date fields — the page-load default already ran the search.
export async function crawlNotamKml() {
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ acceptDownloads: true })
    const page = await ctx.newPage()
    await page.goto(NOTAM_URL, { waitUntil: 'networkidle', timeout: config.notam.timeout_ms })
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: config.notam.timeout_ms }),
      page.click('a:has-text("KML다운로드")'),
    ])
    const stream = await download.createReadStream()
    let kml = ''
    for await (const chunk of stream) kml += chunk.toString('utf8')
    if (!isKml(kml)) throw new Error('crawlNotamKml: response is not KML')
    return { kml, fetchedAt: new Date().toISOString() }
  } finally {
    await browser.close()
  }
}

export default { crawlNotamKml, isKml }
