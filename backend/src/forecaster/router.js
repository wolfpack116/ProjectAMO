import { Router } from 'express'

import { getDb } from '../db/index.js'
import { requireRole } from '../auth/middleware.js'
import { getUserById } from '../db/users.js'

const STATUSES = ['pending', 'viewed', 'closed']

function myAirports(db, userId) {
  const u = getUserById(db, userId)
  return new Set(u?.airports || [])
}

// 예보관 문의 대기열. requireRole('forecaster'). 자기 담당공항 문의만 접근.
export function createForecasterRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()

  router.use(requireRole('forecaster'))

  // 담당공항 요청 by id + 접근권한(내 공항 아니면 null → 404로 은폐)
  function loadOwned(db2, req) {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return null
    const r = db2
      .prepare('SELECT id, pilot_id, route_id, target_airport, message, status, assigned_forecaster, created_at FROM requests WHERE id = ?')
      .get(id)
    if (!r) return null
    return myAirports(db2, req.session.userId).has(r.target_airport) ? r : null
  }

  // 담당공항 문의 목록(기본 전체, ?status= 필터). 콘솔이 폴링.
  router.get('/requests', (req, res) => {
    const db2 = database()
    const airports = [...myAirports(db2, req.session.userId)]
    if (airports.length === 0) return res.json({ requests: [] })

    const params = [...airports]
    let sql = `SELECT id, pilot_id, route_id, target_airport, message, status, created_at
               FROM requests WHERE target_airport IN (${airports.map(() => '?').join(',')})`
    if (STATUSES.includes(String(req.query.status))) { sql += ' AND status = ?'; params.push(req.query.status) }
    sql += ' ORDER BY created_at DESC'
    res.json({ airports, requests: db2.prepare(sql).all(...params) })
  })

  // 문의 상세 + 경로 입력값(payload) → 콘솔이 브리핑 렌더
  router.get('/requests/:id', (req, res) => {
    const db2 = database()
    const r = loadOwned(db2, req)
    if (!r) return res.status(404).json({ error: 'not_found' })
    const route = db2.prepare('SELECT id, name, payload FROM routes WHERE id = ?').get(r.route_id)
    let snapshot = {}
    try { snapshot = JSON.parse(route?.payload || '{}') } catch { /* 손상 무시 */ }
    res.json({ request: r, route: { id: route?.id ?? null, name: route?.name ?? null, ...snapshot } })
  })

  router.post('/requests/:id/claim', (req, res) => {
    const db2 = database()
    const r = loadOwned(db2, req)
    if (!r) return res.status(404).json({ error: 'not_found' })
    const now = new Date().toISOString()
    db2.prepare("UPDATE requests SET status = 'viewed', assigned_forecaster = ?, updated_at = ? WHERE id = ?")
      .run(req.session.userId, now, r.id)
    res.json({ ok: true, status: 'viewed' })
  })

  router.post('/requests/:id/close', (req, res) => {
    const db2 = database()
    const r = loadOwned(db2, req)
    if (!r) return res.status(404).json({ error: 'not_found' })
    const now = new Date().toISOString()
    db2.prepare("UPDATE requests SET status = 'closed', updated_at = ? WHERE id = ?").run(now, r.id)
    res.json({ ok: true, status: 'closed' })
  })

  return router
}

export default createForecasterRouter
