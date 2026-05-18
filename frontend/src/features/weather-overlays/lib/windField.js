export const WIND_SPEED_COLOR_RAMP = [
  { min: 0, max: 2, label: '0-2 m/s', color: 'rgba(100, 116, 139, 0.35)' },
  { min: 2, max: 5, label: '2-5 m/s', color: 'rgba(37, 99, 235, 0.35)' },
  { min: 5, max: 8, label: '5-8 m/s', color: 'rgba(20, 184, 166, 0.35)' },
  { min: 8, max: 12, label: '8-12 m/s', color: 'rgba(190, 242, 100, 0.35)' },
  { min: 12, max: 16, label: '12-16 m/s', color: 'rgba(249, 115, 22, 0.35)' },
  { min: 16, max: 22, label: '16-22 m/s', color: 'rgba(239, 68, 68, 0.35)' },
  { min: 22, max: Infinity, label: '22+ m/s', color: 'rgba(244, 114, 182, 0.38)' },
]

export function decodeWindComponent(value, field) {
  if (!Number.isFinite(value)) return null
  if (field?.encoding === 'int16-scaled-json-v1') {
    return value * (field.scale ?? 1) + (field.offset ?? 0)
  }
  return value
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function componentAt(values, field, index) {
  return decodeWindComponent(values[index], field)
}

function gridStep(min, max, count, fallback) {
  if (Number.isFinite(min) && Number.isFinite(max) && count > 1) {
    return (max - min) / (count - 1)
  }
  return fallback
}

export function createWindFieldSampler(field) {
  const grid = field?.grid
  if (!field || !grid || !Array.isArray(field.u) || !Array.isArray(field.v)) {
    return { sample: () => null }
  }
  const dx = gridStep(grid.lonMin, grid.lonMax, grid.nx, grid.dx)
  const dy = gridStep(grid.latMin, grid.latMax, grid.ny, grid.dy)

  function sample(lon, lat) {
    const x = (lon - grid.lonMin) / dx
    const y = (lat - grid.latMin) / dy
    if (x < 0 || y < 0 || x > grid.nx - 1 || y > grid.ny - 1) return null

    const i0 = Math.min(Math.floor(x), grid.nx - 2)
    const j0 = Math.min(Math.floor(y), grid.ny - 2)
    const tx = x - i0
    const ty = y - j0
    const i1 = i0 + 1
    const j1 = j0 + 1

    const idx00 = j0 * grid.nx + i0
    const idx10 = j0 * grid.nx + i1
    const idx01 = j1 * grid.nx + i0
    const idx11 = j1 * grid.nx + i1

    const u00 = componentAt(field.u, field, idx00)
    const u10 = componentAt(field.u, field, idx10)
    const u01 = componentAt(field.u, field, idx01)
    const u11 = componentAt(field.u, field, idx11)
    const v00 = componentAt(field.v, field, idx00)
    const v10 = componentAt(field.v, field, idx10)
    const v01 = componentAt(field.v, field, idx01)
    const v11 = componentAt(field.v, field, idx11)
    if ([u00, u10, u01, u11, v00, v10, v01, v11].some((value) => value == null)) return null

    const u = mix(mix(u00, u10, tx), mix(u01, u11, tx), ty)
    const v = mix(mix(v00, v10, tx), mix(v01, v11, tx), ty)
    return { u, v, speed: Math.hypot(u, v) }
  }

  return { sample }
}

export function pickWindSpeedColor(speed) {
  return WIND_SPEED_COLOR_RAMP.find((entry) => speed >= entry.min && speed < entry.max) || WIND_SPEED_COLOR_RAMP[0]
}

export function getWindFieldMeanSpeed(field) {
  if (!field || !Array.isArray(field.u) || !Array.isArray(field.v)) return null
  const count = Math.min(field.u.length, field.v.length)
  let total = 0
  let samples = 0
  for (let index = 0; index < count; index += 1) {
    const u = decodeWindComponent(field.u[index], field)
    const v = decodeWindComponent(field.v[index], field)
    if (u == null || v == null) continue
    total += Math.hypot(u, v)
    samples += 1
  }
  return samples > 0 ? total / samples : null
}

export function formatKimWindMetaLabel(field) {
  const validTime = Date.parse(field?.time?.validTime)
  if (!Number.isFinite(validTime)) return 'KIM 8km · 10m'
  const kst = new Date(validTime + 9 * 60 * 60 * 1000)
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  const hour = String(kst.getUTCHours()).padStart(2, '0')
  const minute = String(kst.getUTCMinutes()).padStart(2, '0')
  return `KIM 8km · 10m · ${month}/${day} ${hour}:${minute} KST`
}

export default {
  WIND_SPEED_COLOR_RAMP,
  createWindFieldSampler,
  decodeWindComponent,
  formatKimWindMetaLabel,
  getWindFieldMeanSpeed,
  pickWindSpeedColor,
}
