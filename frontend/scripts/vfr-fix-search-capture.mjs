// Focused capture for VFR 검색-추가: switch to VFR, search RKSS→RKPC, add a named
// fix via the 경유점 추가 Combobox, assert a new waypoint row appears.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/vfr-fix-search')

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1200 } }).then((c) => c.newPage())
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 20000 })
    await page.waitForTimeout(2500)
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }

    await page.click('button[aria-label="비행 전 브리핑"]')
    await page.waitForSelector('.route-check-panel', { timeout: 10000 })

    // VFR 탭
    await page.getByRole('tab', { name: 'VFR' }).click()
    await page.getByRole('combobox', { name: '출발 공항' }).click()
    await page.getByRole('option', { name: 'RKSS' }).click()
    await page.getByRole('combobox', { name: '도착 공항' }).click()
    await page.getByRole('option', { name: 'RKPC' }).click()
    await page.getByRole('button', { name: /^검색$/ }).click()

    // VFR 결과 → 경유점 추가 검색창 등장
    await page.waitForSelector('.vfr-fix-search-input', { timeout: 15000 })
    const rowsBefore = await page.locator('.vfr-waypoint-altitude-row').count()
    await page.screenshot({ path: path.join(outDir, 'vfr-before-add.png') })

    // 검색-추가: combobox 입력 → 옵션 선택
    const combo = page.locator('.vfr-fix-search-input input')
    await combo.click()
    await combo.fill('AGAVO')
    await page.waitForTimeout(400)
    const opt = page.getByRole('option').first()
    const optText = await opt.textContent()
    await opt.click()
    await page.waitForTimeout(500)

    const rowsAfter = await page.locator('.vfr-waypoint-altitude-row').count()
    const ids = await page.locator('.vfr-waypoint-altitude-id').allTextContents()
    await page.screenshot({ path: path.join(outDir, 'vfr-after-add.png') })

    console.log('option clicked:', JSON.stringify(optText))
    console.log('rows before/after:', rowsBefore, rowsAfter)
    console.log('waypoint ids:', JSON.stringify(ids))
    if (rowsAfter !== rowsBefore + 1) throw new Error(`expected +1 row, got ${rowsBefore}->${rowsAfter}`)
    console.log('PASS')
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
