const NUMBER_PATTERN = /^[\s+\-0-9.eE]+$/

function parseNumericRow(line) {
  const trimmed = line.trim()
  if (!trimmed || !NUMBER_PATTERN.test(trimmed)) return null
  const values = trimmed.split(/\s+/).map((value) => Number(value))
  return values.every(Number.isFinite) ? values : null
}

function parseHeaderValue(text, names) {
  for (const name of names) {
    const match = text.match(new RegExp(`${name}\\s*[:=]\\s*([^\\s#]+)`, 'i'))
    if (match) return match[1].trim()
  }
  return null
}

function parseHeaderDimensions(text) {
  const match = text.match(/\bi\s*=\s*(\d+)\s*,\s*j\s*=\s*(\d+)/i)
  if (!match) return null
  return { nx: Number(match[1]), ny: Number(match[2]) }
}

export function parseKimGridText(text, { variable, level = 0, bounds = {} } = {}) {
  const payload = String(text || '').replace(/^\uFEFF/, '')
  if (/Variable not found/i.test(payload)) {
    throw new Error(`Variable not found: ${variable || 'unknown'}`)
  }
  if (/file\s+is\s+not\s+exist/i.test(payload)) {
    const error = new Error('KIM grid file is not available')
    error.code = 'KIM_FILE_NOT_AVAILABLE'
    throw error
  }

  const rows = []
  const values = []
  for (const line of payload.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const row = parseNumericRow(line)
    if (row) {
      rows.push(row)
      values.push(...row)
    }
  }

  if (values.length === 0) {
    throw new Error(`KIM grid has no numeric rows for ${variable || 'unknown'}`)
  }

  const dimensions = parseHeaderDimensions(payload)
  if (dimensions) {
    const expected = dimensions.nx * dimensions.ny
    if (values.length !== expected) {
      throw new Error(`KIM grid value count mismatch for ${variable || 'unknown'}: expected ${expected}, got ${values.length}`)
    }
    return {
      variable: variable || parseHeaderValue(payload, ['variable', 'name']) || null,
      unit: parseHeaderValue(payload, ['unit']) || 'm/s',
      level,
      nx: dimensions.nx,
      ny: dimensions.ny,
      bounds: { ...bounds },
      values,
    }
  }

  const nx = rows[0].length
  if (!rows.every((row) => row.length === nx)) {
    throw new Error(`KIM grid rows have inconsistent width for ${variable || 'unknown'}`)
  }

  return {
    variable: variable || parseHeaderValue(payload, ['variable', 'name']) || null,
    unit: parseHeaderValue(payload, ['unit']) || 'm/s',
    level,
    nx,
    ny: rows.length,
    bounds: { ...bounds },
    values: rows.flat(),
  }
}

export default {
  parseKimGridText,
}
