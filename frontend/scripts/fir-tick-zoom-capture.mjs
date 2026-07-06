// FIR 경계 틱 버그 — 대각선(idx8) 중점 근접 확대. 정수 vs 소수 줌 비교.
// API는 빈 200으로 fulfill(콘솔 500 폭주 차단 + 셸 정상 렌더). 매 캡처마다 새 페이지로 파이프 누적 회피.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, `../../artifacts/fir-tick-zoom/${stamp}`)

const CENTER = [131.083, 36.083] // 대각선 세그먼트 중점
const CLIP = { x: 550, y: 200, width: 760, height: 620 }

async function shoot(browser, zoom, label) {
  const page = await browser.newContext({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 }).then((c) => c.newPage())
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 15000 })
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }
    await page.waitForFunction(() => {
      const m = window.__map
      return m && m.isStyleLoaded() && m.getLayer('wfs-fir-ticks') && m.isSourceLoaded('wfs-fir')
    }, { timeout: 20000 })
    await page.evaluate(({ c, zz }) => window.__map.jumpTo({ center: c, zoom: zz }), { c: CENTER, zz: zoom })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(outDir, `${label}.png`), clip: CLIP })
    console.log('captured', label, '@', zoom)
  } finally {
    await page.context().close()
  }
}

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  try {
    await shoot(browser, 4.3, 'closeup-z4.30')
    await shoot(browser, 5.0, 'closeup-z5.00-integer')
    await shoot(browser, 5.5, 'closeup-z5.50-fractional')
    console.log('outDir:', outDir)
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
