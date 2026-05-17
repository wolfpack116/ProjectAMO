import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../../../frontend/node_modules/playwright/index.mjs'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const OUT_DIR = new URL('./', import.meta.url)
const REVIEW_DIR = new URL('./review/', import.meta.url)

const phone = { name: 'phone', size: '390x844', width: 390, height: 844 }
const tablet = { name: 'tablet-portrait', size: '820x1180', width: 820, height: 1180 }
const desktop = { name: 'desktop', size: '1536x864', width: 1536, height: 864 }
const log = []

async function capture(page, viewport, state, fileName, selectors) {
  const file = new URL(fileName, OUT_DIR)
  await page.screenshot({ path: fileURLToPath(file), fullPage: false })
  const metrics = await page.evaluate(({ selectors, viewport, state, fileName }) => {
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
      viewport: viewport.size,
      state,
      screenshot: fileName,
      innerWidth,
      innerHeight,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      boxes,
    }
  }, { selectors, viewport, state, fileName })
  log.push(metrics)
  console.log(`${viewport.size} ${state} ${fileName}`)
}

async function waitForMain(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.map-shell', { timeout: 20_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function clickSidebarPanel(page, index) {
  await page.locator('.sidebar-menu-list .sidebar-icon-button').nth(index).click({ timeout: 10_000 })
  await page.waitForTimeout(350)
}

async function captureMainMap(browser) {
  const selectors = ['.sidebar', '.map-shell', '.map-view-wrapper', '.map-view', '.route-check-panel', '.route-briefing-map-mode-toggle']
  for (const viewport of [phone, tablet, desktop]) {
    const page = await browser.newPage({ viewport })
    await waitForMain(page)
    await capture(page, viewport, 'main-map-none', `${viewport.name}-main-map-none.png`, selectors)
    await page.close()
  }
}

async function captureRouteBriefing(browser) {
  const selectors = ['.sidebar', '.map-shell', '.map-view-wrapper', '.map-view', '.route-check-panel', '.route-briefing-map-mode-toggle', '.basemap-switcher']

  const routePhone = await browser.newPage({ viewport: phone })
  await waitForMain(routePhone)
  await clickSidebarPanel(routePhone, 4)
  await routePhone.locator('.route-check-panel').waitFor({ timeout: 10_000 })
  await capture(routePhone, phone, 'route-form', 'phone-route-form.png', selectors)
  await routePhone.locator('.route-briefing-map-mode-toggle').click({ timeout: 10_000 })
  await routePhone.waitForTimeout(350)
  await capture(routePhone, phone, 'route-map-mode', 'phone-route-map-mode.png', selectors)
  await routePhone.close()

  const routeTablet = await browser.newPage({ viewport: tablet })
  await waitForMain(routeTablet)
  await clickSidebarPanel(routeTablet, 4)
  await routeTablet.locator('.route-check-panel').waitFor({ timeout: 10_000 })
  await capture(routeTablet, tablet, 'route-tablet-sanity', 'tablet-route-panel-sanity.png', selectors)
  await routeTablet.close()
}

async function gotoMonitoring(page, mode = 'ops') {
  await page.goto(`${APP_URL}/monitoring?mode=${mode}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.dashboard-root', { timeout: 20_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function clickPhoneMonitoringTask(page, index) {
  await page.locator('.phone-task-tab').nth(index).click({ timeout: 10_000 })
  await page.waitForTimeout(300)
}

async function captureMonitoring(browser) {
  const selectors = [
    '.dashboard-root',
    '.phone-task-tabs',
    '.monitoring-header-controls',
    '.left-panel-body',
    '.map-panel-wrap',
    '.phone-settings-inline',
    '.alert-settings-overlay',
    '.alert-settings-modal',
  ]

  const monitoringPhone = await browser.newPage({ viewport: phone })
  await gotoMonitoring(monitoringPhone)
  await capture(monitoringPhone, phone, 'monitoring-weather-task', 'phone-monitoring-weather-task.png', selectors)
  await clickPhoneMonitoringTask(monitoringPhone, 1)
  await capture(monitoringPhone, phone, 'monitoring-map-task', 'phone-monitoring-map-task.png', selectors)
  await clickPhoneMonitoringTask(monitoringPhone, 2)
  await monitoringPhone.locator('.phone-settings-inline').waitFor({ timeout: 10_000 })
  await capture(monitoringPhone, phone, 'monitoring-settings-inline', 'phone-monitoring-settings-inline.png', selectors)
  await monitoringPhone.locator('.phone-settings-inline .alert-settings-tab-btn').nth(1).click({ timeout: 10_000 })
  await monitoringPhone.waitForTimeout(300)
  await capture(monitoringPhone, phone, 'monitoring-settings-alert-inline', 'phone-monitoring-settings-alert-inline.png', selectors)
  await monitoringPhone.close()

  for (const viewport of [tablet, desktop]) {
    const page = await browser.newPage({ viewport })
    await gotoMonitoring(page)
    await page.locator('.right-panel-top .settings-icon-btn').click({ timeout: 10_000 })
    await page.locator('.alert-settings-overlay .alert-settings-modal').waitFor({ timeout: 10_000 })
    await page.waitForTimeout(300)
    await capture(page, viewport, 'monitoring-settings-modal-sanity', `${viewport.name}-monitoring-settings-modal-sanity.png`, selectors)
    await page.close()
  }
}

async function installAirportFallbackHarness(page) {
  await page.route('**/src/features/map/MapView.jsx*', async (route) => {
    const response = await route.fetch()
    let body = await response.text()
    body = body.replace(
      '  const mapContainerRef = useRef(null)',
      `  useEffect(() => {
    if (!selectedAirport && airports.some((airport) => airport.icao === 'RKSI')) {
      onAirportSelect?.('RKSI')
    }
  }, [airports, selectedAirport, onAirportSelect])

  const mapContainerRef = useRef(null)`,
    )
    await route.fulfill({
      response,
      body,
      headers: { ...response.headers(), 'content-type': 'application/javascript' },
    })
  })
}

async function waitForAirportPanel(page) {
  await installAirportFallbackHarness(page)
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.map-shell', { timeout: 20_000 })
  await page.waitForSelector('.airport-panel', { timeout: 20_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function clickAirportState(page, state) {
  const tabs = page.locator('.airport-panel-tab')
  if (state.tabText) {
    await tabs.filter({ hasText: state.tabText }).first().click({ timeout: 10_000 })
  } else {
    await tabs.nth(state.tabIndex).click({ timeout: 10_000 })
  }
  if (Number.isInteger(state.tafModeIndex)) {
    await page.locator('.ap-taf-switch-btn').nth(state.tafModeIndex).click({ timeout: 10_000 })
  }
  await page.waitForTimeout(300)
}

async function captureAirport(browser) {
  const selectors = ['.airport-panel', '.airport-panel-head', '.airport-panel-tabs', '.airport-panel-body']
  const states = [
    { id: 'metar', tabText: 'METAR' },
    { id: 'taf-timeline', tabText: 'TAF', tafModeIndex: 0 },
    { id: 'taf-table', tabText: 'TAF', tafModeIndex: 1 },
    { id: 'taf-grid', tabText: 'TAF', tafModeIndex: 2 },
    { id: 'amos', tabText: 'AMOS' },
    { id: 'warning', tabIndex: 3 },
    { id: 'airport-info', tabIndex: 4 },
  ]

  const airportPhone = await browser.newPage({ viewport: phone })
  await waitForAirportPanel(airportPhone)
  for (const state of states) {
    await clickAirportState(airportPhone, state)
    await capture(airportPhone, phone, `airport-${state.id}`, `phone-airport-${state.id}.png`, selectors)
  }
  await airportPhone.close()

  const airportTablet = await browser.newPage({ viewport: tablet })
  await waitForAirportPanel(airportTablet)
  await clickAirportState(airportTablet, states[0])
  await capture(airportTablet, tablet, 'airport-tablet-sanity', 'tablet-airport-metar-sanity.png', selectors)
  await airportTablet.close()
}

await mkdir(OUT_DIR, { recursive: true })
await mkdir(REVIEW_DIR, { recursive: true })

const browser = await chromium.launch()
try {
  await captureMainMap(browser)
  await captureRouteBriefing(browser)
  await captureMonitoring(browser)
  await captureAirport(browser)
} finally {
  await browser.close()
}

await writeFile(new URL('capture-log.json', REVIEW_DIR), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
