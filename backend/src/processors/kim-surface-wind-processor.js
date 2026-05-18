import config from '../config.js'
import { fetchKimGrid } from '../api-client.js'
import { parseKimGridText } from '../parsers/kim-grid-parser.js'
import store from '../store.js'

const TYPE = 'kim_surface_wind'
const MODEL = 'KIMG/NE57'
const SCALE = 0.01
const OFFSET = 0
const SYNOPTIC_HOURS = [0, 6, 12, 18]

function round(value, digits = 3) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function encodeComponent(values) {
  return values.map((value) => Math.round((value - OFFSET) / SCALE))
}

function parseTmfc(tmfc) {
  const raw = String(tmfc || '')
  if (!/^\d{10}$/.test(raw)) return null
  return Date.UTC(
    Number(raw.slice(0, 4)),
    Number(raw.slice(4, 6)) - 1,
    Number(raw.slice(6, 8)),
    Number(raw.slice(8, 10)),
    0,
    0,
    0,
  )
}

function addForecastHours(tmfc, hf) {
  const baseMs = parseTmfc(tmfc)
  if (!Number.isFinite(baseMs)) return null
  return new Date(baseMs + Number(hf || 0) * 60 * 60 * 1000).toISOString()
}

function formatTmfc(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  return `${y}${m}${d}${h}`
}

function latestSynopticCycle(date) {
  const utc = new Date(date)
  const hour = utc.getUTCHours()
  const cycleHour = [...SYNOPTIC_HOURS].reverse().find((candidate) => candidate <= hour) ?? 18
  if (cycleHour === 18 && hour < 18) utc.setUTCDate(utc.getUTCDate() - 1)
  utc.setUTCHours(cycleHour, 0, 0, 0)
  return utc
}

export function resolveKimSurfaceWindCandidates(now = new Date()) {
  const cycle = latestSynopticCycle(now)
  return Array.from({ length: 8 }, (_, index) => {
    const candidate = new Date(cycle.getTime() - index * 6 * 60 * 60 * 1000)
    return { tmfc: formatTmfc(candidate), hf: 0 }
  })
}

function validateGridPair(uGrid, vGrid) {
  if (!uGrid || !vGrid) throw new Error('KIM surface wind requires u and v grids')
  if (uGrid.nx !== vGrid.nx || uGrid.ny !== vGrid.ny) {
    throw new Error('KIM u/v grids have different dimensions')
  }
  if (uGrid.values.length !== vGrid.values.length) {
    throw new Error('KIM u/v grids have different value counts')
  }
}

function expectedDimension(min, max, step) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) return null
  return Math.round((max - min) / step) + 1
}

function validateGridBounds(grid) {
  const bounds = grid?.bounds || {}
  const expectedNx = expectedDimension(bounds.lonMin, bounds.lonMax, bounds.dx)
  const expectedNy = expectedDimension(bounds.latMin, bounds.latMax, bounds.dy)
  if (expectedNx && grid.nx !== expectedNx) {
    throw new Error(`KIM grid nx mismatch: expected ${expectedNx}, got ${grid.nx}`)
  }
  if (expectedNy && grid.ny !== expectedNy) {
    throw new Error(`KIM grid ny mismatch: expected ${expectedNy}, got ${grid.ny}`)
  }
}

export function buildKimSurfaceWindField({ uGrid, vGrid, tmfc, hf, fetchedAt = new Date().toISOString() }) {
  validateGridPair(uGrid, vGrid)
  validateGridBounds(uGrid)

  let minSpeed = Infinity
  let maxSpeed = -Infinity
  let totalSpeed = 0
  for (let index = 0; index < uGrid.values.length; index += 1) {
    const speed = Math.hypot(uGrid.values[index], vGrid.values[index])
    minSpeed = Math.min(minSpeed, speed)
    maxSpeed = Math.max(maxSpeed, speed)
    totalSpeed += speed
  }

  return {
    type: TYPE,
    model: MODEL,
    grid: {
      nx: uGrid.nx,
      ny: uGrid.ny,
      ...uGrid.bounds,
    },
    time: {
      tmfc,
      hf,
      validTime: addForecastHours(tmfc, hf),
    },
    units: { u: 'm/s', v: 'm/s', speed: 'm/s' },
    stats: {
      minSpeed: round(minSpeed),
      maxSpeed: round(maxSpeed),
      meanSpeed: round(totalSpeed / uGrid.values.length),
    },
    encoding: 'int16-scaled-json-v1',
    scale: SCALE,
    offset: OFFSET,
    u: encodeComponent(uGrid.values),
    v: encodeComponent(vGrid.values),
    fetched_at: fetchedAt,
  }
}

async function fetchComponent({ name, tmfc, hf }) {
  const kim = config.kim_surface_wind
  const text = await fetchKimGrid({
    data: 'U',
    name,
    level: 0,
    tmfc,
    hf,
    sub: kim.sub,
    map: 'S',
    disp: 'A',
  })
  return parseKimGridText(text, {
    variable: name,
    level: 0,
    bounds: kim.bounds,
  })
}

export async function process() {
  const candidates = resolveKimSurfaceWindCandidates()
  let lastError = null

  for (const candidate of candidates) {
    try {
      const [uGrid, vGrid] = await Promise.all([
        fetchComponent({ name: 'u10m', ...candidate }),
        fetchComponent({ name: 'v10m', ...candidate }),
      ])
      const field = buildKimSurfaceWindField({
        uGrid,
        vGrid,
        tmfc: candidate.tmfc,
        hf: candidate.hf,
      })
      return store.save(TYPE, field)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('KIM surface wind collection failed')
}

export default {
  process,
  buildKimSurfaceWindField,
  resolveKimSurfaceWindCandidates,
}
