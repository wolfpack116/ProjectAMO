// @ts-nocheck
// 해외 항로 FIR 클립 검증 캡처. window.__map(DEV 노출)으로 East Asia 오버뷰 잡고 스샷.
// 항로 라인은 기본 visibility:none이라 캡처 시 강제로 켠다(클립 결과 육안 확인용).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, `../../artifacts/overseas-airway-clip/${stamp}`)

const VIEWS = [
  { label: 'waypoints-kunming-tibet', center: [95, 30], zoom: 5.6 },
]
const LAYERS = ['aviation-overseas-route-line', 'aviation-overseas-waypoint-point', 'aviation-overseas-navaid-point']

async function shoot(browser, view) {
  const page = await browser.newContext({ viewport: { width: 1900, height: 1000 }, deviceScaleFactor: 1.5 }).then((c) => c.newPage())
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 15000 })
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }
    await page.waitForFunction(() => {
      const m = window.__map
      return m && m.isStyleLoaded() && m.getSource('aviation-overseas-route') && m.isSourceLoaded('aviation-overseas-route')
    }, { timeout: 25000 })
    await page.evaluate(({ c, z, layers }) => {
      const m = window.__map
      for (const id of layers) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'visible')
      m.jumpTo({ center: c, zoom: z })
    }, { c: view.center, z: view.zoom, layers: LAYERS })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(outDir, `${view.label}.png`) })
    console.log('captured', view.label)
  } finally {
    await page.context().close()
  }
}

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const v of VIEWS) await shoot(browser, v)
    console.log('outDir:', outDir)
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
