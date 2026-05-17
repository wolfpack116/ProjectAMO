import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../../../frontend/node_modules/playwright/index.mjs'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const OUT_DIR = new URL('./', import.meta.url)
const REVIEW_DIR = new URL('./review/', import.meta.url)

const phoneViewport = { name: 'phone', size: '390x844', width: 390, height: 844 }
const tabletViewport = { name: 'tablet-portrait', size: '820x1180', width: 820, height: 1180 }
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
      '.left-panel-body',
      '.right-panel-top',
      '.map-panel-wrap',
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
  await clickPhoneTask(phone, 1)
  await collect(phone, phoneViewport, 'map-task', 'phone-map-task.png')
  await clickPhoneTask(phone, 2)
  await collect(phone, phoneViewport, 'settings-task', 'phone-settings-task.png')
  await phone.locator('.phone-settings-open').click({ timeout: 10_000 })
  await phone.locator('.alert-settings-modal').waitFor({ timeout: 10_000 })
  await phone.waitForTimeout(300)
  await collect(phone, phoneViewport, 'settings-task-modal-open', 'phone-settings-task-modal-open.png')
  await phone.close()

  const tablet = await browser.newPage({ viewport: tabletViewport })
  await gotoMonitoring(tablet)
  await collect(tablet, tabletViewport, 'monitoring-ops-tablet-sanity', 'tablet-portrait-monitoring-ops-sanity.png')
  await tablet.locator('.right-panel-top .settings-icon-btn').click({ timeout: 10_000 })
  await tablet.locator('.alert-settings-modal').waitFor({ timeout: 10_000 })
  await tablet.waitForTimeout(300)
  await collect(tablet, tabletViewport, 'monitoring-settings-modal-tablet-sanity', 'tablet-portrait-monitoring-settings-modal-sanity.png')
  await tablet.close()
} finally {
  await browser.close()
}

await writeFile(new URL('capture-log.json', REVIEW_DIR), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
