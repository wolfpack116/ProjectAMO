import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../../../frontend/node_modules/playwright/index.mjs'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const OUT_DIR = new URL('./', import.meta.url)
const REVIEW_DIR = new URL('./review/', import.meta.url)

const phoneViewport = { name: 'phone', size: '390x844', width: 390, height: 844 }
const tabletViewport = { name: 'tablet-portrait', size: '820x1180', width: 820, height: 1180 }
const desktopViewport = { name: 'desktop', size: '1536x864', width: 1536, height: 864 }
const log = []

async function gotoMonitoring(page) {
  await page.goto(`${APP_URL}/monitoring?mode=ops`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.dashboard-root', { timeout: 20_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function collect(page, viewport, state, fileName) {
  const file = new URL(fileName, OUT_DIR)
  await page.screenshot({ path: fileURLToPath(file), fullPage: false })
  const metrics = await page.evaluate(() => {
    const selectors = [
      '.dashboard-root',
      '.phone-task-tabs',
      '.monitoring-header-controls',
      '.phone-settings-task',
      '.phone-settings-inline',
      '.left-panel-body',
      '.right-panel-top',
      '.map-panel-wrap',
      '.alert-settings-overlay',
      '.alert-settings-modal',
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
      boxes,
      phoneTask: document.querySelector('.dashboard-root')?.dataset.phoneTask || null,
    }
  })
  log.push({ viewport: viewport.size, state, screenshot: fileName, metrics })
  console.log(`${viewport.size} ${state} ${file.pathname}`)
}

async function clickPhoneTask(page, index) {
  await page.locator('.phone-task-tab').nth(index).click({ timeout: 10_000 })
  await page.waitForTimeout(300)
}

await mkdir(OUT_DIR, { recursive: true })
await mkdir(REVIEW_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  const phone = await browser.newPage({ viewport: phoneViewport })
  await gotoMonitoring(phone)
  await collect(phone, phoneViewport, 'weather-task', 'phone-weather-task.png')
  await clickPhoneTask(phone, 2)
  await phone.locator('.phone-settings-inline').waitFor({ timeout: 10_000 })
  await collect(phone, phoneViewport, 'settings-inline-task', 'phone-settings-inline-task.png')
  await phone.locator('.phone-settings-inline .alert-settings-tab-btn').nth(1).click({ timeout: 10_000 })
  await phone.waitForTimeout(300)
  await collect(phone, phoneViewport, 'settings-alert-inline-task', 'phone-settings-alert-inline-task.png')
  await phone.close()

  const tablet = await browser.newPage({ viewport: tabletViewport })
  await gotoMonitoring(tablet)
  await collect(tablet, tabletViewport, 'monitoring-ops-tablet-sanity', 'tablet-portrait-monitoring-ops-sanity.png')
  await tablet.locator('.right-panel-top .settings-icon-btn').click({ timeout: 10_000 })
  await tablet.locator('.alert-settings-overlay .alert-settings-modal').waitFor({ timeout: 10_000 })
  await tablet.waitForTimeout(300)
  await collect(tablet, tabletViewport, 'monitoring-settings-modal-tablet-sanity', 'tablet-portrait-monitoring-settings-modal-sanity.png')
  await tablet.close()

  const desktop = await browser.newPage({ viewport: desktopViewport })
  await gotoMonitoring(desktop)
  await desktop.locator('.right-panel-top .settings-icon-btn').click({ timeout: 10_000 })
  await desktop.locator('.alert-settings-overlay .alert-settings-modal').waitFor({ timeout: 10_000 })
  await desktop.waitForTimeout(300)
  await collect(desktop, desktopViewport, 'monitoring-settings-modal-desktop-sanity', 'desktop-monitoring-settings-modal-sanity.png')
  await desktop.close()
} finally {
  await browser.close()
}

await writeFile(new URL('capture-log.json', REVIEW_DIR), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
