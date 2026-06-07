import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import AIRPORTS from '../../shared/airports.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR

if (!outDir) {
  throw new Error('PROJECTAMO_CAPTURE_DIR is required')
}

const TARGET_ICAO = process.env.PROJECTAMO_CAPTURE_ICAO || 'RKPU'
const MAP_CENTER = { lon: 127.5, lat: 36.5 }
const MAP_ZOOM = 6
const WORLD_SIZE = 512 * (2 ** MAP_ZOOM)
const airport = AIRPORTS.find((item) => item.icao === TARGET_ICAO)

if (!airport) {
  throw new Error(`Unknown airport ICAO: ${TARGET_ICAO}`)
}

function mercatorX(lon) {
  return ((lon + 180) / 360) * WORLD_SIZE
}

function mercatorY(lat) {
  const sinLat = Math.sin((lat * Math.PI) / 180)
  return (0.5 - (Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))) * WORLD_SIZE
}

function projectAirport(box) {
  const centerX = mercatorX(MAP_CENTER.lon)
  const centerY = mercatorY(MAP_CENTER.lat)
  const x = mercatorX(airport.lon) - centerX + (box.width / 2)
  const y = mercatorY(airport.lat) - centerY + (box.height / 2)
  return {
    x: box.x + x,
    y: box.y + y,
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function run() {
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const consoleEntries = []

  try {
    page.on('console', (message) => {
      consoleEntries.push({ type: message.type(), text: message.text() })
    })
    page.on('pageerror', (error) => {
      consoleEntries.push({ type: 'pageerror', text: error.message })
    })

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-view')
    await page.waitForTimeout(3500)

    const mapBox = await page.locator('.map-view').boundingBox()
    if (!mapBox) throw new Error('Map viewport was not found')

    const point = projectAirport(mapBox)
    await page.mouse.click(point.x, point.y)
    await page.waitForSelector('.airport-panel', { timeout: 8000 })
    await page.waitForTimeout(1000)

    await page.locator('.airport-panel').screenshot({
      path: path.join(outDir, `airport-panel-${TARGET_ICAO.toLowerCase()}.png`),
    })

    await writeJson(path.join(outDir, 'console-log.json'), consoleEntries)
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
