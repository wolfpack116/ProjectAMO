// Map chrome capture: opens the 기상정보(met) layer panel, toggles representative
// layers to reveal legends / timeline / advisory badges, and screenshots. For the
// Phase 2 MapView.css token rollout (overlay legends + map chrome).
//   PROJECTAMO_URL  PROJECTAMO_CAPTURE_DIR  PROJECTAMO_CAPTURE_LABEL=before|after
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/map-chrome-capture')
const LABEL = process.env.PROJECTAMO_CAPTURE_LABEL || 'after'
const LAYERS = ['레이더', '낙뢰', 'Temp', 'Wind', 'SIGMET', 'SIGWX']

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 }).then((c) => c.newPage())
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 15000 })
    await page.waitForTimeout(3500)
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }
    // open the 기상정보 (met) layer panel
    await page.getByRole('button', { name: '기상정보' }).first().click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(outDir, `met-panel-${LABEL}.png`) })

    // toggle representative layers to reveal legends / bars / badges
    for (const name of LAYERS) {
      const row = page.locator('.layer-toggle-label', { hasText: new RegExp(`^${name}$`, 'i') }).first()
      if (await row.count()) { await row.click(); await page.waitForTimeout(250) }
    }
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(outDir, `met-overlays-${LABEL}.png`) })
    console.log('captured met-panel + met-overlays', LABEL)
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
