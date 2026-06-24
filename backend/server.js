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
import adsbProcessor from './src/processors/adsb-processor.js'
import warningTypes from '../shared/warning-types.js'
import alertDefaults from '../shared/alert-defaults.js'
import { buildVerticalProfile } from './src/briefing/vertical-profile.js'
import { buildCrossSection } from './src/briefing/cross-section-sampler.js'
import { buildRouteAxis } from './src/briefing/route-axis.js'
import { selectNearestForecastHour } from './src/processors/kim-forecast-hour.js'
import { createDefaultTerrainSampler } from './src/terrain/terrain-sampler.js'
import {
  buildKimCloudPotentialFieldFromGrid,
  buildKimIcingFieldFromGrid,
  KIM_NWP_ICING_LEVEL_IDS,
  KIM_NWP_MOISTURE_LEVEL_IDS,
  KIM_NWP_LEVELS,
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
import { readKtgLatest, readKtgIndex, readKtgCoords, readKtgGridSafe } from './src/processors/ktg-store.js'
import { buildKtgCrossSection } from './src/briefing/cross-section-sampler.js'

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

function isRevalidatedApiRequest(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  return (
    /^\/(?:airports|warning-types|alert-defaults)$/i.test(req.path)
    || /^\/(?:metar|taf|warning|sigmet|airmet|sigwx-low|lightning|amos|adsb|ground-forecast|ground-overview|environment|airport-info)$/i.test(req.path)
    || /^\/sigwx-low-history$/i.test(req.path)
    || /^\/radar\/echo-meta$/i.test(req.path)
    || /^\/satellite\/meta$/i.test(req.path)
    || /^\/sigwx-(?:front|cloud)-meta$/i.test(req.path)
    || /^\/sigwx-low-(?:fronts|clouds)$/i.test(req.path)
    || /^\/kim\/(?:wind|temp|cloud|icing)\/index$/i.test(req.path)
  )
}

app.use('/api', (req, res, next) => {
  if (!isImmutableKimFieldRequest(req) && !isRevalidatedApiRequest(req)) {
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

function requestHasMatchingEtag(req, etag) {
  const value = req?.headers?.['if-none-match']
  if (!value) return false
  return value.split(',').map((candidate) => candidate.trim()).includes(etag)
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store')
}

function sendRevalidatedJson(res, payload, etagSeed, { staticConfig = false } = {}) {
  const etag = `"${crypto.createHash('sha256').update(String(etagSeed)).digest('hex')}"`
  res.setHeader('Cache-Control', staticConfig ? 'no-cache' : 'no-cache, must-revalidate')
  res.setHeader('ETag', etag)
  res.setHeader('Vary', 'Accept-Encoding')
  if (requestHasMatchingEtag(res.req, etag)) {
    res.status(304).end()
    return
  }
  res.json(payload)
}

function sendLatest(res, type) {
  const data = readLatest(type)
  if (data) return sendRevalidatedJson(res, data, data.content_hash || store.canonicalHash(data))
  setNoStore(res)
  res.status(503).json({ error: `${type} data unavailable` })
}

function sendJsonFile(res, filePath) {
  const payload = readJsonFileSafe(filePath)
  if (payload) return sendRevalidatedJson(res, payload, store.canonicalHash(payload))
  setNoStore(res)
  res.status(503).json({ error: 'data unavailable' })
}

function sendImmutableJson(res, payload, etagSeed) {
  const etag = `"${crypto.createHash('sha256').update(etagSeed).digest('hex')}"`
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
  res.setHeader('ETag', etag)
  res.setHeader('Vary', 'Accept-Encoding')
  if (requestHasMatchingEtag(res.req, etag)) {
    res.status(304).end()
    return
  }
  res.json(payload)
}

function sendStaticConfigJson(res, payload, name) {
  sendRevalidatedJson(res, payload, `${name}:${store.canonicalHash(payload)}`, { staticConfig: true })
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
  const payload = readSigwxOverlayMeta(kind, tmfc)
  sendRevalidatedJson(res, payload, `${kind}:${tmfc}:${store.canonicalHash(payload)}`)
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
    path.join(DATA_ROOT, 'flight_category_overlay', 'latest.json'),
    path.join(DATA_ROOT, 'ktg', 'latest.json'),
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
    flightCategory: buildHashEntry('flight_category_overlay'),
    ktg: (() => {
      const ktgLatest = readKtgLatest(DATA_ROOT)
      return ktgLatest ? { hash: store.canonicalHash(ktgLatest), tmfc: ktgLatest.tmfc || null } : null
    })(),
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

function readSelectedKimField(selection, buildFn) {
  validateKimNwpSelection({ tmfc: selection.tmfc, hf: selection.hf, levelId: selection.level })
  const grid = readKimNwpGrid({
    root: DATA_ROOT,
    model: 'KIMG/NE57',
    tmfc: selection.tmfc,
    hf: Number(selection.hf),
    levelId: selection.level,
  })
  return buildFn(grid)
}

// Kept as named exports for backwards compatibility (used in cross-section route and tests).
function readSelectedKimCloudField(selection) {
  return readSelectedKimField(selection, buildKimCloudPotentialFieldFromGrid)
}
function readSelectedKimIcingField(selection) {
  return readSelectedKimField(selection, buildKimIcingFieldFromGrid)
}

function sendKimField(req, res, { type, buildFn, errorLabel }) {
  try {
    const selection = {
      tmfc: String(req.query.tmfc || ''),
      hf: Number(req.query.hf),
      level: String(req.query.level || ''),
    }
    // Early 304: (tmfc, hf, level) uniquely identifies an immutable KIM field — no need to read the grid.
    const etagSeed = `kim-${type}:${selection.tmfc}:${selection.hf}:${selection.level}`
    const etag = `"${crypto.createHash('sha256').update(etagSeed).digest('hex')}"`
    if (requestHasMatchingEtag(req, etag)) {
      res.status(304).end()
      return
    }
    const field = readSelectedKimField(selection, buildFn)
    sendImmutableJson(res, field, etagSeed)
  } catch (error) {
    res.status(400).json({ error: error.message || errorLabel })
  }
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

    const etagSeed = `kim-wind:${selection.tmfc}:${selection.hf}:${selection.level}`
    const etag = `"${crypto.createHash('sha256').update(etagSeed).digest('hex')}"`
    if (requestHasMatchingEtag(req, etag)) {
      res.status(304).end()
      return
    }
    const field = readSelectedKimField(selection, buildKimSurfaceWindFieldFromWindGrid)
    sendImmutableJson(res, field, etagSeed)
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
// ADS-B is collected on demand: only refresh adsb.lol when a viewer requests it and
// the snapshot is stale. No viewers -> no upstream calls. Cold start waits for the fetch.
const ADSB_REFRESH_MS = 5 * 60 * 1000
const ADSB_COLD_MS = 30 * 60 * 1000
let adsbRefreshing = null
function adsbFileAgeMs() {
  try {
    return Date.now() - fs.statSync(path.join(DATA_ROOT, 'adsb', 'latest.json')).mtimeMs
  } catch {
    return Infinity
  }
}
function triggerAdsbRefresh() {
  if (!adsbRefreshing) {
    adsbRefreshing = Promise.resolve()
      .then(() => adsbProcessor.process())
      .catch((err) => console.error('[adsb] on-demand refresh failed:', err.message))
      .finally(() => { adsbRefreshing = null })
  }
  return adsbRefreshing
}
app.get('/api/adsb', async (_req, res) => {
  const age = adsbFileAgeMs()
  if (age >= ADSB_REFRESH_MS) {
    const pending = triggerAdsbRefresh()
    if (age >= ADSB_COLD_MS) {
      await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, 8000))])
    }
  }
  sendLatest(res, 'adsb')
})

// Flight route lookup (origin/destination) via adsbdb.com, proxied + cached so a
// single hover is shared across users. Routes are stable, so cache long; back off on 429.
const adsbRouteCache = new Map()
const ADSB_ROUTE_TTL_MS = 6 * 60 * 60 * 1000
let adsbdbBackoffUntil = 0
app.get('/api/adsb/route/:callsign', async (req, res) => {
  const callsign = String(req.params.callsign || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  if (!callsign) { res.json({ route: null }); return }

  const now = Date.now()
  const cached = adsbRouteCache.get(callsign)
  if (cached && cached.expires > now) { res.json({ route: cached.route }); return }
  if (now < adsbdbBackoffUntil) { res.json({ route: null }); return }

  try {
    const response = await fetch(`https://api.adsbdb.com/v0/callsign/${callsign}`, {
      headers: { 'User-Agent': 'ProjectAMO/1.0 (+https://www.projectamo.co.kr)' },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 429) { adsbdbBackoffUntil = now + 60_000; res.json({ route: null }); return }
    if (!response.ok) {
      adsbRouteCache.set(callsign, { route: null, expires: now + ADSB_ROUTE_TTL_MS })
      res.json({ route: null }); return
    }
    const data = await response.json()
    const fr = data?.response?.flightroute
    let route = null
    if (fr?.origin?.icao_code && fr?.destination?.icao_code) {
      route = {
        origin: { icao: fr.origin.icao_code, city: fr.origin.municipality || null },
        destination: { icao: fr.destination.icao_code, city: fr.destination.municipality || null },
      }
    }
    adsbRouteCache.set(callsign, { route, expires: now + ADSB_ROUTE_TTL_MS })
    res.json({ route })
  } catch {
    res.json({ route: null })
  }
})
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
    const payload = filterKimNwpIndexForMapVariables(index, ['u', 'v'])
    sendRevalidatedJson(res, payload, store.canonicalHash(payload))
    return
  }
  setNoStore(res)
  res.status(503).json({ error: 'kim wind index unavailable' })
})
app.get('/api/kim/wind/field', (req, res) => sendKimWindField(req, res))
app.get('/api/kim/temp/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    const payload = {
      ...filterKimNwpIndexForMapVariables(index, ['T']),
      type: 'kim_nwp_temp_index',
    }
    sendRevalidatedJson(res, payload, store.canonicalHash(payload))
    return
  }
  setNoStore(res)
  res.status(503).json({ error: 'kim temp index unavailable' })
})
app.get('/api/kim/temp/field', (req, res) =>
  sendKimField(req, res, { type: 'temp', buildFn: buildKimTemperatureFieldFromGrid, errorLabel: 'invalid kim temp selection' })
)
app.get('/api/kim/cloud/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    const payload = {
      ...filterKimCloudIndexForMap(index),
      type: 'kim_nwp_cloud_index',
    }
    sendRevalidatedJson(res, payload, store.canonicalHash(payload))
    return
  }
  setNoStore(res)
  res.status(503).json({ error: 'kim cloud index unavailable' })
})
app.get('/api/kim/cloud/field', (req, res) =>
  sendKimField(req, res, { type: 'cloud', buildFn: buildKimCloudPotentialFieldFromGrid, errorLabel: 'invalid kim cloud selection' })
)
app.get('/api/kim/icing/index', (_req, res) => {
  const index = readKimNwpIndex(DATA_ROOT)
  if (index) {
    const payload = {
      ...filterKimIcingIndexForMap(index),
      type: 'kim_nwp_icing_index',
    }
    sendRevalidatedJson(res, payload, store.canonicalHash(payload))
    return
  }
  setNoStore(res)
  res.status(503).json({ error: 'kim icing index unavailable' })
})
app.get('/api/kim/icing/field', (req, res) =>
  sendKimField(req, res, { type: 'icing', buildFn: buildKimIcingFieldFromGrid, errorLabel: 'invalid kim icing selection' })
)
app.get('/api/ktg/index', (_req, res) => {
  const latest = readKtgLatest(DATA_ROOT)
  const index = latest ? readKtgIndex(DATA_ROOT) : null
  if (latest && index) {
    setNoStore(res)
    res.json({ tmfc: latest.tmfc, hf: latest.hf, validTime: latest.validTime, altLevelsFt: index.altLevelsFt ?? [] })
    return
  }
  setNoStore(res)
  res.status(503).json({ error: 'ktg index unavailable' })
})

app.get('/api/ktg/grid', (req, res) => {
  const altFt = Number(req.query.altFt) || 3000
  const latest = readKtgLatest(DATA_ROOT)
  if (!latest) {
    setNoStore(res)
    res.status(503).json({ error: 'ktg data unavailable' })
    return
  }
  const coords = readKtgCoords({ root: DATA_ROOT, tmfc: latest.tmfc, hf: latest.hf })
  const gridData = readKtgGridSafe({ root: DATA_ROOT, tmfc: latest.tmfc, hf: latest.hf, altFt })
  if (!coords || !gridData) {
    setNoStore(res)
    res.status(503).json({ error: `ktg grid unavailable for ${altFt}ft` })
    return
  }
  let latMin = Infinity; let latMax = -Infinity; let lonMin = Infinity; let lonMax = -Infinity
  for (const v of coords.lat) { if (v < latMin) latMin = v; if (v > latMax) latMax = v }
  for (const v of coords.lon) { if (v < lonMin) lonMin = v; if (v > lonMax) lonMax = v }
  setNoStore(res)
  res.json({
    altFt,
    grid: { ny: coords.ny, nx: coords.nx, latMin, latMax, lonMin, lonMax },
    ktg: gridData.ktg,
    run: { tmfc: latest.tmfc, hf: latest.hf, validTime: latest.validTime },
  })
})

app.get('/api/ground-forecast', (_, res) => sendLatest(res, 'ground_forecast'))
app.get('/api/ground-overview', (_, res) => sendLatest(res, 'ground_overview'))
app.get('/api/environment', (_, res) => sendLatest(res, 'environment'))
app.get('/api/airport-info', (_, res) => sendLatest(res, 'airport_info'))

app.get('/api/weather/flight-category-overlay/point', (req, res) => {
  const lat = parseFloat(req.query.lat)
  const lon = parseFloat(req.query.lon)
  if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'invalid lat/lon' })

  const data = store.getCached('flight_category_overlay')
  if (!data?.query_grid) return res.status(503).json({ error: 'no data' })

  const { width, height, lat_max, lat_min, lon_min, lon_max, vis, ceil_ft } = data.query_grid

  const fc = (lon - lon_min) / (lon_max - lon_min) * (width - 1)
  const fr = (lat_max - lat) / (lat_max - lat_min) * (height - 1)
  if (fc < 0 || fc > width - 1 || fr < 0 || fr > height - 1) {
    return res.status(400).json({ error: 'out of domain' })
  }

  const c0 = Math.floor(fc), c1 = Math.min(c0 + 1, width - 1)
  const r0 = Math.floor(fr), r1 = Math.min(r0 + 1, height - 1)
  const dc = fc - c0, dr = fr - r0
  const bilerp = (arr) =>
    arr[r0 * width + c0] * (1 - dc) * (1 - dr) +
    arr[r0 * width + c1] * dc * (1 - dr) +
    arr[r1 * width + c0] * (1 - dc) * dr +
    arr[r1 * width + c1] * dc * dr

  const vis_m = bilerp(vis)
  const ceil = bilerp(ceil_ft)
  const ranks = ['VFR', 'IFR', 'LIFR']
  const vcat = vis_m < 0 ? 0 : vis_m < 800 ? 2 : vis_m < 5000 ? 1 : 0
  const ccat = ceil < 0 ? 0 : ceil >= 99000 ? 0 : ceil < 500 ? 2 : ceil < 1500 ? 1 : 0
  const category = ranks[Math.max(vcat, ccat)]

  res.json({
    lat, lon,
    vis_m: Math.round(vis_m),
    ceil_ft: ceil >= 99000 ? null : Math.round(ceil),
    category,
  })
})

app.get('/api/weather/flight-category-overlay', (req, res) => {
  const data = store.getCached('flight_category_overlay')
  if (!data?.geojson) {
    return res.json({ type: 'FeatureCollection', features: [] })
  }
  const etag = `"${data.content_hash || store.canonicalHash(data.geojson)}"`
  res.setHeader('Last-Modified', new Date(data.computed_at).toUTCString())
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', 'no-cache')
  if (req.headers['if-none-match'] === etag) return res.status(304).end()
  res.json({ ...data.geojson, fetched_at: data.amos_fetched_at ?? data.fetched_at })
})
app.get('/api/snapshot-meta', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.json(getCachedSnapshotMeta())
})
app.get('/api/sigwx-low-history', (_req, res) => {
  try {
    const payload = readRecent('sigwx_low', 10)
    sendRevalidatedJson(res, payload, store.canonicalHash(payload))
  } catch {
    setNoStore(res)
    res.status(503).json({ error: 'sigwx history unavailable' })
  }
})

app.get('/api/radar/echo-meta', (_req, res) =>
  sendJsonFile(res, path.join(DATA_ROOT, 'radar', 'echo_meta.json')),
)
app.get('/api/satellite/meta', (_req, res) =>
  sendJsonFile(res, path.join(DATA_ROOT, 'satellite', 'sat_meta.json')),
)

app.get('/api/airports', (_req, res) => sendStaticConfigJson(res, config.airports, 'airports'))
app.get('/api/warning-types', (_req, res) => sendStaticConfigJson(res, warningTypes, 'warning-types'))
app.get('/api/alert-defaults', (_req, res) => sendStaticConfigJson(res, alertDefaults, 'alert-defaults'))

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

function decodeVar(variable) {
  const { values = [], scale = 1, offset = 0, encoding } = variable || {}
  if (encoding === 'int16-scaled-json-v1') {
    return values.map((v) => (v === -32768 || !Number.isFinite(v) ? Number.NaN : v * scale + offset))
  }
  return values
}
function decodeArr(values, field) {
  return decodeVar({ values, scale: field.scale, offset: field.offset, encoding: field.encoding })
}

app.post('/api/briefing/cross-section', (req, res) => {
  try {
    const { routeGeometry, sampleSpacingMeters } = req.body || {}
    if (!routeGeometry?.coordinates?.length) {
      return res.status(400).json({ error: 'routeGeometry required' })
    }
    const latest = readKimNwpLatest(DATA_ROOT)
    if (!latest?.latestRun) return res.status(503).json({ error: 'kim run unavailable' })
    const index = readKimNwpIndex(DATA_ROOT)
    const tmfc = String(req.body.tmfc || latest.latestRun)
    // Only consider hours that actually have pressure-level wind data
    const pressureWindIndex = filterKimNwpIndexForVariables(index, ['u', 'v'])
    const availableHours = pressureWindIndex?.times?.filter((t) => {
      const pressureLevels = (pressureWindIndex?.levels ?? []).filter((l) => l.kind === 'pressure')
      return pressureLevels.some((l) => pressureWindIndex.availability?.[l.id]?.[String(t.hf)])
    }).map((t) => t.hf) ?? []
    const candidateHours = availableHours.length > 0 ? availableHours : (config.kim_nwp?.forecast_hours || [0, 3, 6, 9, 12])
    const hf = Number.isFinite(Number(req.body.hf))
      ? Number(req.body.hf)
      : selectNearestForecastHour({ tmfc, candidateHours })

    const axis = buildRouteAxis(routeGeometry, sampleSpacingMeters ?? 250)

    const loadLevel = (levelId) => {
      const level = KIM_NWP_LEVELS.find((l) => l.id === levelId)
      if (!level || level.kind !== 'pressure') return null
      let grid
      try {
        grid = readKimNwpGrid({ root: DATA_ROOT, model: 'KIMG/NE57', tmfc, hf, levelId })
      } catch { return null }
      if (!grid) return null
      const out = { pressure: level.value, grid: grid.grid }
      if (grid.variables?.hgt) out.hgt = decodeVar(grid.variables.hgt)
      if (grid.variables?.T) out.T = decodeVar(grid.variables.T)
      if (grid.variables?.u && grid.variables?.v) {
        out.u = decodeVar(grid.variables.u)
        out.v = decodeVar(grid.variables.v)
      }
      if (grid.variables?.T && grid.variables?.rh) {
        const f = buildKimCloudPotentialFieldFromGrid(grid)
        out.spread = decodeArr(f.spread, f)
      }
      const icingVars = ['T', 'rh_liq', 'w', 'tqc', 'tqi', 'tqr', 'tqs', 'cld']
      if (icingVars.every((n) => grid.variables?.[n])) {
        const f = buildKimIcingFieldFromGrid(grid)
        out.icingGrade = f.icingGrade.map((v) => (v === -32768 ? null : v))
      }
      return out
    }

    const result = buildCrossSection({
      axis,
      run: { tmfc, hf, validTime: latest.validTime ?? null },
      levelIds: KIM_NWP_LEVELS.filter((l) => l.kind === 'pressure').map((l) => l.id),
      loadLevel,
    })

    // KTG low-altitude turbulence
    const ktgLatest = readKtgLatest(DATA_ROOT)
    const ktgIndex = ktgLatest ? readKtgIndex(DATA_ROOT) : null
    const ktgCoords = ktgLatest ? readKtgCoords({ root: DATA_ROOT, tmfc: ktgLatest.tmfc, hf: ktgLatest.hf }) : null
    const turbulence = buildKtgCrossSection({
      axis,
      coords: ktgCoords,
      altLevelsFt: ktgIndex?.altLevelsFt ?? [],
      loadAltGrid: (altFt) => readKtgGridSafe({ root: DATA_ROOT, tmfc: ktgLatest?.tmfc, hf: ktgLatest?.hf, altFt }),
    })
    if (ktgLatest) turbulence.run = { tmfc: ktgLatest.tmfc, hf: ktgLatest.hf, validTime: ktgLatest.validTime }

    setNoStore(res)
    res.json({ ...result, turbulence })
  } catch (error) {
    res.status(400).json({ error: error.message || 'cross-section failed' })
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
