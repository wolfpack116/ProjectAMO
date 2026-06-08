export const SFC_W = 2049
export const SFC_H = 2049

const LAT_MAX = 40.35
const LAT_MIN = 30.74
const LON_MIN = 120.67
const LON_MAX = 133.07

/**
 * Parse nph-sfc_obs_nc_api ASCII response (obs=vs, disp=A).
 * Returns Float32Array(SFC_W * SFC_H), values in metres.
 * Fill (-999) → -1. Raw unit is 10m → ÷10.
 */
export function parseSfcAscii(text) {
  const eqIdx = text.indexOf('=')
  const dataStart = eqIdx >= 0 ? eqIdx + 1 : 0
  const result = new Float32Array(SFC_W * SFC_H)
  let idx = 0
  let numStart = -1

  for (let i = dataStart; i <= text.length && idx < result.length; i++) {
    const ch = text[i]
    const isDigit = ch >= '0' && ch <= '9'
    const isDot = ch === '.'
    const isMinus = ch === '-'
    const isNumChar = isDigit || isDot || isMinus

    if (isNumChar && numStart === -1) {
      numStart = i
    } else if (!isNumChar && numStart !== -1) {
      const v = parseFloat(text.slice(numStart, i))
      result[idx++] = v <= -999 ? -1 : v / 10
      numStart = -1
    }
  }
  if (numStart !== -1 && idx < result.length) {
    const v = parseFloat(text.slice(numStart))
    result[idx] = v <= -999 ? -1 : v / 10
  }

  return result
}

/**
 * Map sfc grid pixel (col, row) to {lat, lon}.
 * Row 0 = LAT_MAX (북단), Row H-1 = LAT_MIN (남단).
 * Col 0 = LON_MIN (서단), Col W-1 = LON_MAX (동단).
 */
export function sfcPixelToLatLon(col, row) {
  return {
    lat: LAT_MAX - (row / (SFC_H - 1)) * (LAT_MAX - LAT_MIN),
    lon: LON_MIN + (col / (SFC_W - 1)) * (LON_MAX - LON_MIN),
  }
}
