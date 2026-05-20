import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import store from './src/store.js'
import stats from './src/stats.js'
import config from './src/config.js'
import { main as startScheduler } from './src/index.js'
import warningTypes from '../shared/warning-types.js'
import alertDefaults from '../shared/alert-defaults.js'
import { buildVerticalProfile } from './src/briefing/vertical-profile.js'
import { createDefaultTerrainSampler } from './src/terrain/terrain-sampler.js'
import {
  buildKimCloudPotentialFieldFromGrid,
  KIM_NWP_MOISTURE_LEVEL_IDS,
  buildKimTemperatureFieldFromGrid,
  buildKimSurfaceWindFieldFromWindGrid,
  filterKimNwpIndexForVariables,
} from './src/processors/kim-nwp-model.js'
import {
  readKimNwpGrid,
  readKimNwpIndex,
  readKimNwpLatest,
  validateKimNwpSelection,
} from './src/processors/kim-nwp-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.BACKEND_PORT || 3001
const HOST = process.env.BACKEND_HOST || '127.0.0.1'
const DATA_ROOT = config.storage.base_path
const terrainSampler = createDefaultTerrainSampler(DATA_ROOT)

app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(express.json({ limit: '1mb' }))

function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

function setGeneratedDataCacheHeaders(res, filePath) {
  const relPath = path.relative(DATA_ROOT, filePath).replace(/\\/g, '/')

  if (/^radar\/echo_korea_\d{12}\.png$/i.test(relPath)) {
    res.setHeader('Cache-Control', 'public, max-age=10800, immutable')
    return
  }

  if (/^satellite\/sat_korea_\d{12}\.(?:png|webp)$/i.test(relPath)) {
    res.setHeader('Cache-Control', 'public, max-age=10800, immutable')
    return
  }

  if (/^sigwx_low\/(?:fronts|clouds)_\d{10}\.png$/i.test(relPath)) {
    res.setHeader('Cache-Control', 'public, max-age=10800, immutable')
    return
  }

  if (
    relPath === 'radar/echo_meta.json'
    || relPath === 'satellite/sat_meta.json'
    || /^sigwx_low\/(?:fronts_meta|clouds_meta)_\d{10}\.json$/i.test(relPath)
  ) {
    res.setHeader('Cache-Control', 'no-cache')
    return
  }

  res.setHeader('Cache-Control', 'no-cache')
}

app.use('/data', express.static(DATA_ROOT, { setHeaders: setGeneratedDataCacheHeaders }))
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

function readLatest(type) {
  const cached = store.getCached(type)
  const filePath = path.join(DATA_ROOT, type, 'latest.json')

  if (!fs.existsSync(filePath)) return cached

  const latest = readJsonFileSafe(filePath)
  if (!latest) return cached

  const diskHash = latest.content_hash || store.canonicalHash(latest)
  const cachedHash = cached?.content_hash || (cached ? store.canonicalHash(cached) : null)

  if (cached && cachedHash === diskHash) return cached

  store.updateCache(type, latest, diskHash)
  return latest
}

function sendLatest(res, type) {
  const data = readLatest(type)
  if (data) return res.json(data)
  res.status(503).json({ error: `${type} data unavailable` })
}

function sendJsonFile(res, filePath) {
  const payload = readJsonFileSafe(filePath)
  if (payload) return res.json(payload)
  res.status(503).json({ error: 'data unavailable' })
}

function readRecent(type, limit = 10) {
  const dir = path.join(DATA_ROOT, type)
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir)
    .filter((name) => {
      if (!name.endsWith('.json') || name === 'latest.json') return false
      if (type === 'sigwx_low') return /^SIGWX_LOW_\d{10}\.json$/i.test(name)
      return true
    })
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)

  return files.map((name) => ({
    ...readJsonFileSafe(path.join(dir, name)),
    file_name: name,
  }))
}

function resolveSigwxTmfc(queryTmfc) {
  const requested = String(queryTmfc || '').trim()
  if (requested) return requested
  const data = readLatest('sigwx_low')
  return data?.tmfc || ''
}

function readSigwxOverlayMeta(kind, tmfc) {
  const normalized = String(tmfc || '').trim()
  if (!/^\d{10}$/.test(normalized)) return null
  const prefix = kind === 'clouds' ? 'clouds_meta' : 'fronts_meta'
  return readJsonFileSafe(path.join(DATA_ROOT, 'sigwx_low', `${prefix}_${normalized}.json`))
}

function sendSigwxOverlayMeta(req, res, kind) {
  const tmfc = resolveSigwxTmfc(req.query.tmfc)
  res.json(readSigwxOverlayMeta(kind, tmfc))
}

function buildHashEntry(type) {
  const data = readLatest(type)
  if (!data) return null
  return { hash: data.content_hash || store.canonicalHash(data) }
}

function buildKimNwpSnapshotEntry() {
  const latest = readKimNwpLatest(DATA_ROOT)
  if (!latest) return null
  const index = readKimNwpIndex(DATA_ROOT)
  const uvIndex = index ? filterKimNwpIndexForVariables(index, ['u', 'v']) : null
  const tempIndex = index ? filterKimNwpIndexForVariables(index, ['T']) : null
  const cloudIndex = index
    ? filterKimNwpIndexForLevels(filterKimNwpIndexForVariables(index, ['T', 'rh']), KIM_NWP_MOISTURE_LEVEL_IDS)
    : null
  return {
    hash: latest.content_hash || store.canonicalHash(latest),
    tmfc: latest.latestRun || null,
    updated_at: latest.updated_at || null,
    variables: {
      uv: { hash: uvIndex ? store.canonicalHash(uvIndex) : null },
      T: { hash: tempIndex ? store.canonicalHash(tempIndex) : null },
      cloud: { hash: cloudIndex ? store.canonicalHash(cloudIndex) : null },
    },
  }
}

function buildFrameEntry(filePath) {
  const payload = readJsonFileSafe(filePath)
  if (!payload?.tm) return null
  return { tm: payload.tm }
}

function buildSigwxOverlaySnapshotEntry(kind) {
  const tmfc = resolveSigwxTmfc()
  const meta = readSigwxOverlayMeta(kind, tmfc)
  if (!meta) return null
  return {
    tmfc: meta.tmfc || tmfc || null,
    source_hash: meta.source_hash || null,
    updated_at: meta.updated_at || null,
    render_version: meta.render_version || null,
  }
}

function buildSnapshotMeta() {
  const sigwxLow = buildHashEntry('sigwx_low')
  const echoMeta = buildFrameEntry(path.join(DATA_ROOT, 'radar', 'echo_meta.json'))
  const satMeta = buildFrameEntry(path.join(DATA_ROOT, 'satellite', 'sat_meta.json'))
  const sigwxFrontMeta = buildSigwxOverlaySnapshotEntry('fronts')
  const sigwxCloudMeta = buildSigwxOverlaySnapshotEntry('clouds')
  const groundForecast = buildHashEntry('ground_forecast')
  const groundOverview = buildHashEntry('ground_overview')
  const kimSurfaceWindData = readLatest('kim_surface_wind')
  const kimSurfaceWind = kimSurfaceWindData ? {
    hash: kimSurfaceWindData.content_hash || store.canonicalHash(kimSurfaceWindData),
    tmfc: kimSurfaceWindData.time?.tmfc || null,
    hf: kimSurfaceWindData.time?.hf ?? null,
    updated_at: kimSurfaceWindData.fetched_at || null,
  } : null
  const kimNwp = buildKimNwpSnapshotEntry()

  return {
    metar: buildHashEntry('metar'),
    taf: buildHashEntry('taf'),
    warning: buildHashEntry('warning'),
    sigmet: buildHashEntry('sigmet'),
    airmet: buildHashEntry('airmet'),
    sigwxLow,
    sigwx_low: sigwxLow,
    amos: buildHashEntry('amos'),
    lightning: buildHashEntry('lightning'),
    adsb: buildHashEntry('adsb'),
    kimNwp,
    kim_nwp: kimNwp,
    kimWind: kimNwp || kimSurfaceWind,
    kim_wind: kimNwp || kimSurfaceWind,
    kimSurfaceWind,
    kim_surface_wind: kimSurfaceWind,
    groundForecast,
    ground_forecast: groundForecast,
    groundOverview,
    ground_overview: groundOverview,
    environment: buildHashEntry('environment'),
    airportInfo: buildHashEntry('airport_info'),
    echoMeta,
    echo: echoMeta,
    satMeta,
    satellite: satMeta,
    sigwxFrontMeta,
    sigwxCloudMeta,
  }
}

export function filterKimNwpIndexForMap(index, nowMs = Date.now()) {
  const times = index?.times || []
  const pastTimes = []
  const futureTimes = []
  for (const time of times) {
    const validMs = Date.parse(time.validTime)
    if (!Number.isFinite(validMs)) continue
    if (validMs >= nowMs) futureTimes.push(time)
    else pastTimes.push({ time, validMs })
  }
  const nearestPast = pastTimes.reduce((nearest, candidate) => (
    !nearest || candidate.validMs > nearest.validMs ? candidate : nearest
  ), null)
  const exposedTimes = nearestPast ? [nearestPast.time, ...futureTimes] : futureTimes
  const exposedHfs = new Set(exposedTimes.map((time) => String(time.hf)))
  const availability = {}
  for (const [levelId, byHf] of Object.entries(index?.availability || {})) {
    for (const [hf, entry] of Object.entries(byHf || {})) {
      if (!exposedHfs.has(String(hf))) continue
      availability[levelId] ||= {}
      availability[levelId][String(hf)] = entry
    }
  }
  const levels = (index?.levels || []).filter((level) => availability[level.id])
  return { ...index, levels, times: exposedTimes, availability }
}

export function filterKimNwpIndexForMapVariables(index, requiredVariables = [], nowMs = Date.now()) {
  return filterKimNwpIndexForMap(filterKimNwpIndexForVariables(index, requiredVariables), nowMs)
}

function filterKimNwpIndexForLevels(index, levelIds = []) {
  const allowed = new Set(levelIds)
  const availability = {}
  for (const [levelId, byHf] of Object.entries(index?.availability || {})) {
    if (!allowed.has(levelId)) continue
    availability[levelId] = byHf
  }
  const availableHfs = new Set(Object.values(availability).flatMap((byHf) => Object.keys(byHf || {})))
  return {
    ...index,
    levels: (index?.levels || []).filter((level) => allowed.has(level.id) && availability[level.id]),
    times: (index?.times || []).filter((time) => availableHfs.has(String(time.hf))),
    availability,
  }
}

export function filterKimCloudIndexForMap(index, nowMs = Date.now()) {
  return filterKimNwpIndexForMap(
    filterKimNwpIndexForLevels(filterKimNwpIndexForVariables(index, ['T', 'rh']), KIM_NWP_MOISTURE_LEVEL_IDS),
    nowMs,
  )
}

function selectDefaultKimNwpField(index) {
  const preferredLevel = index?.levels?.find((level) => level.id === '10m') || index?.levels?.[0]
  if (!preferredLevel) return null
  const time = (index.times || []).find((candidate) =>
    index.availability?.[preferredLevel.id]?.[String(candidate.hf)])
  if (!time) return null
  return { tmfc: index.latestRun, hf: time.hf, level: preferredLevel.id }
}

function readSelectedKimNwpField(selection) {
  validateKimNwpSelection({ tmfc: selection.tmfc, hf: selection.hf, levelId: selection.level })
  const grid = readKimNwpGrid({
    root: DATA_ROOT,
    model: 'KIMG/NE57',
    tmfc: selection.tmfc,
    hf: Number(selection.hf),
    levelId: selection.level,
  })
  return buildKimSurfaceWindFieldFromWindGrid(grid)
}

function readSelectedKimTempField(selection) {
  validateKimNwpSelection({ tmfc: selection.tmfc, hf: selection.hf, levelId: selection.level })
  const grid = readKimNwpGrid({
    root: DATA_ROOT,
    model: 'KIMG/NE57',
    tmfc: selection.tmfc,
    hf: Number(selection.hf),
    levelId: selection.level,
  })
  return buildKimTemperatureFieldFromGrid(grid)
}

function readSelectedKimCloudField(selection) {
  validateKimNwpSelection({ tmfc: selection.tmfc, hf: selection.hf, levelId: selection.level })
  const grid = readKimNwpGrid({
    root: DATA_ROOT,
    model: 'KIMG/NE57',
    tmfc: selection.tmfc,
    hf: Number(selection.hf),
    levelId: selection.level,
  })
  return buildKimCloudPotentialFieldFromGrid(grid)
}

function sendKimWindField(req, res, { allowDefault = false } = {}) {
  try {
    let selection = {
      tmfc: String(req.query.tmfc || ''),
      hf: Number(req.query.hf),
      level: String(req.query.level || ''),
    }

    if (allowDefault && (!selection.tmfc || !selection.level || !Number.isFinite(selection.hf))) {
      const index = readKimNwpIndex(DATA_ROOT)
      selection = index ? selectDefaultKimNwpField(filterKimNwpIndexForMap(index)) : null
    }

    if (!selection) {
      res.status(503).json({ error: 'kim wind field unavailable' })
      return
    }

    res.json(readSelectedKimNwpField(selection))
  } catch (error) {
    res.status(400).json({ error: error.message || 'invalid kim wind selection' })
  }
}

app.get('/api/metar', (_, res) => sendLatest(res, 'metar'))
app.get('/api/taf', (_, res) => sendLatest(res, 'taf'))
app.get('/api/warning', (_, res) => sendLatest(res, 'warning'))
app.get('/api/sigmet', (_, res) => sendLatest(res, 'sigmet'))
app.get('/api/airmet', (_, res) => sendLatest(res, 'airmet'))
app.get('/api/sigwx-low', (_, res) => sendLatest(res, 'sigwx_low'))
app.get('/api/lightning', (_, res) => sendLatest(res, 'lightning'))
app.get('/api/amos', (_, res) => sendLatest(res, 'amos'))
app.get('/api/adsb', (_, res) => sendLatest(res, 'adsb'))
app.get('/api/kim/surface-wind', (req, res) => {
  const hasSelection = req.query.tmfc || req.query.hf || req.query.level
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    sendKimWindField(req, res, { allowDefault: !hasSelection })
    return
  }
  sendLatest(res, 'kim_surface_wind')
})
app.get('/api/kim/wind/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    res.json(filterKimNwpIndexForMapVariables(index, ['u', 'v']))
    return
  }
  res.status(503).json({ error: 'kim wind index unavailable' })
})
app.get('/api/kim/wind/field', (req, res) => sendKimWindField(req, res))
app.get('/api/kim/temp/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    res.json({
      ...filterKimNwpIndexForMapVariables(index, ['T']),
      type: 'kim_nwp_temp_index',
    })
    return
  }
  res.status(503).json({ error: 'kim temp index unavailable' })
})
app.get('/api/kim/temp/field', (req, res) => {
  try {
    const selection = {
      tmfc: String(req.query.tmfc || ''),
      hf: Number(req.query.hf),
      level: String(req.query.level || ''),
    }
    res.json(readSelectedKimTempField(selection))
  } catch (error) {
    res.status(400).json({ error: error.message || 'invalid kim temp selection' })
  }
})
app.get('/api/kim/cloud/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    res.json({
      ...filterKimCloudIndexForMap(index),
      type: 'kim_nwp_cloud_index',
    })
    return
  }
  res.status(503).json({ error: 'kim cloud index unavailable' })
})
app.get('/api/kim/cloud/field', (req, res) => {
  try {
    const selection = {
      tmfc: String(req.query.tmfc || ''),
      hf: Number(req.query.hf),
      level: String(req.query.level || ''),
    }
    res.json(readSelectedKimCloudField(selection))
  } catch (error) {
    res.status(400).json({ error: error.message || 'invalid kim cloud selection' })
  }
})
app.get('/api/ground-forecast', (_, res) => sendLatest(res, 'ground_forecast'))
app.get('/api/ground-overview', (_, res) => sendLatest(res, 'ground_overview'))
app.get('/api/environment', (_, res) => sendLatest(res, 'environment'))
app.get('/api/airport-info', (_, res) => sendLatest(res, 'airport_info'))
app.get('/api/snapshot-meta', (_req, res) => res.json(buildSnapshotMeta()))
app.get('/api/sigwx-low-history', (_req, res) => {
  try {
    res.json(readRecent('sigwx_low', 10))
  } catch {
    res.status(503).json({ error: 'sigwx history unavailable' })
  }
})

app.get('/api/radar/echo-meta', (_req, res) =>
  sendJsonFile(res, path.join(DATA_ROOT, 'radar', 'echo_meta.json')),
)
app.get('/api/satellite/meta', (_req, res) =>
  sendJsonFile(res, path.join(DATA_ROOT, 'satellite', 'sat_meta.json')),
)

app.get('/api/airports', (_req, res) => res.json(config.airports))
app.get('/api/warning-types', (_req, res) => res.json(warningTypes))
app.get('/api/alert-defaults', (_req, res) => res.json(alertDefaults))

app.get('/api/sigwx-front-meta', (req, res) => sendSigwxOverlayMeta(req, res, 'fronts'))
app.get('/api/sigwx-cloud-meta', (req, res) => sendSigwxOverlayMeta(req, res, 'clouds'))
app.get('/api/sigwx-low-fronts', (req, res) => sendSigwxOverlayMeta(req, res, 'fronts'))
app.get('/api/sigwx-low-clouds', (req, res) => sendSigwxOverlayMeta(req, res, 'clouds'))

app.get('/api/stats', (_req, res) => res.json(stats.getStats()))
app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }))
app.post('/api/vertical-profile', (req, res) => {
  try {
    res.json(buildVerticalProfile(req.body, terrainSampler))
  } catch (error) {
    if (error.code === 'TERRAIN_NOT_READY') {
      res.status(503).json({ error: error.message })
      return
    }

    res.status(400).json({ error: error.message || 'failed to build vertical profile' })
  }
})

export { app, buildSnapshotMeta, readSelectedKimCloudField }

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => console.log(`[server] Backend running on ${HOST}:${PORT}`))

  startScheduler().catch((err) => {
    console.error('[server] Scheduler startup error:', err.message)
    process.exit(1)
  })
}
