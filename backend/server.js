import express from 'express'
import compression from 'compression'
import crypto from 'node:crypto'
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
  buildKimIcingFieldFromGrid,
  KIM_NWP_ICING_LEVEL_IDS,
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
const KIM_ICING_REQUIRED_VARIABLES = ['T', 'rh_liq', 'w', 'tqc', 'tqi', 'tqr', 'tqs', 'cld']
const SNAPSHOT_META_CACHE_TTL_MS = 5000
const snapshotMetaCache = { key: null, value: null, expiresAt: 0 }

app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(express.json({ limit: '1mb' }))
app.use(compression())

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
function isImmutableKimFieldRequest(req) {
  return /^\/kim\/(?:wind|temp|cloud|icing)\/field$/i.test(req.path)
}

app.use('/api', (req, res, next) => {
  if (!isImmutableKimFieldRequest(req)) {
    res.setHeader('Cache-Control', 'no-store')
  }
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

function sendImmutableJson(res, payload, etagSeed) {
  const etag = `"${crypto.createHash('sha256').update(etagSeed).digest('hex')}"`
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
  res.setHeader('ETag', etag)
  res.setHeader('Vary', 'Accept-Encoding')
  if (res.req?.headers?.['if-none-match'] === etag) {
    res.status(304).end()
    return
  }
  res.json(payload)
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
  const icingIndex = index
    ? filterKimNwpIndexForLevels(filterKimNwpIndexForVariables(index, KIM_ICING_REQUIRED_VARIABLES), KIM_NWP_ICING_LEVEL_IDS)
    : null
  return {
    hash: latest.content_hash || store.canonicalHash(latest),
    tmfc: latest.latestRun || null,
    updated_at: latest.updated_at || null,
    variables: {
      uv: { hash: uvIndex ? store.canonicalHash(uvIndex) : null },
      T: { hash: tempIndex ? store.canonicalHash(tempIndex) : null },
      cloud: { hash: cloudIndex ? store.canonicalHash(cloudIndex) : null },
      icing: { hash: icingIndex ? store.canonicalHash(icingIndex) : null },
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

function fileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs
  } catch {
    return 0
  }
}

function buildSnapshotMetaCacheKey() {
  const files = [
    path.join(DATA_ROOT, 'kim_nwp', 'index.json'),
    path.join(DATA_ROOT, 'kim_nwp', 'latest.json'),
    path.join(DATA_ROOT, 'kim_surface_wind', 'latest.json'),
    path.join(DATA_ROOT, 'metar', 'latest.json'),
    path.join(DATA_ROOT, 'taf', 'latest.json'),
    path.join(DATA_ROOT, 'warning', 'latest.json'),
    path.join(DATA_ROOT, 'sigmet', 'latest.json'),
    path.join(DATA_ROOT, 'airmet', 'latest.json'),
    path.join(DATA_ROOT, 'sigwx_low', 'latest.json'),
    path.join(DATA_ROOT, 'amos', 'latest.json'),
    path.join(DATA_ROOT, 'lightning', 'latest.json'),
    path.join(DATA_ROOT, 'adsb', 'latest.json'),
    path.join(DATA_ROOT, 'ground_forecast', 'latest.json'),
    path.join(DATA_ROOT, 'ground_overview', 'latest.json'),
    path.join(DATA_ROOT, 'environment', 'latest.json'),
    path.join(DATA_ROOT, 'airport_info', 'latest.json'),
    path.join(DATA_ROOT, 'radar', 'echo_meta.json'),
    path.join(DATA_ROOT, 'satellite', 'sat_meta.json'),
  ]
  return files.map((filePath) => `${filePath}:${fileMtimeMs(filePath)}`).join('|')
}

function getCachedSnapshotMeta(nowMs = Date.now()) {
  const key = buildSnapshotMetaCacheKey()
  if (snapshotMetaCache.value && snapshotMetaCache.key === key && snapshotMetaCache.expiresAt > nowMs) {
    return snapshotMetaCache.value
  }
  const value = buildSnapshotMeta()
  snapshotMetaCache.key = key
  snapshotMetaCache.value = value
  snapshotMetaCache.expiresAt = nowMs + SNAPSHOT_META_CACHE_TTL_MS
  return value
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

export function filterKimIcingIndexForMap(index, nowMs = Date.now()) {
  return filterKimNwpIndexForMap(
    filterKimNwpIndexForLevels(filterKimNwpIndexForVariables(index, KIM_ICING_REQUIRED_VARIABLES), KIM_NWP_ICING_LEVEL_IDS),
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

function readSelectedKimIcingField(selection) {
  validateKimNwpSelection({ tmfc: selection.tmfc, hf: selection.hf, levelId: selection.level })
  const grid = readKimNwpGrid({
    root: DATA_ROOT,
    model: 'KIMG/NE57',
    tmfc: selection.tmfc,
    hf: Number(selection.hf),
    levelId: selection.level,
  })
  return buildKimIcingFieldFromGrid(grid)
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

    const field = readSelectedKimNwpField(selection)
    sendImmutableJson(res, field, `kim-wind:${selection.tmfc}:${selection.hf}:${selection.level}:${field?.fetched_at || ''}`)
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
    const field = readSelectedKimTempField(selection)
    sendImmutableJson(res, field, `kim-temp:${selection.tmfc}:${selection.hf}:${selection.level}:${field?.fetched_at || ''}`)
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
    const field = readSelectedKimCloudField(selection)
    sendImmutableJson(res, field, `kim-cloud:${selection.tmfc}:${selection.hf}:${selection.level}:${field?.fetched_at || ''}`)
  } catch (error) {
    res.status(400).json({ error: error.message || 'invalid kim cloud selection' })
  }
})
app.get('/api/kim/icing/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    res.json({
      ...filterKimIcingIndexForMap(index),
      type: 'kim_nwp_icing_index',
    })
    return
  }
  res.status(503).json({ error: 'kim icing index unavailable' })
})
app.get('/api/kim/icing/field', (req, res) => {
  try {
    const selection = {
      tmfc: String(req.query.tmfc || ''),
      hf: Number(req.query.hf),
      level: String(req.query.level || ''),
    }
    const field = readSelectedKimIcingField(selection)
    sendImmutableJson(res, field, `kim-icing:${selection.tmfc}:${selection.hf}:${selection.level}:${field?.fetched_at || ''}`)
  } catch (error) {
    res.status(400).json({ error: error.message || 'invalid kim icing selection' })
  }
})
app.get('/api/ground-forecast', (_, res) => sendLatest(res, 'ground_forecast'))
app.get('/api/ground-overview', (_, res) => sendLatest(res, 'ground_overview'))
app.get('/api/environment', (_, res) => sendLatest(res, 'environment'))
app.get('/api/airport-info', (_, res) => sendLatest(res, 'airport_info'))
app.get('/api/snapshot-meta', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.json(getCachedSnapshotMeta())
})
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

export { app, buildSnapshotMeta, getCachedSnapshotMeta, readSelectedKimCloudField, readSelectedKimIcingField }

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => console.log(`[server] Backend running on ${HOST}:${PORT}`))

  startScheduler().catch((err) => {
    console.error('[server] Scheduler startup error:', err.message)
    process.exit(1)
  })
}
