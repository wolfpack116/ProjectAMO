// Monitoring page capture (ops + ground modes) for the Phase 2 token rollout.
//   PROJECTAMO_URL  PROJECTAMO_CAPTURE_DIR  PROJECTAMO_CAPTURE_LABEL=before|after
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/monitoring-capture')
const LABEL = process.env.PROJECTAMO_CAPTURE_LABEL || 'after'
const MODES = ['ops', 'ground']

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 }).then((c) => c.newPage())
  try {
    for (const mode of MODES) {
      await page.goto(`${appUrl}/monitoring?mode=${mode}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.dashboard-root', { timeout: 15000 })
      await page.waitForTimeout(2500)
      const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }
      const file = path.join(outDir, `monitoring-${mode}-${LABEL}.png`)
      await page.screenshot({ path: file, fullPage: false })
      console.log(file)
    }
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
