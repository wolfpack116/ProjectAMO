const M_TO_FT = 3.28084

function gridStep(min, max, count, fallback) {
  if (Number.isFinite(min) && Number.isFinite(max) && count > 1) return (max - min) / (count - 1)
  return fallback
}

export function sampleGridAt(grid, values, lon, lat) {
  if (!grid || !Array.isArray(values)) return null
  const dx = gridStep(grid.lonMin, grid.lonMax, grid.nx, grid.dx)
  const dy = gridStep(grid.latMin, grid.latMax, grid.ny, grid.dy)
  const x = Math.round((lon - grid.lonMin) / dx)
  const y = Math.round((lat - grid.latMin) / dy)
  if (x < 0 || y < 0 || x >= grid.nx || y >= grid.ny) return null
  const v = values[y * grid.nx + x]
  return Number.isFinite(v) ? v : null
}

export function buildCrossSection({ axis, run, levelIds, loadLevel }) {
  const samples = axis?.samples ?? []
  const levels = []
  const coverageTop = { T: null, moisture: null, icing: null, wind: null }
  const has = { T: false, moisture: false, icing: false, wind: false }

  for (const levelId of levelIds) {
    const field = loadLevel(levelId)
    if (!field) continue
    const { pressure, grid } = field
    const altFt = (() => {
      if (!Array.isArray(field.hgt)) return null
      let sum = 0
      let n = 0
      for (const s of samples) {
        const h = sampleGridAt(grid, field.hgt, s.lon, s.lat)
        if (Number.isFinite(h)) { sum += h; n += 1 }
      }
      return n > 0 ? (sum / n) * M_TO_FT : null
    })()

    const values = samples.map((s) => ({
      distanceNm: s.distanceNm,
      t: field.T ? nullableC(sampleGridAt(grid, field.T, s.lon, s.lat)) : null,
      moistureSpread: null,
      spread: field.spread ? sampleGridAt(grid, field.spread, s.lon, s.lat) : null,
      icing: field.icingGrade ? sampleGridAt(grid, field.icingGrade, s.lon, s.lat) : null,
      u: field.u ? sampleGridAt(grid, field.u, s.lon, s.lat) : null,
      v: field.v ? sampleGridAt(grid, field.v, s.lon, s.lat) : null,
    }))

    if (field.T) { has.T = true; coverageTop.T = trackTop(coverageTop.T, pressure) }
    if (field.spread) { has.moisture = true; coverageTop.moisture = trackTop(coverageTop.moisture, pressure) }
    if (field.icingGrade) { has.icing = true; coverageTop.icing = trackTop(coverageTop.icing, pressure) }
    if (field.u && field.v) { has.wind = true; coverageTop.wind = trackTop(coverageTop.wind, pressure) }

    levels.push({ pressure, altFt, values })
  }

  return {
    run,
    levels,
    coverage: {
      byVariable: {
        T: { available: has.T, topPressure: coverageTop.T },
        moisture: { available: has.moisture, topPressure: coverageTop.moisture },
        icing: { available: has.icing, topPressure: coverageTop.icing, disabledByConfig: !has.icing },
        wind: { available: has.wind, topPressure: coverageTop.wind },
      },
    },
    warnings: [],
  }
}

function nullableC(kelvin) {
  return Number.isFinite(kelvin) ? Math.round((kelvin - 273.15) * 100) / 100 : null
}

function trackTop(prev, pressure) {
  return prev == null ? pressure : Math.min(prev, pressure)
}
