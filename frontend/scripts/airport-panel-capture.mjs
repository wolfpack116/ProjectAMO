// Focused airport-panel capture: opens RKSI (full-feature: all 6 tabs incl. AMOS)
// via the ?airport=<ICAO> deep-link, screenshots each tab. Reusable across the
// Phase 2 token rollout (markers are WebGL, so the deep-link is the stable path).
//   PROJECTAMO_URL=http://localhost:5173  PROJECTAMO_CAPTURE_DIR=<out>
//   PROJECTAMO_CAPTURE_ICAO=RKSI (default)  PROJECTAMO_CAPTURE_LABEL=before|after
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/airport-panel-capture')
const LABEL = process.env.PROJECTAMO_CAPTURE_LABEL || 'after'
const TARGET_ICAO = process.env.PROJECTAMO_CAPTURE_ICAO || 'RKSI'

const TABS = [
  { id: 'current', label: '현재날씨' },
  { id: 'metar', label: 'METAR' },
  { id: 'taf', label: 'TAF' },
  { id: 'amos', label: 'AMOS' },
  { id: 'warn', label: '공항경보' },
  { id: 'info', label: '기상정보' },
]

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 }).then((c) => c.newPage())
  try {
    await page.goto(`${appUrl}/?airport=${TARGET_ICAO}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.airport-panel', { timeout: 15000 })
    // dismiss the auto-opened "what's new" modal (fresh context has no last-seen version)
    const closeBtn = page.locator('.updates-modal__close')
    if (await closeBtn.count()) { await closeBtn.first().click(); await page.waitForTimeout(300) }
    await page.waitForTimeout(1200)

    for (const tab of TABS) {
      const btn = page.locator('.airport-panel-tab', { hasText: tab.label }).first()
      if (!(await btn.count())) { console.log(`skip tab ${tab.id} (not present)`); continue }
      await btn.click()
      await page.waitForTimeout(600)
      const file = path.join(outDir, `${TARGET_ICAO.toLowerCase()}-${tab.id}-${LABEL}.png`)
      await page.locator('.airport-panel').screenshot({ path: file })
      console.log(file)
    }
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
