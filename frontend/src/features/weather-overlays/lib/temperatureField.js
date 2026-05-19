export const CELSIUS_TEMPERATURE_COLOR_RAMP = [
  { min: -Infinity, max: -20, label: '<= -20 C', color: 'rgba(120, 101, 207, 0.7)' },
  { min: -20, max: -10, label: '-20 to -10 C', color: 'rgba(112, 143, 214, 0.7)' },
  { min: -10, max: 0, label: '-10 to 0 C', color: 'rgba(41, 169, 183, 0.7)' },
  { min: 0, max: 10, label: '0 to 10 C', color: 'rgba(38, 139, 45, 0.7)' },
  { min: 10, max: 20, label: '10 to 20 C', color: 'rgba(165, 184, 0, 0.7)' },
  { min: 20, max: 30, label: '20 to 30 C', color: 'rgba(239, 151, 0, 0.72)' },
  { min: 30, max: 40, label: '30 to 40 C', color: 'rgba(209, 58, 14, 0.74)' },
  { min: 40, max: Infinity, label: '>= 40 C', color: 'rgba(107, 55, 28, 0.74)' },
]

function parseRgba(color) {
  const match = String(color).match(/rgba\(([^)]+)\)/)
  if (!match) return [0, 0, 0, 0]
  const [r, g, b, a] = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
  return [r, g, b, a ?? 1]
}

function formatRgba([r, g, b, a]) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 100) / 100})`
}

function lerp(start, end, amount) {
  return start + (end - start) * amount
}

function interpolateRgba(startColor, endColor, amount) {
  const start = parseRgba(startColor)
  const end = parseRgba(endColor)
  return formatRgba(start.map((value, index) => lerp(value, end[index], amount)))
}

function steppedInterpolationAmount(amount) {
  return Math.max(0, Math.min(1, Math.round(amount * 2) / 2))
}

export function kelvinToCelsius(value) {
  return Math.round((value - 273.15) * 100) / 100
}

export function decodeTemperatureValue(value, field) {
  if (!Number.isFinite(value) || value === -32768) return null
  if (field?.encoding === 'int16-scaled-json-v1') {
    return Math.round((value * (field.scale ?? 1) + (field.offset ?? 0)) * 100) / 100
  }
  return value
}

export function pickTemperatureColor(celsius) {
  const ramp = CELSIUS_TEMPERATURE_COLOR_RAMP
  const entryIndex = ramp.findIndex((entry) => celsius >= entry.min && celsius < entry.max)
  const entry = ramp[entryIndex] || ramp[0]
  if (!Number.isFinite(entry.min) || !Number.isFinite(entry.max)) return entry
  const next = ramp[entryIndex + 1]
  const amount = steppedInterpolationAmount((celsius - entry.min) / (entry.max - entry.min))
  return {
    ...entry,
    color: next ? interpolateRgba(entry.color, next.color, amount) : entry.color,
  }
}

function gridStep(min, max, count, fallback) {
  if (Number.isFinite(min) && Number.isFinite(max) && count > 1) return (max - min) / (count - 1)
  return fallback
}

export function createTemperatureFieldSampler(field) {
  const grid = field?.grid
  if (!field || !grid || !Array.isArray(field.T)) return { sample: () => null }
  const dx = gridStep(grid.lonMin, grid.lonMax, grid.nx, grid.dx)
  const dy = gridStep(grid.latMin, grid.latMax, grid.ny, grid.dy)

  function sample(lon, lat) {
    const x = Math.round((lon - grid.lonMin) / dx)
    const y = Math.round((lat - grid.latMin) / dy)
    if (x < 0 || y < 0 || x >= grid.nx || y >= grid.ny) return null
    const value = decodeTemperatureValue(field.T[y * grid.nx + x], field)
    return value == null ? null : kelvinToCelsius(value)
  }

  return { sample }
}
