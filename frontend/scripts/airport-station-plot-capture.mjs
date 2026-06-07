import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import AIRPORTS from '../../shared/airports.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..')
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const backendUrl = process.env.PROJECTAMO_BACKEND_URL || 'http://127.0.0.1:3001'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR

if (!outDir) {
  throw new Error('PROJECTAMO_CAPTURE_DIR is required')
}

const AIRPORT_BY_ICAO = Object.fromEntries(AIRPORTS.map((airport) => [airport.icao, airport]))
const CAPTURE_AIRPORTS = ['RKSI', 'RKPC', 'RKNY', 'RKSS']
const MAP_CENTER = { lon: 127.5, lat: 36.5 }
const MAP_ZOOM = 6
const WORLD_SIZE = 512 * (2 ** MAP_ZOOM)
const LABELS = {
  RKSI: 'no-weather-vfr',
  RKPC: 'ceiling-and-present-weather',
  RKNY: 'present-weather-second-wind-direction',
  RKSS: 'calm-wind-no-barb',
}

function mercatorX(lon) {
  return ((lon + 180) / 360) * WORLD_SIZE
}

function mercatorY(lat) {
  const sinLat = Math.sin((lat * Math.PI) / 180)
  return (0.5 - (Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))) * WORLD_SIZE
}

function projectAirport(airport, box) {
  const centerX = mercatorX(MAP_CENTER.lon)
  const centerY = mercatorY(MAP_CENTER.lat)
  const x = mercatorX(airport.lon) - centerX + (box.width / 2)
  const y = mercatorY(airport.lat) - centerY + (box.height / 2)
  return {
    x: box.x + x,
    y: box.y + y,
  }
}

function clampClip(clip, viewport) {
  return {
    x: Math.max(0, Math.min(clip.x, viewport.width - 1)),
    y: Math.max(0, Math.min(clip.y, viewport.height - 1)),
    width: Math.max(1, Math.min(clip.width, viewport.width - clip.x)),
    height: Math.max(1, Math.min(clip.height, viewport.height - clip.y)),
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  await fs.mkdir(path.join(outDir, 'review'), { recursive: true })

  const metarResponse = await fetch(`${backendUrl}/api/metar`)
  if (!metarResponse.ok) {
    throw new Error(`Failed to load METAR fixture: HTTP ${metarResponse.status}`)
  }
  const metar = await metarResponse.json()
  if (metar?.airports?.RKSS?.observation?.wind) {
    metar.airports.RKSS.observation.wind = {
      ...metar.airports.RKSS.observation.wind,
      raw: '00000KT',
      direction: null,
      speed: 0,
      calm: true,
      variable: false,
      barb: null,
    }
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const consoleEntries = []

  try {
    page.on('console', (message) => {
      consoleEntries.push({
        type: message.type(),
        text: message.text(),
      })
    })
    page.on('pageerror', (error) => {
      consoleEntries.push({
        type: 'pageerror',
        text: error.message,
      })
    })

    await page.route('**/api/metar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(metar),
      })
    })
    await page.route('**/api/warning', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'null',
      })
    })

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.mapboxgl-canvas')
    await page.waitForTimeout(4000)

    const mapBox = await page.locator('.map-view').boundingBox()
    if (!mapBox) {
      throw new Error('Map viewport was not found')
    }

    await page.locator('.map-view').screenshot({
      path: path.join(outDir, 'map-overview-standard.png'),
    })

    const viewport = page.viewportSize()
    for (const icao of CAPTURE_AIRPORTS) {
      const airport = AIRPORT_BY_ICAO[icao]
      const point = projectAirport(airport, mapBox)
      const clip = clampClip({
        x: Math.round(point.x - 120),
        y: Math.round(point.y - 110),
        width: 240,
        height: 220,
      }, viewport)
      await page.screenshot({
        path: path.join(outDir, `${icao.toLowerCase()}-${LABELS[icao]}.png`),
        clip,
      })
    }
    for (const icao of ['RKPC', 'RKNY']) {
      const airport = AIRPORT_BY_ICAO[icao]
      const point = projectAirport(airport, mapBox)
      const clip = clampClip({
        x: Math.round(point.x - 90),
        y: Math.round(point.y - 85),
        width: 180,
        height: 170,
      }, viewport)
      await page.screenshot({
        path: path.join(outDir, `${icao.toLowerCase()}-tight.png`),
        clip,
      })
    }

    const rksiPoint = projectAirport(AIRPORT_BY_ICAO.RKSI, mapBox)
    await page.mouse.click(rksiPoint.x, rksiPoint.y)
    await page.waitForTimeout(1500)
    const selectedMapBox = await page.locator('.map-view').boundingBox()
    const selectedPoint = projectAirport(AIRPORT_BY_ICAO.RKSI, selectedMapBox)
    const selectedClip = clampClip({
      x: Math.round(selectedPoint.x - 130),
      y: Math.round(selectedPoint.y - 120),
      width: 260,
      height: 240,
    }, viewport)
    await page.screenshot({
      path: path.join(outDir, 'selected-airport-highlight.png'),
      clip: selectedClip,
    })

    await page.locator('.basemap-switcher-toggle').dispatchEvent('click')
    await page.waitForSelector('.basemap-switcher-menu', { timeout: 5000 })
    await page.locator('.basemap-switcher-item').filter({ hasText: 'Dark' }).click({ timeout: 5000, force: true })
    await page.waitForTimeout(3500)
    await page.locator('.map-view').screenshot({
      path: path.join(outDir, 'map-overview-dark.png'),
    })
    const darkSelectedMapBox = await page.locator('.map-view').boundingBox()
    const darkSelectedPoint = projectAirport(AIRPORT_BY_ICAO.RKSI, darkSelectedMapBox)
    const darkSelectedClip = clampClip({
      x: Math.round(darkSelectedPoint.x - 130),
      y: Math.round(darkSelectedPoint.y - 120),
      width: 260,
      height: 240,
    }, viewport)
    await page.screenshot({
      path: path.join(outDir, 'selected-airport-highlight-dark.png'),
      clip: darkSelectedClip,
    })

    const missingImageWarnings = consoleEntries.filter((entry) => (
      /missing image|styleimagemissing|airport-(station|wind|wx)/i.test(entry.text)
    ))
    await writeJson(path.join(outDir, 'console-log.json'), consoleEntries)
    await writeJson(path.join(outDir, 'console-missing-image-check.json'), {
      missingImageWarnings,
      hasMissingImageWarnings: missingImageWarnings.length > 0,
    })

    const notes = [
      '# Airport Station Plot Marker Review',
      '',
      '- Status: manual focused capture complete',
      '- Console missing-image warnings: none expected; see `console-missing-image-check.json`',
      '- Mocking note: `/api/metar` was intercepted only to force `RKSS` calm wind for the required no-barb evidence. `/api/warning` was intercepted to `null` so the airport panel warning widget does not introduce unrelated console noise during selected-marker capture. Other airport states used the current local METAR payload.',
      '',
      '## Captures',
      '',
      '- `map-overview-standard.png`: overview showing no-weather VFR, ceiling, present weather, and multiple wind directions',
      '- `rksi-no-weather-vfr.png`: RKSI VFR clear marker',
      '- `rkpc-ceiling-and-present-weather.png`: RKPC ceiling + weather marker',
      '- `rkny-present-weather-second-wind-direction.png`: RKNY present weather + alternate wind direction',
      '- `rkpc-tight.png`: tighter RKPC crop for weather icon and ceiling legibility',
      '- `rkny-tight.png`: tighter RKNY crop for weather icon and wind-direction legibility',
      '- `rkss-calm-wind-no-barb.png`: RKSS calm wind with no wind barb',
      '- `selected-airport-highlight.png`: selected airport outer highlight',
      '- `map-overview-dark.png`: post-basemap-switch overview',
      '- `selected-airport-highlight-dark.png`: selected airport highlight after basemap switch',
      '',
    ]
    await fs.writeFile(path.join(outDir, 'review', 'issues.md'), `${notes.join('\n')}\n`, 'utf8')
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
