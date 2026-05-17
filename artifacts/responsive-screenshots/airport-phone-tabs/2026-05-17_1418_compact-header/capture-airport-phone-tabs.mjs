import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../../../frontend/node_modules/playwright/index.mjs'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const OUT_DIR = new URL('./', import.meta.url)
const REVIEW_DIR = new URL('./review/', import.meta.url)

const viewports = [
  { name: 'phone', size: '390x844', width: 390, height: 844 },
  { name: 'tablet-portrait', size: '820x1180', width: 820, height: 1180, sanityOnly: true },
]

const states = [
  { id: 'metar', tabText: 'METAR' },
  { id: 'taf-timeline', tabText: 'TAF', tafModeIndex: 0 },
  { id: 'taf-table', tabText: 'TAF', tafModeIndex: 1 },
  { id: 'taf-grid', tabText: 'TAF', tafModeIndex: 2 },
  { id: 'amos', tabText: 'AMOS' },
  { id: 'warning', tabIndex: 3 },
  { id: 'airport-info', tabIndex: 4 },
]

async function installFallbackHarness(page) {
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
      headers: {
        ...response.headers(),
        'content-type': 'application/javascript',
      },
    })
  })
}

async function waitForPanel(page) {
  await installFallbackHarness(page)
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.map-shell', { timeout: 20_000 })
  await page.waitForSelector('.airport-panel', { timeout: 20_000 })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
}

async function clickState(page, state) {
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

async function collect(page, viewport, state, fileName) {
  const file = new URL(fileName, OUT_DIR)
  await page.screenshot({ path: fileURLToPath(file), fullPage: false })
  return page.evaluate(({ viewport, state, fileName }) => {
    const selectors = ['.airport-panel', '.airport-panel-head', '.airport-panel-main', '.airport-panel-tabs', '.airport-panel-body']
    const boxes = Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector(selector)
      if (!element) return [selector, null]
      const rect = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return [selector, {
        display: style.display,
        flexDirection: style.flexDirection,
        overflowX: style.overflowX,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }]
    }))
    const activeTab = document.querySelector('.airport-panel-tab.is-active')
    return {
      viewport: viewport.size,
      state,
      screenshot: fileName,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      innerHeight,
      activeTabText: activeTab?.textContent?.trim() || null,
      boxes,
    }
  }, { viewport, state, fileName })
}

await mkdir(OUT_DIR, { recursive: true })
await mkdir(REVIEW_DIR, { recursive: true })

const browser = await chromium.launch()
const log = []

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport })
    await waitForPanel(page)
    const targetStates = viewport.sanityOnly ? [states[0]] : states
    for (const state of targetStates) {
      await clickState(page, state)
      const fileName = `${viewport.name}-${state.id}.png`
      log.push(await collect(page, viewport, state.id, fileName))
      console.log(`${viewport.size} ${state.id} ${fileName}`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}

await writeFile(new URL('capture-log.json', REVIEW_DIR), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
