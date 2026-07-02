import { categoryFor } from './flight-category.js'
import { ceilingFromClouds } from './airport-summary.js'

function entryMetrics(entry) {
  const visibilityM = entry.visibility?.cavok ? 9999 : entry.visibility?.value
  const ceilingFt = ceilingFromClouds(entry.clouds)
  return { visibilityM, ceilingFt }
}

export function selectTafAtEta(taf, etaIso) {
  const timeline = taf?.timeline ?? []
  if (timeline.length === 0) return null
  const eta = Date.parse(etaIso)
  if (!Number.isFinite(eta)) return null

  let best = null
  for (const entry of timeline) {
    const t = Date.parse(entry.time)
    if (!Number.isFinite(t)) continue
    const delta = Math.abs(t - eta)
    if (!best || delta < best.delta) {
      const { visibilityM, ceilingFt } = entryMetrics(entry)
      best = { delta, entry: { time: entry.time, ...entry.display, category: categoryFor({ visibilityM, ceilingFt }) } }
    }
  }
  return best?.entry ?? null
}

// ── ⑥ 목적지 리치 모델 (타임라인 막대 + 기간표 + 교체 병렬 + 원문 재구성) ──

const pad2 = (n) => String(n).padStart(2, '0')
const pad3 = (n) => String(n).padStart(3, '0')

function stateCategory({ visibilityM, cavok, clouds }) {
  const vis = cavok ? 9999 : visibilityM
  return categoryFor({ visibilityM: vis, ceilingFt: ceilingFromClouds(clouds) })
}
function windText(wind) {
  if (!wind) return '-'
  if (wind.calm) return 'CALM'
  const dir = wind.variable ? 'VRB' : pad3(wind.direction ?? 0)
  return `${dir}/${pad2(wind.speed ?? 0)}kt${Number.isFinite(wind.gust) ? ` G${wind.gust}` : ''}`
}
function visText(visibilityM, cavok) {
  if (cavok) return '≥10km'
  if (!Number.isFinite(visibilityM)) return '-'
  return visibilityM >= 9999 ? '≥10km' : `${(visibilityM / 1000).toFixed(1)}km`
}
function cloudText(clouds, cavok) {
  if (cavok) return 'CAVOK'
  if (!clouds || clouds.length === 0) return 'NSC'
  return clouds.map((c) => c.raw || `${c.amount}${pad3(Math.round((c.base ?? 0) / 100))}`).join(' ')
}
function wxText(wx) { return (wx && wx.length) ? wx.map((w) => w.raw || w).join(' ') : '—' }

function mergeState(base, g) {
  return {
    wind: g.wind ?? base.wind,
    vis: g.vis != null ? g.vis : base.vis,
    cavok: g.cavok_flag ?? base.cavok_flag,
    clouds: g.clouds_touched ? g.clouds : base.clouds,
    wx: g.wx_touched ? g.wx : base.wx,
  }
}
function periodRow(type, start, end, s) {
  return {
    type, start, end,
    category: stateCategory({ visibilityM: s.vis, cavok: s.cavok, clouds: s.clouds }),
    wind: windText(s.wind), vis: visText(s.vis, s.cavok), clouds: cloudText(s.clouds, s.cavok), wx: wxText(s.wx),
  }
}
function buildPeriods(taf, validity) {
  const base = taf?.base
  if (!base) return []
  const baseState = { wind: base.wind, vis: base.vis, cavok: base.cavok_flag, clouds: base.clouds, wx: base.wx }
  const rows = [periodRow('base', validity.start, validity.end, baseState)]
  for (const g of (taf.change_groups ?? [])) rows.push(periodRow(g.type, g.start, g.end, mergeState(base, g)))
  return rows
}
function categoryTimeline(taf) {
  return (taf?.timeline ?? []).map((e) => ({
    time: e.time,
    category: stateCategory({ visibilityM: e.visibility?.value, cavok: e.visibility?.cavok, clouds: e.clouds }),
  }))
}
// DDHHZ (UTC) — 원문 재구성용.
function ddhh(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '----'
  return `${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}`
}
function reconstructRaw(taf) {
  if (!taf?.base) return null
  const h = taf.header ?? {}
  const p = buildPeriods(taf, { start: h.valid_start, end: h.valid_end })
  const seg = (r) => [r.wind !== '-' ? r.wind.replace('kt', 'KT') : null, r.vis, r.clouds, r.wx !== '—' ? r.wx : null].filter(Boolean).join(' ')
  const lines = [`TAF ${h.icao ?? ''} ${ddhh(h.issued)}Z ${ddhh(h.valid_start)}/${ddhh(h.valid_end)} ${seg(p[0])}`]
  for (const r of p.slice(1)) lines.push(`  ${r.type} ${ddhh(r.start)}/${ddhh(r.end)} ${seg(r)}`)
  return `${lines.join('\n')}=`
}

// 교체공항 병렬 요약(범주 + 타임라인 압축 막대용).
function buildAlternate(alternateTaf, etaIso) {
  if (!alternateTaf) return null
  const atEta = selectTafAtEta(alternateTaf, etaIso)
  return {
    icao: alternateTaf.header?.icao ?? null,
    category: atEta?.category ?? null,
    validity: { start: alternateTaf.header?.valid_start ?? null, end: alternateTaf.header?.valid_end ?? null },
    timeline: categoryTimeline(alternateTaf),
    tafAtEta: atEta,
  }
}

// 목적지 전체 모델. alternateTaf는 교체공항의 원 TAF(있으면 병렬 표시).
export function buildDestination(taf, etaIso, { alternateTaf = null, flightRule } = {}) {
  const tafAtEta = selectTafAtEta(taf, etaIso)
  const alt = flightRule === 'IFR' ? alternateRequired(taf, etaIso) : { required: null, reason: 'VFR' }
  const validity = { start: taf?.header?.valid_start ?? null, end: taf?.header?.valid_end ?? null }
  return {
    icao: taf?.header?.icao ?? null,
    category: tafAtEta?.category ?? null,
    taf: tafAtEta,
    validity,
    eta: etaIso,
    timeline: categoryTimeline(taf),
    periods: buildPeriods(taf, validity),
    raw: reconstructRaw(taf),
    alternate: buildAlternate(alternateTaf, etaIso),
    alternateRequired: alt.required,
    alternateReason: alt.reason,
  }
}

// 1-2-3 근사: ETA ±1h 구간에서 운고<2000ft 또는 시정<5000m이면 교체공항 필요.
export function alternateRequired(taf, etaIso) {
  const timeline = taf?.timeline ?? []
  const eta = Date.parse(etaIso)
  if (timeline.length === 0 || !Number.isFinite(eta)) return { required: null, reason: 'TAF 없음' }
  const windowMs = 60 * 60 * 1000

  for (const entry of timeline) {
    const t = Date.parse(entry.time)
    if (!Number.isFinite(t) || Math.abs(t - eta) >= windowMs) continue
    const { visibilityM, ceilingFt } = entryMetrics(entry)
    const lowCeiling = Number.isFinite(ceilingFt) && ceilingFt < 2000
    const lowVis = Number.isFinite(visibilityM) && visibilityM < 5000
    if (lowCeiling || lowVis) {
      return { required: true, reason: 'ETA±1h 운고<2000ft 또는 시정<5000m' }
    }
  }
  return { required: false, reason: 'ETA±1h 최저치 충족' }
}

export default { selectTafAtEta, alternateRequired }
