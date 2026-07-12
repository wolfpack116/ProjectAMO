// Save/load round-trip: VFR RKSS→RKPC + AGAVO → save → reset → load → assert
// the waypoint list is restored (re-search + saved-waypoint overlay).
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/route-save-load')

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 } }).then((c) => c.newPage())
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
  page.on('dialog', (d) => d.accept('동해안 VFR'))
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 20000 })
    await page.waitForTimeout(2500)
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }
    // start clean so prior runs don't accumulate
    await page.evaluate(() => localStorage.removeItem('projectamo.savedRoutes.v1'))

    await page.click('button[aria-label="비행 전 브리핑"]')
    await page.waitForSelector('.route-check-panel', { timeout: 10000 })
    await page.getByRole('tab', { name: 'VFR' }).click()
    await page.getByRole('combobox', { name: '출발 공항' }).click()
    await page.getByRole('option', { name: 'RKSS' }).click()
    await page.getByRole('combobox', { name: '도착 공항' }).click()
    await page.getByRole('option', { name: 'RKPC' }).click()
    await page.getByRole('button', { name: /^검색$/ }).click()
    await page.waitForSelector('.vfr-fix-search-input', { timeout: 15000 })

    // add AGAVO
    const combo = page.locator('.vfr-fix-search-input input')
    await combo.click(); await combo.fill('AGAVO'); await page.waitForTimeout(300)
    await page.getByRole('option').first().click()
    await page.waitForTimeout(300)
    const idsSaved = await page.locator('.vfr-waypoint-altitude-id').allTextContents()

    // save via header menu (dialog auto-accepts "동해안 VFR")
    await page.getByRole('menuitem', { name: /현재 경로 저장/ }).count().catch(() => {})
    await page.locator('.route-check-header-actions button', { hasText: '경로' }).click()
    await page.getByRole('menuitem', { name: /현재 경로 저장/ }).click()
    await page.waitForTimeout(300)

    // reset
    const resetBtn = page.getByRole('button', { name: /^초기화/ })
    await resetBtn.click(); await page.waitForTimeout(200)
    if (await page.getByRole('button', { name: '초기화 확인' }).count()) {
      await page.getByRole('button', { name: '초기화 확인' }).click()
    }
    await page.waitForTimeout(300)
    const clearedSearch = await page.locator('.vfr-fix-search-input').count()

    // load
    await page.locator('.route-check-header-actions button', { hasText: '경로' }).click()
    await page.waitForSelector('.rb-saved-row', { timeout: 5000 })
    await page.locator('.rb-saved-load').first().click()
    await page.waitForSelector('.vfr-fix-search-input', { timeout: 15000 })
    await page.waitForTimeout(500)
    const idsLoaded = await page.locator('.vfr-waypoint-altitude-id').allTextContents()
    await page.screenshot({ path: path.join(outDir, 'after-load.png') })

    console.log('ids saved:  ', JSON.stringify(idsSaved))
    console.log('search cleared after reset (0 expected):', clearedSearch)
    console.log('ids loaded: ', JSON.stringify(idsLoaded))
    const same = JSON.stringify(idsSaved) === JSON.stringify(idsLoaded)
    if (!same) throw new Error('loaded waypoints do not match saved')
    if (clearedSearch !== 0) throw new Error('reset did not clear route')
    console.log('PASS')
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
