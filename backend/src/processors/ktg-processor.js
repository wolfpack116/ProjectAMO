import { NetCDFReader } from 'netcdfjs'
import config from '../config.js'
import {
  KTG_FORECAST_HOURS,
  addForecastHoursKtg,
  buildKtgCoords,
  buildKtgGrid,
} from './ktg-model.js'
import {
  cleanupKtgRuns,
  readKtgLatest,
  writeKtgCoords,
  writeKtgGrid,
  writeKtgIndex,
  writeKtgLatest,
} from './ktg-store.js'
import { selectNearestForecastHour } from './kim-forecast-hour.js'

const TYPE = 'ktg'
const SYNOPTIC_HOURS = [0, 6, 12, 18]

function formatTmfc(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}`
}

function latestSynopticCycle(now = new Date()) {
  const h = now.getUTCHours()
  const cycle = [...SYNOPTIC_HOURS].reverse().find((c) => c <= h) ?? 18
  const d = new Date(now)
  if (cycle === 18 && h < 18) d.setUTCDate(d.getUTCDate() - 1)
  d.setUTCHours(cycle, 0, 0, 0)
  return d
}

export function resolveKtgCandidates(now = new Date()) {
  const cycle = latestSynopticCycle(now)
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(cycle.getTime() - i * 6 * 3600000)
    return formatTmfc(d)
  })
}

async function fetchKtgFile({ tmfc, ef }) {
  const efStr = String(Number(ef)).padStart(2, '0')
  const url = `https://apihub.kma.go.kr/api/typ01/url/amo_nwp_file_down.php?tmfc=${tmfc}&ef=${efStr}&authKey=${config.api.auth_key}`
  const timeoutMs = config.ktg?.timeout_ms ?? 60000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`KTG API HTTP ${res.status} for tmfc=${tmfc} ef=${efStr}`)
    const buf = await res.arrayBuffer()
    return Buffer.from(buf)
  } finally {
    clearTimeout(timer)
  }
}

function parseKtgNetCdf(buffer) {
  const nc = new NetCDFReader(buffer)
  const nz = nc.dimensions.find((d) => d.name === 'nz')?.size ?? 0
  const ny = nc.dimensions.find((d) => d.name === 'ny')?.size ?? 0
  const nx = nc.dimensions.find((d) => d.name === 'nx')?.size ?? 0
  if (nz === 0 || ny === 0 || nx === 0) throw new Error('KTG NetCDF: unexpected dimensions')
  const lat = nc.getDataVariable('lat')
  const lon = nc.getDataVariable('lon')
  const alt = nc.getDataVariable('alt')
  const ktg = nc.getDataVariable('KTG')
  return { lat, lon, alt, ktg, nz, ny, nx }
}

export async function process() {
  const candidates = resolveKtgCandidates()
  const forecastHours = config.ktg?.forecast_hours ?? KTG_FORECAST_HOURS
  const single = config.ktg?.single_forecast !== false

  for (const tmfc of candidates) {
    const hf = single
      ? selectNearestForecastHour({ tmfc, nowMs: Date.now(), candidateHours: forecastHours })
      : forecastHours[0]

    const latest = readKtgLatest(config.storage.base_path)
    if (latest?.tmfc === tmfc && latest?.hf === hf) {
      return { type: TYPE, skipped: true, reason: 'already_collected', tmfc, hf }
    }

    let buffer
    try {
      buffer = await fetchKtgFile({ tmfc, ef: hf })
    } catch (err) {
      console.warn(`[ktg] skipping tmfc=${tmfc} hf=${hf}: ${err.message}`)
      continue
    }

    const { lat, lon, alt, ktg, nz, ny, nx } = parseKtgNetCdf(buffer)
    const validTime = addForecastHoursKtg(tmfc, hf)
    const fetchedAt = new Date().toISOString()

    // coords.json — shared across all altitude levels for this hf
    const coords = buildKtgCoords({ ny, nx, lat, lon })
    writeKtgCoords({ root: config.storage.base_path, tmfc, hf, coords })

    // one grid.json per altitude level
    for (let zi = 0; zi < nz; zi++) {
      const altFt = alt[zi]
      const sliceStart = zi * ny * nx
      const ktgSlice = ktg.slice(sliceStart, sliceStart + ny * nx)
      const grid = buildKtgGrid({ tmfc, hf, altFt, validTime, ny, nx, ktgSlice, fetchedAt })
      writeKtgGrid({ root: config.storage.base_path, grid })
    }

    const index = {
      type: 'ktg_index',
      tmfc,
      hf,
      validTime,
      altLevelsFt: Array.from(alt),
      fetched_at: fetchedAt,
    }
    writeKtgIndex(config.storage.base_path, index)
    writeKtgLatest(config.storage.base_path, {
      type: 'ktg_latest',
      tmfc,
      hf,
      validTime,
      updated_at: fetchedAt,
    })
    cleanupKtgRuns({
      root: config.storage.base_path,
      maxRuns: config.ktg?.max_runs ?? 2,
      latestTmfc: tmfc,
    })

    return { type: TYPE, tmfc, hf, validTime, altLevels: nz, ny, nx }
  }

  throw new Error('KTG collection failed: no valid candidate found')
}

export default { process, resolveKtgCandidates }
