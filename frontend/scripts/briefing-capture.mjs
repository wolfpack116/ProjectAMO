// Route-briefing capture: opens the 비행 전 브리핑 panel, fills a route, generates
// the briefing. Captures the form panel (RouteBriefing.css) + the generated
// briefing-view (BriefingView.css). Phase 2 token rollout.
//   PROJECTAMO_URL  PROJECTAMO_CAPTURE_DIR  PROJECTAMO_CAPTURE_LABEL=before|after
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/briefing-capture')
const LABEL = process.env.PROJECTAMO_CAPTURE_LABEL || 'after'

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 }).then((c) => c.newPage())
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 20000 })
    await page.waitForTimeout(2500)
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }

    await page.click('button[aria-label="비행 전 브리핑"]')
    await page.waitForSelector('.route-check-panel', { timeout: 10000 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(outDir, `briefing-form-${LABEL}.png`) })

    // 출발·도착: Fluent Dropdown(combobox) → option 클릭
    await page.getByRole('combobox', { name: '출발 공항' }).click()
    await page.getByRole('option', { name: 'RKSS' }).click()
    await page.getByRole('combobox', { name: '도착 공항' }).click()
    await page.getByRole('option', { name: 'RKPC' }).click()
    await page.getByRole('button', { name: /^검색$/ }).click()
    // 검색 성공 시 routeResult → '브리핑 생성' 버튼 활성화
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '브리핑 생성')
      return b && !b.disabled
    }, { timeout: 15000 })
    await page.getByRole('button', { name: '브리핑 생성' }).click()
    await page.waitForSelector('.briefing-view', { timeout: 20000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(outDir, `briefing-view-${LABEL}.png`), fullPage: false })
    console.log('captured briefing-form + briefing-view', LABEL)
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
