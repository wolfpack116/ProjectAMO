// 개발/테스트 인스턴스 전용(§검증) — DISABLE_COLLECTION(cron off)으로 데이터가 고정된 환경에서 자유 조작.
//  inject: store 캐시(메모리)에만 가상 악기상을 얹는다. 파일(latest.json)은 안 건드림 → 운영/원본 안전.
//          cron이 꺼져 있어 되덮이지 않고 유지됨. 지도·브리핑·알림이 그대로 반응.
//  reset : 파일에서 다시 읽어(loadLatest) 실황(고정 원본)으로 복구 + 발생 알림 삭제.
// 마운트는 server.js에서 NODE_ENV!=='production'일 때만. requireAuth로 자기 경로만.
import { Router } from 'express'

import { getDb } from '../db/index.js'
import { requireAuth } from '../auth/middleware.js'
import { buildBriefingRequest, buildSnapshot } from '../alerts/scheduler.js'
import { composeBriefing } from '../briefing/briefing-composer.js'
import { detectChanges } from '../alerts/diff.js'
import { dispatchAlert } from '../alerts/sender.js'
import { getCached, updateCache, canonicalHash, loadLatest } from '../store.js'
import config from '../config.js'
import path from 'node:path'

const INJECT_TYPES = ['metar', 'taf', 'sigmet']
const LIFR = { vis: 800, clouds: [{ amount: 'OVC', base: 100, raw: 'OVC001' }], wx: [{ raw: 'TSRA', intensity: 'HEAVY', descriptor: 'TS', phenomena: ['RA'], icon_key: 'TSRA' }] }
const IFR = { vis: 3000, clouds: [{ amount: 'OVC', base: 600, raw: 'OVC006' }], wx: null }
const mergeAirports = (a, b) => ({ ...(a?.airports || {}), ...(b?.airports || {}) })
const visTok = (v) => String(Math.min(9999, Math.round(v))).padStart(4, '0')

function overlayMetar(metar, icao, c) {
  const m = structuredClone(metar); const ap = m?.airports?.[icao]
  if (ap?.observation) {
    ap.observation.visibility = { value: c.vis, minimum_value: null, minimum_direction_degrees: null, cavok: false }
    ap.observation.clouds = c.clouds
    if (c.wx) ap.observation.weather = c.wx
    ap.observation.display = { ...(ap.observation.display ?? {}), visibility: visTok(c.vis), clouds: c.clouds.map((x) => x.raw).join(' '), ...(c.wx ? { weather: c.wx.map((w) => w.raw).join(' ') } : {}) }
    ap.cavok_flag = false
  }
  return m
}
function overlayTaf(taf, icao, c) {
  const t = structuredClone(taf); const ap = t?.airports?.[icao]
  if (ap) {
    ap.timeline = (ap.timeline ?? []).map((e) => ({
      ...e, visibility: { value: c.vis, cavok: false }, clouds: c.clouds, weather: c.wx ?? e.weather,
      display: { ...(e.display ?? {}), visibility: visTok(c.vis), clouds: c.clouds.map((x) => x.raw).join(' ') },
    }))
    if (ap.base) Object.assign(ap.base, { vis: c.vis, clouds: c.clouds, wx: c.wx ?? ap.base.wx, clouds_touched: true, wx_touched: !!c.wx, cavok_flag: false })
  }
  return t
}
// icao가 국내/해외 어느 store 타입에 있든 그 타입 캐시를 복제·수정해 updateCache(메모리).
function injectAirport(icao, c) {
  const metar = getCached('metar'); const metarO = getCached('metar_overseas')
  const taf = getCached('taf'); const tafO = getCached('taf_overseas')
  if (metar?.airports?.[icao]) { const m = overlayMetar(metar, icao, c); updateCache('metar', m, canonicalHash(m)) }
  if (metarO?.airports?.[icao]) { const m = overlayMetar(metarO, icao, c); updateCache('metar_overseas', m, canonicalHash(m)) }
  if (taf?.airports?.[icao]) { const t = overlayTaf(taf, icao, c); updateCache('taf', t, canonicalHash(t)) }
  if (tafO?.airports?.[icao]) { const t = overlayTaf(tafO, icao, c); updateCache('taf_overseas', t, canonicalHash(t)) }
}
function injectRouteSigmet(geometry) {
  const coords = geometry?.coordinates
  if (!coords?.length) return
  const [lon, lat] = coords[Math.floor(coords.length / 2)]; const d = 1.2
  const box = [[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]
  const now = Date.now()
  const sig = structuredClone(getCached('sigmet') ?? { type: 'sigmet', items: [] })
  sig.items = [...(sig.items ?? []), {
    id: `DEV-TS-${now}`, sequence_number: 'D01', report_status: 'NORMAL', cancelled: false,
    phenomenon_code: 'EMBD_TS', phenomenon_label: 'Embedded Thunderstorm', time_indicator: 'FORECAST',
    valid_from: new Date(now - 3600e3).toISOString(), valid_to: new Date(now + 6 * 3600e3).toISOString(),
    fir: 'RKRR', altitude: { lower_fl: null, upper_fl: 400, lower_ref: null, upper_ref: 'STD' },
    motion: { direction_deg: 90, speed_kt: 15 }, geometry: { type: 'Polygon', coordinates: [box] },
  }]
  updateCache('sigmet', sig, canonicalHash(sig))
}
function cleanBaseline(curr) {
  const clean = (a) => (a ? { ...a, ceilingFt: 9999, visibilityM: 9999, ts: false, alternateRequired: false } : a)
  return { dep: clean(curr.dep), dest: clean(curr.dest), altn: clean(curr.altn), hazards: [], enroute: { icing: null, turb: null } }
}
function currentData() {
  return {
    metar: getCached('metar'), metarOverseas: getCached('metar_overseas'),
    taf: getCached('taf'), tafOverseas: getCached('taf_overseas'),
    sigmet: getCached('sigmet'), sigmetOverseas: getCached('sigmet_overseas'),
    airmet: getCached('airmet'), warning: getCached('warning'),
    amos: getCached('amos'), takeoff_fcst: getCached('takeoff_fcst'), notam: getCached('notam'),
  }
}

export function createDevRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()
  router.use(requireAuth)

  // POST /api/dev/inject { routeId, scenario:{depLifr,destIfr,routeTs} } → store(메모리)에 악기상 주입 + 알림 발화.
  router.post('/inject', async (req, res) => {
    const db2 = database()
    const uid = req.session.userId
    const { routeId, scenario = { depLifr: true, routeTs: true } } = req.body ?? {}
    const route = db2.prepare('SELECT * FROM routes WHERE id = ? AND user_id = ?').get(Number(routeId), uid)
    if (!route) return res.status(404).json({ error: 'no_route', hint: '먼저 경로를 저장하세요.' })
    const request = buildBriefingRequest(route)
    if (!request) return res.status(400).json({ error: 'no_geometry', hint: '이 경로에 항로 좌표가 없습니다.' })

    if (scenario.depLifr) injectAirport(request.departureAirport, LIFR)
    if (scenario.destIfr) injectAirport(request.arrivalAirport, IFR)
    if (scenario.routeTs) injectRouteSigmet(request.routeGeometry)

    // 주입된 store로 알림 계산 + 적재 + 발송(알림센터/텔레그램).
    const data = currentData()
    const briefing = composeBriefing(request, data)
    const curr = buildSnapshot(briefing, mergeAirports(data.taf, data.tafOverseas), request)
    const u = db2.prepare('SELECT min_ceiling_ft, min_visibility_m FROM users WHERE id = ?').get(uid)
    const minima = { ceilingFt: u?.min_ceiling_ft ?? null, visibilityM: u?.min_visibility_m ?? null }
    const changes = detectChanges(cleanBaseline(curr), curr, { minima })

    const nowIso = new Date().toISOString()
    const routeCtx = { id: route.id, name: route.name, eta: route.eta }
    let fired = 0
    for (const c of changes) {
      if (fired) await new Promise((r) => setTimeout(r, 400)) // 텔레그램 flood 회피
      const id = db2.prepare(`
        INSERT INTO triggered_alerts (user_id, route_id, type, severity, target, from_val, to_val, source_id, dedup_key, detected_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(uid, route.id, c.type, c.severity, c.target ?? null,
        c.from == null ? null : String(c.from), c.to == null ? null : String(c.to),
        'dev', c.dedupKey, nowIso).lastInsertRowid
      await dispatchAlert(db2, { ...c, id, route_id: route.id, to_val: c.to == null ? null : String(c.to) }, routeCtx)
      fired++
    }
    res.json({ ok: true, routeId: route.id, dep: request.departureAirport, firedCount: fired, note: '지도·브리핑·알림에 반영됨. [초기화]로 실황 복구.' })
  })

  // POST /api/dev/reset → 파일(고정 원본)에서 다시 읽어 store 복구 + 내 발생 알림 삭제.
  router.post('/reset', (req, res) => {
    const base = config.storage.base_path
    const restored = []
    for (const type of INJECT_TYPES) {
      const latest = loadLatest(path.join(base, type))
      if (latest) { updateCache(type, latest, canonicalHash(latest)); restored.push(type) }
    }
    const deletedAlerts = database().prepare('DELETE FROM triggered_alerts WHERE user_id = ?').run(req.session.userId).changes
    res.json({ ok: true, restored, deletedAlerts, note: '실황(고정 원본) 복구 + 발생 알림 삭제.' })
  })

  return router
}

export default createDevRouter
