import { getFlightCategory } from '../../../shared/weather/helpers.js'
import { resolveWeatherVisual } from '../../../shared/weather/weather-visual-resolver.js'

export const AIRPORT_CATEGORY_COLORS = {
  VFR: '#15803d',
  IFR: '#f97316',
  LIFR: '#dc2626',
}

export const AIRPORT_CATEGORY_UNKNOWN_COLOR = '#64748b'

const SKY_COVER_PRIORITY = ['VV', 'OVC', 'BKN', 'SCT', 'FEW']
const SKY_COVER_BY_AMOUNT = {
  FEW: 'few',
  SCT: 'sct',
  BKN: 'bkn',
  OVC: 'ovc',
  VV: 'ovc',
}
const CEILING_AMOUNTS = new Set(['BKN', 'OVC', 'VV'])
const EXACT_MEANINGFUL_WEATHER_CODES = new Set([
  'RA', 'DZ', 'SN', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP',
  'FG', 'MIFG', 'BCFG', 'PRFG', 'BR', 'HZ', 'FU', 'VA', 'DU', 'SA',
  'PO', 'SQ', 'FC', 'SS', 'DS', 'BLSN', 'BLSA', 'BLDU', 'DRSN', 'DRSA', 'DRDU',
])
const PREFIX_MEANINGFUL_WEATHER_CODES = ['SH', 'TS', 'FZ']

function normalizeNumber(value) {
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeFlightCategoryKey(category) {
  return AIRPORT_CATEGORY_COLORS[category] ? category : 'UNKNOWN'
}

function getCategoryColor(category) {
  return AIRPORT_CATEGORY_COLORS[category] || AIRPORT_CATEGORY_UNKNOWN_COLOR
}

function getCategoryIconKey(category) {
  return normalizeFlightCategoryKey(category).toLowerCase()
}

function pickSkyCoverAmount(observation = {}, metar = {}) {
  const clouds = Array.isArray(observation.clouds) ? observation.clouds : []
  for (const amount of SKY_COVER_PRIORITY) {
    if (clouds.some((layer) => String(layer?.amount || '').toUpperCase() === amount)) {
      return amount
    }
  }

  const displayClouds = String(observation.display?.clouds || '').toUpperCase()
  for (const amount of SKY_COVER_PRIORITY) {
    if (displayClouds.includes(amount)) return amount
  }

  if (
    observation.visibility?.cavok
    || observation.cavok
    || metar?.cavok_flag
    || metar?.nsc_flag
    || ['NSC', 'NCD', 'SKC', 'CLR'].includes(displayClouds)
  ) {
    return null
  }

  return null
}

function getSkyCoverState(observation, metar) {
  const amount = pickSkyCoverAmount(observation, metar)
  return SKY_COVER_BY_AMOUNT[amount] || 'clear'
}

function getCeilingFeet(observation = {}) {
  const clouds = Array.isArray(observation.clouds) ? observation.clouds : []
  const ceilingBases = clouds
    .filter((layer) => CEILING_AMOUNTS.has(String(layer?.amount || '').toUpperCase()))
    .map((layer) => normalizeNumber(layer?.base))
    .filter(Number.isFinite)

  if (ceilingBases.length === 0) return null
  return Math.min(...ceilingBases)
}

function formatCeilingText(ceilingFeet) {
  if (!Number.isFinite(ceilingFeet)) return ''
  return String(Math.round(ceilingFeet / 100)).padStart(3, '0')
}

function getVisibilityMeters(observation = {}) {
  return normalizeNumber(observation.visibility?.value)
}

function formatVisibilityText(observation = {}, metar = {}) {
  if (observation.visibility?.cavok || observation.cavok || metar?.cavok_flag) {
    return 'CAVOK'
  }

  const visibilityMeters = getVisibilityMeters(observation)
  if (!Number.isFinite(visibilityMeters)) return ''
  if (visibilityMeters >= 9999) return '9999+'
  if (visibilityMeters >= 1000) return String(visibilityMeters)
  return String(visibilityMeters).padStart(4, '0')
}

function isMeaningfulWeatherCode(code) {
  const normalized = String(code || '').toUpperCase().trim()
  if (!normalized || normalized === 'NSW' || normalized === 'CAVOK' || normalized === 'UNKNOWN') return false
  if (EXACT_MEANINGFUL_WEATHER_CODES.has(normalized)) return true
  return PREFIX_MEANINGFUL_WEATHER_CODES.some((prefix) => normalized.startsWith(prefix))
}

function getWeatherIconId(metar = {}) {
  const observation = metar?.observation
  if (!observation) return ''

  const time = metar?.header?.observation_time || metar?.header?.issue_time
  const visual = resolveWeatherVisual(observation, time)
  if (visual?.source !== 'weather' || !isMeaningfulWeatherCode(visual?.code)) return ''
  return `airport-wx-${visual.iconId}`
}

function getWindModel(observation = {}) {
  const wind = observation.wind
  if (!wind || wind.calm) return { windDirection: null, windIconId: '' }

  const speedKt = normalizeNumber(wind.speed)
  const direction = normalizeNumber(wind.direction)
  if (!Number.isFinite(speedKt) || speedKt <= 0 || !Number.isFinite(direction)) {
    return { windDirection: null, windIconId: '' }
  }

  const bucket = Math.min(60, Math.max(5, Math.round(speedKt / 5) * 5))

  return {
    windDirection: direction,
    windIconId: `airport-wind-${String(bucket).padStart(3, '0')}`,
  }
}

function getFlightCategoryModel({ icao, visibilityMeters, ceilingFeet }) {
  if (!Number.isFinite(visibilityMeters) && !Number.isFinite(ceilingFeet)) {
    return { flightCategory: 'UNKNOWN', categoryColor: AIRPORT_CATEGORY_UNKNOWN_COLOR }
  }

  const flightCategory = getFlightCategory(visibilityMeters, ceilingFeet, icao)?.category || 'UNKNOWN'
  return {
    flightCategory,
    categoryColor: getCategoryColor(flightCategory),
  }
}

export function buildAirportStationMarkerModel({ airport, metar }) {
  const observation = metar?.observation || {}
  const visibilityMeters = getVisibilityMeters(observation)
  const ceilingFeet = getCeilingFeet(observation)
  const skyCover = getSkyCoverState(observation, metar)
  const { flightCategory, categoryColor } = getFlightCategoryModel({
    icao: airport?.icao,
    visibilityMeters,
    ceilingFeet,
  })
  const { windDirection, windIconId } = getWindModel(observation)

  return {
    flightCategory,
    categoryColor,
    skyCover,
    stationIconId: `airport-station-${getCategoryIconKey(flightCategory)}-${skyCover}`,
    visibilityText: formatVisibilityText(observation, metar),
    ceilingText: formatCeilingText(ceilingFeet),
    weatherIconId: getWeatherIconId(metar),
    windIconId,
    windDirection,
  }
}
