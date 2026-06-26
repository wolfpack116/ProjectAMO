// Playwright smoke for the pre-flight briefing flow (Phase 1 + 2 + 2b).
// Assumes dev servers running (frontend 5173 proxying /api -> backend 3001).
// Usage: node frontend/scripts/briefing-smoke.mjs   (from repo root or frontend/)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../artifacts/briefing-phase2b')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
const fail = (msg) => { console.error('FAIL:', msg); throw new Error(msg) }

try {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.map-shell', { timeout: 20000 })

  // dismiss the update/changelog overlay if it pops up on first load
  if (await page.locator('.updates-overlay').count()) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(300)
    if (await page.locator('.updates-overlay').count()) {
      await page.locator('.updates-overlay button').first().click().catch(() => {})
    }
    await page.locator('.updates-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  }

  // open the route-check (비행 전 브리핑) panel from the sidebar
  await page.click('button[aria-label="비행 전 브리핑"]')
  await page.waitForSelector('.route-check-panel', { timeout: 10000 })

  // pick departure RKSS + arrival RKPC: the airport <select>s are those whose options include RKSI
  const airportSelects = page.locator('.route-check-panel select').filter({ has: page.locator('option[value="RKSI"]') })
  await airportSelects.nth(0).selectOption('RKSS')
  await airportSelects.nth(1).selectOption('RKPC')

  // auto-recommend SID/STAR/IAP, then search the route
  await page.getByRole('button', { name: '자동검색' }).click().catch(() => {})
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: /^검색$/ }).click()
  await page.waitForSelector('.route-check-sequence, .route-check-result', { timeout: 15000 })

  // set an alternate (optional) then generate the briefing
  const altSelect = page.locator('.route-check-panel select').filter({ has: page.locator('option[value="RKPK"]') }).last()
  await altSelect.selectOption('RKPK').catch(() => {})
  await page.getByRole('button', { name: '브리핑 생성' }).click()

  await page.waitForSelector('.briefing-view', { timeout: 20000 })
  // wait for ④ enroute section to appear
  await page.waitForFunction(() => {
    const h = [...document.querySelectorAll('.briefing-view h3')].map((e) => e.textContent)
    return h.some((t) => t && t.includes('노선·공역'))
  }, { timeout: 20000 })

  // inline cross-section is best-effort (needs profile + KIM data) — wait briefly
  await page.locator('.bv-xsection svg').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})

  // capture the on-completion state (route should be centered in the left map area)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(outDir, `briefing-oncomplete-${Date.now()}.png`), fullPage: false }).catch(() => {})

  // B2: form panel hidden + live map visible while briefing is open
  const formHidden = (await page.locator('.route-check-panel').count()) === 0
  const mapVisible = (await page.locator('.mapboxgl-canvas').count()) > 0

  // scroll-sync: click the ④ step in the sticky nav and confirm it becomes active
  await page.getByRole('button', { name: '④ 노선' }).click().catch(() => {})
  await page.waitForTimeout(900)
  const enrouteActive = await page.locator('.bv-nav-step.is-active', { hasText: '④' }).count().catch(() => 0)
  // scroll to ⑤ destination to drive the map (flyTo arrival)
  await page.getByRole('button', { name: '⑤ 목적지' }).click().catch(() => {})
  await page.waitForTimeout(1200)

  const summary = await page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.innerText ?? null
    const sections = [...document.querySelectorAll('.briefing-view h3')].map((e) => e.textContent.trim())
    const model = [...document.querySelectorAll('.briefing-view .bv-ribbon-row')].map((row) => {
      const label = row.querySelector('.bv-ribbon-label')?.textContent?.trim()
      const cap = row.querySelector('.bv-ribbon-cap')?.textContent?.trim()
      const segs = row.querySelectorAll('.bv-seg').length
      return `${label}: ${segs} seg · ${cap ?? ''}`.trim()
    })
    const board = [...document.querySelectorAll('.briefing-view .bv-chip')].map((c) => c.textContent.trim())
    const xsec = document.querySelector('.bv-xsection svg')
    const inlineCrossSection = xsec
      ? { present: true, weatherCells: xsec.querySelectorAll('rect[fill^="rgba"]').length, hasProcedureLine: !!xsec.querySelector('.vertical-profile-procedure-line') }
      : { present: false }
    const navSteps = [...document.querySelectorAll('.briefing-view .bv-nav-step')].map((b) => b.textContent.trim())
    return { sections, model, board, inlineCrossSection, navSteps, header: text('.briefing-view .bv-header') }
  })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const shot = path.join(outDir, `briefing-${ts}.png`)
  await page.screenshot({ path: shot, fullPage: true })

  if (!summary.sections.some((s) => s.includes('노선·공역'))) fail('④ 노선·공역 section missing')
  if (!summary.sections.some((s) => s.includes('위험 요약'))) fail('① 위험 요약 section missing')

  console.log(JSON.stringify({ ok: true, screenshot: shot, navActiveEnrouteOnClick: enrouteActive > 0, formHidden, mapVisible, ...summary }, null, 2))
} catch (err) {
  const shot = path.join(outDir, `briefing-FAIL-${Date.now()}.png`)
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
  console.error('Smoke failed:', err.message, '\nscreenshot:', shot)
  await browser.close()
  process.exit(1)
} finally {
  await browser.close().catch(() => {})
}
