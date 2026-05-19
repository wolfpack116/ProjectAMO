export const KIM_NWP_MODEL = 'KIMG/NE57'
export const KIM_NWP_FORECAST_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
export const KIM_NWP_LEVELS = [
  { id: '10m', label: '10m', kind: 'height', value: 10, unit: 'm', level: 0, uName: 'u10m', vName: 'v10m' },
  { id: '925hPa', label: '925', kind: 'pressure', value: 925, unit: 'hPa', level: 925, uName: 'u', vName: 'v' },
  { id: '850hPa', label: '850', kind: 'pressure', value: 850, unit: 'hPa', level: 850, uName: 'u', vName: 'v' },
  { id: '700hPa', label: '700', kind: 'pressure', value: 700, unit: 'hPa', level: 700, uName: 'u', vName: 'v' },
  { id: '500hPa', label: '500', kind: 'pressure', value: 500, unit: 'hPa', level: 500, uName: 'u', vName: 'v' },
  { id: '300hPa', label: '300', kind: 'pressure', value: 300, unit: 'hPa', level: 300, uName: 'u', vName: 'v' },
]

const SCALE = 0.01
const OFFSET = 0
const MISSING_ENCODED = -32768

function round(value, digits = 3) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function encodeComponent(values) {
  return values.map((value) => (Number.isFinite(value) ? Math.round((value - OFFSET) / SCALE) : MISSING_ENCODED))
}

function decodeComponent(values, variable = {}) {
  if (variable.encoding === 'int16-scaled-json-v1') {
    return values.map((value) => (
      value === MISSING_ENCODED || !Number.isFinite(value)
        ? Number.NaN
        : value * (variable.scale ?? 1) + (variable.offset ?? 0)
    ))
  }
  return values
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

export function addForecastHours(tmfc, hf) {
  const baseMs = parseTmfc(tmfc)
  if (!Number.isFinite(baseMs)) return null
  return new Date(baseMs + Number(hf || 0) * 60 * 60 * 1000).toISOString()
}

function validateComponentPair(uComponent, vComponent) {
  if (!uComponent || !vComponent) throw new Error('KIM NWP wind grid requires u and v components')
  if (uComponent.nx !== vComponent.nx || uComponent.ny !== vComponent.ny) {
    throw new Error('KIM NWP u/v components have different dimensions')
  }
  if (uComponent.values.length !== vComponent.values.length) {
    throw new Error('KIM NWP u/v components have different value counts')
  }
}

function validateComponentShape(components = []) {
  if (!components.length) throw new Error('KIM NWP grid requires at least one component')
  const [first] = components
  for (const component of components) {
    if (!component?.variable) throw new Error('KIM NWP component requires a variable name')
    if (component.nx !== first.nx || component.ny !== first.ny) {
      throw new Error('KIM NWP components have different dimensions')
    }
    if (component.values?.length !== first.values?.length) {
      throw new Error('KIM NWP components have different value counts')
    }
  }
}

function statsForWind(uValues, vValues) {
  let minSpeed = Infinity
  let maxSpeed = -Infinity
  let totalSpeed = 0
  for (let index = 0; index < uValues.length; index += 1) {
    if (!Number.isFinite(uValues[index]) || !Number.isFinite(vValues[index])) continue
    const speed = Math.hypot(uValues[index], vValues[index])
    minSpeed = Math.min(minSpeed, speed)
    maxSpeed = Math.max(maxSpeed, speed)
    totalSpeed += speed
  }
  return {
    minSpeed: round(minSpeed),
    maxSpeed: round(maxSpeed),
    meanSpeed: round(totalSpeed / Math.max(1, uValues.filter((value, index) => Number.isFinite(value) && Number.isFinite(vValues[index])).length)),
  }
}

function statsForTemperature(values) {
  let minT = Infinity
  let maxT = -Infinity
  let total = 0
  let count = 0
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    minT = Math.min(minT, value)
    maxT = Math.max(maxT, value)
    total += value
    count += 1
  }
  return count > 0
    ? { minT: round(minT), maxT: round(maxT), meanT: round(total / count) }
    : { minT: null, maxT: null, meanT: null }
}

export function buildKimNwpGrid({ model = KIM_NWP_MODEL, tmfc, hf, level, components, fetchedAt = new Date().toISOString() }) {
  validateComponentShape(components)
  const [firstComponent] = components

  return {
    type: 'kim_nwp_grid',
    model,
    tmfc,
    hf: Number(hf),
    validTime: addForecastHours(tmfc, hf),
    level: { id: level.id, label: level.label, kind: level.kind, value: level.value, unit: level.unit },
    grid: {
      nx: firstComponent.nx,
      ny: firstComponent.ny,
      ...firstComponent.bounds,
    },
    variables: Object.fromEntries(components.map((component) => [
      component.variable,
      {
        unit: component.unit || (component.variable === 'T' ? 'K' : 'm/s'),
        encoding: 'int16-scaled-json-v1',
        scale: SCALE,
        offset: OFFSET,
        values: encodeComponent(component.values || []),
      },
    ])),
    fetched_at: fetchedAt,
  }
}

export function buildKimSurfaceWindFieldFromWindGrid(grid) {
  const uVariable = grid?.variables?.u
  const vVariable = grid?.variables?.v
  if (!uVariable || !vVariable) throw new Error('KIM NWP grid is missing u/v variables')
  const uValues = decodeComponent(uVariable.values || [], uVariable)
  const vValues = decodeComponent(vVariable.values || [], vVariable)

  return {
    type: 'kim_surface_wind',
    model: grid.model,
    grid: grid.grid,
    time: {
      tmfc: grid.tmfc,
      hf: grid.hf,
      validTime: grid.validTime,
    },
    level: grid.level,
    units: { u: uVariable.unit || 'm/s', v: vVariable.unit || 'm/s', speed: 'm/s' },
    stats: statsForWind(uValues, vValues),
    encoding: uVariable.encoding,
    scale: uVariable.scale,
    offset: uVariable.offset,
    u: uVariable.values || [],
    v: vVariable.values || [],
    fetched_at: grid.fetched_at,
  }
}

export function buildKimWindGrid({ model = KIM_NWP_MODEL, tmfc, hf, level, components, fetchedAt }) {
  const uComponent = components?.find((component) => component.variable === 'u')
  const vComponent = components?.find((component) => component.variable === 'v')
  validateComponentPair(uComponent, vComponent)
  return buildKimNwpGrid({ model, tmfc, hf, level, components, fetchedAt })
}

export function buildKimTemperatureFieldFromGrid(grid) {
  const variable = grid?.variables?.T
  if (!variable) throw new Error('KIM NWP grid is missing T variable')
  const values = decodeComponent(variable.values || [], variable)

  return {
    type: 'kim_nwp_temperature',
    model: grid.model,
    grid: grid.grid,
    time: {
      tmfc: grid.tmfc,
      hf: grid.hf,
      validTime: grid.validTime,
    },
    level: grid.level,
    units: { T: variable.unit || 'K' },
    stats: statsForTemperature(values),
    encoding: variable.encoding,
    scale: variable.scale,
    offset: variable.offset,
    T: variable.values || [],
    fetched_at: grid.fetched_at,
  }
}

export function buildKimNwpIndex({ model = KIM_NWP_MODEL, tmfc, grids, pathForGrid }) {
  const levels = KIM_NWP_LEVELS
    .filter((level) => grids.some((grid) => grid.level?.id === level.id))
    .map(({ id, label, kind, value, unit }) => ({ id, label, kind, value, unit }))
  const times = [...new Map(grids.map((grid) => [grid.hf, {
    hf: grid.hf,
    validTime: grid.validTime,
  }])).values()].sort((a, b) => a.hf - b.hf)
  const availability = {}

  for (const grid of grids) {
    const levelId = grid.level?.id
    if (!levelId) continue
    availability[levelId] ||= {}
    availability[levelId][String(grid.hf)] = {
      variables: Object.keys(grid.variables || {}),
      path: pathForGrid(grid),
    }
  }

  return {
    type: 'kim_nwp_index',
    model,
    latestRun: tmfc,
    levels,
    times,
    availability,
  }
}

export function filterKimNwpIndexForVariables(index, requiredVariables = []) {
  const availability = {}
  for (const [levelId, byHf] of Object.entries(index?.availability || {})) {
    for (const [hf, entry] of Object.entries(byHf || {})) {
      const variables = entry?.variables || []
      if (!requiredVariables.every((name) => variables.includes(name))) continue
      availability[levelId] ||= {}
      availability[levelId][String(hf)] = {
        ...entry,
        variables: requiredVariables.length
          ? requiredVariables.filter((name) => variables.includes(name))
          : variables,
      }
    }
  }
  const availableHfs = new Set(Object.values(availability).flatMap((byHf) => Object.keys(byHf)))
  return {
    ...index,
    levels: (index?.levels || []).filter((level) => availability[level.id]),
    times: (index?.times || []).filter((time) => availableHfs.has(String(time.hf))),
    availability,
  }
}

export default {
  KIM_NWP_FORECAST_HOURS,
  KIM_NWP_LEVELS,
  KIM_NWP_MODEL,
  addForecastHours,
  buildKimNwpGrid,
  buildKimNwpIndex,
  buildKimTemperatureFieldFromGrid,
  buildKimWindGrid,
  buildKimSurfaceWindFieldFromWindGrid,
  filterKimNwpIndexForVariables,
}
