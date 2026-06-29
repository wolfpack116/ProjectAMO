// 경로 단면 로더 — KIM 압력면 단면 + KTG 저고도 난류를 한 번에 로드한다.
// /api/briefing/cross-section 라우트와 route-briefing enroute 모델 요약이 공유한다.
// (이전에 server.js에 두 벌로 중복돼 있던 로딩 로직을 통합한 것.)
import config from '../config.js'
import { buildCrossSection, buildKtgCrossSection } from './cross-section-sampler.js'
import { buildRouteAxis } from './route-axis.js'
import { selectNearestForecastHour } from '../processors/kim-forecast-hour.js'
import {
  buildKimCloudPotentialFieldFromGrid,
  buildKimIcingFieldFromGrid,
  KIM_NWP_LEVELS,
  filterKimNwpIndexForVariables,
} from '../processors/kim-nwp-model.js'
import { readKimNwpGrid, readKimNwpIndex, readKimNwpLatest } from '../processors/kim-nwp-store.js'
import { readKtgLatest, readKtgIndex, readKtgCoords, readKtgGridSafe } from '../processors/ktg-store.js'

const KIM_ICING_REQUIRED_VARIABLES = ['T', 'rh_liq', 'w', 'tqc', 'tqi', 'tqr', 'tqs', 'cld']

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

// 경로의 KIM/KTG 단면 필드를 로드한다. KIM run이 없으면 { available: false }.
export function loadRouteCrossSection({ root, routeGeometry, body = {} }) {
  const latest = readKimNwpLatest(root)
  if (!latest?.latestRun) return { available: false, reason: 'kim run unavailable' }
  const index = readKimNwpIndex(root)
  const tmfc = String(body.tmfc || latest.latestRun)
  // 압력면 바람(u/v) 데이터가 실제로 있는 시각만 후보로 삼는다.
  const pressureWindIndex = filterKimNwpIndexForVariables(index, ['u', 'v'])
  const availableHours = pressureWindIndex?.times?.filter((t) => {
    const pressureLevels = (pressureWindIndex?.levels ?? []).filter((l) => l.kind === 'pressure')
    return pressureLevels.some((l) => pressureWindIndex.availability?.[l.id]?.[String(t.hf)])
  }).map((t) => t.hf) ?? []
  const candidateHours = availableHours.length > 0 ? availableHours : (config.kim_nwp?.forecast_hours || [0, 3, 6, 9, 12])
  const hf = Number.isFinite(Number(body.hf)) ? Number(body.hf) : selectNearestForecastHour({ tmfc, candidateHours })

  const axis = buildRouteAxis(routeGeometry, body.sampleSpacingMeters ?? 250)

  const loadLevel = (levelId) => {
    const level = KIM_NWP_LEVELS.find((l) => l.id === levelId)
    if (!level || level.kind !== 'pressure') return null
    let grid
    try {
      grid = readKimNwpGrid({ root, model: 'KIMG/NE57', tmfc, hf, levelId })
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
    if (KIM_ICING_REQUIRED_VARIABLES.every((n) => grid.variables?.[n])) {
      const f = buildKimIcingFieldFromGrid(grid)
      out.icingGrade = f.icingGrade.map((v) => (v === -32768 ? null : v))
    }
    return out
  }

  const crossSection = buildCrossSection({
    axis,
    run: { tmfc, hf, validTime: latest.validTime ?? null },
    levelIds: KIM_NWP_LEVELS.filter((l) => l.kind === 'pressure').map((l) => l.id),
    loadLevel,
  })

  // KTG 저고도 난류
  const ktgLatest = readKtgLatest(root)
  const ktgIndex = ktgLatest ? readKtgIndex(root) : null
  const ktgCoords = ktgLatest ? readKtgCoords({ root, tmfc: ktgLatest.tmfc, hf: ktgLatest.hf }) : null
  const turbulence = buildKtgCrossSection({
    axis,
    coords: ktgCoords,
    altLevelsFt: ktgIndex?.altLevelsFt ?? [],
    loadAltGrid: (altFt) => readKtgGridSafe({ root, tmfc: ktgLatest?.tmfc, hf: ktgLatest?.hf, altFt }),
  })
  if (ktgLatest) turbulence.run = { tmfc: ktgLatest.tmfc, hf: ktgLatest.hf, validTime: ktgLatest.validTime }

  return { available: true, crossSection, turbulence, totalDistanceNm: axis.totalDistanceNm }
}
