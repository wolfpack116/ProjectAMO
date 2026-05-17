import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../../../frontend/node_modules/playwright/index.mjs'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const OUT_DIR = new URL('./', import.meta.url)
const REVIEW_DIR = new URL('./review/', import.meta.url)

const phoneViewport = { name: 'phone', size: '390x844', width: 390, height: 844 }
const tabletViewport = { name: 'tablet-portrait', size: '820x1180', width: 820, height: 1180 }
const log = []

async function waitForMain(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.map-shell', { timeout: 20_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function openRoutePanel(page) {
  await page.locator('.sidebar-menu-list .sidebar-icon-button').nth(4).click({ timeout: 10_000 })
  await page.locator('.route-check-panel').waitFor({ timeout: 10_000 })
  await page.waitForTimeout(350)
}

async function collect(page, viewport, state, fileName) {
  const file = new URL(fileName, OUT_DIR)
  await page.screenshot({ path: fileURLToPath(file), fullPage: false })
  const metrics = await page.evaluate(() => {
    const selectors = [
      '.sidebar',
      '.map-shell',
      '.map-view-wrapper',
      '.map-view',
      '.route-check-panel',
      '.route-briefing-map-mode-toggle',
      '.basemap-switcher',
    ]
    const boxes = Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector(selector)
      if (!element) return [selector, null]
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return [selector, {
        display: style.display,
        visibility: style.visibility,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }]
    }))
    return {
      innerWidth,
      innerHeight,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      routeBriefingMapMode: document.querySelector('.map-view-wrapper')?.dataset.routeBriefingMapMode || null,
      boxes,
    }
  })
  log.push({ viewport: viewport.size, state, screenshot: fileName, metrics })
  console.log(`${viewport.size} ${state} ${file.pathname}`)
}

await mkdir(OUT_DIR, { recursive: true })
await mkdir(REVIEW_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  const phone = await browser.newPage({ viewport: phoneViewport })
  await waitForMain(phone)
  await openRoutePanel(phone)
  await collect(phone, phoneViewport, 'route-form', 'phone-route-form.png')
  await phone.locator('.route-briefing-map-mode-toggle').click({ timeout: 10_000 })
  await phone.waitForTimeout(350)
  await collect(phone, phoneViewport, 'route-map-mode', 'phone-route-map-mode.png')
  await phone.close()

  const tablet = await browser.newPage({ viewport: tabletViewport })
  await waitForMain(tablet)
  await openRoutePanel(tablet)
  await collect(tablet, tabletViewport, 'route-panel-tablet-sanity', 'tablet-portrait-route-panel-sanity.png')
  await tablet.close()
} finally {
  await browser.close()
}

await writeFile(new URL('capture-log.json', REVIEW_DIR), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
