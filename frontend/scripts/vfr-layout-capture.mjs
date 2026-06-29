// Verify the VFR panel matches the mockup: 경유점 추가 box, list header + 되돌리기,
// drag handles, trash icons, 출발/도착 labels, 순항고도 전체 적용 below. Tests undo.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/vfr-layout')

async function addFix(page, name) {
  const combo = page.locator('.vfr-fix-search-input input')
  await combo.click(); await combo.fill(name); await page.waitForTimeout(300)
  await page.getByRole('option').first().click(); await page.waitForTimeout(300)
}

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1300 } }).then((c) => c.newPage())
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 20000 })
    await page.waitForTimeout(2500)
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }

    await page.click('button[aria-label="비행 전 브리핑"]')
    await page.waitForSelector('.route-check-panel', { timeout: 10000 })
    await page.getByRole('tab', { name: 'VFR' }).click()
    await page.getByRole('combobox', { name: '출발 공항' }).click()
    await page.getByRole('option', { name: 'RKSS' }).click()
    await page.getByRole('combobox', { name: '도착 공항' }).click()
    await page.getByRole('option', { name: 'RKPC' }).click()
    await page.getByRole('button', { name: /^검색$/ }).click()
    await page.waitForSelector('.vfr-fix-search-input', { timeout: 15000 })

    await addFix(page, 'AGAVO')
    await addFix(page, 'KARBU')
    const idsTwo = await page.locator('.vfr-waypoint-altitude-id').allTextContents()
    await page.locator('.route-check-panel').screenshot({ path: path.join(outDir, 'vfr-panel.png') })

    // structural checks vs mockup
    const checks = {
      fixSearchBox: await page.locator('.vfr-fix-search-title').textContent(),
      badge: await page.locator('.vfr-fix-search .fui-Badge').count(),
      listTitle: await page.locator('.vfr-waypoint-list-title').textContent(),
      undoBtn: await page.getByRole('button', { name: /되돌리기/ }).count(),
      handles: await page.locator('.vfr-waypoint-handle:not(.is-placeholder)').count(),
      trash: await page.locator('.vfr-waypoint-delete-btn').count(),
      endpoints: await page.locator('.vfr-waypoint-endpoint').allTextContents(),
      applyBtn: await page.locator('.vfr-altitude-apply button').textContent(),
    }

    // undo removes the last-added fix
    await page.getByRole('button', { name: /되돌리기/ }).click()
    await page.waitForTimeout(400)
    const idsAfterUndo = await page.locator('.vfr-waypoint-altitude-id').allTextContents()

    console.log('ids (2 added):', JSON.stringify(idsTwo))
    console.log('checks:', JSON.stringify(checks))
    console.log('ids after undo:', JSON.stringify(idsAfterUndo))

    if (checks.badge < 1) throw new Error('검색·추가 badge missing')
    if (!checks.listTitle.includes('경유점')) throw new Error('list title missing')
    if (checks.undoBtn < 1) throw new Error('되돌리기 button missing')
    if (checks.handles !== 2) throw new Error(`expected 2 handles, got ${checks.handles}`)
    if (checks.trash !== 2) throw new Error(`expected 2 trash, got ${checks.trash}`)
    if (JSON.stringify(checks.endpoints) !== JSON.stringify(['출발', '도착'])) throw new Error('endpoint labels wrong')
    if (idsAfterUndo.length !== idsTwo.length - 1) throw new Error('undo did not remove one waypoint')
    console.log('PASS')
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
