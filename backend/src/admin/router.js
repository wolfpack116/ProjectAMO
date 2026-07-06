import { Router } from 'express'

import { getDb } from '../db/index.js'
import { requireRole } from '../auth/middleware.js'
import { createUser, listUsers, listPending, setUserStatus } from '../db/users.js'
import { readMetrics } from './metrics.js'
import { trafficStats } from './visits.js'

// /api/admin/* — 전체 requireRole('admin'). db 주입 가능(테스트).
export function createAdminRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()
  router.use(requireRole('admin'))

  router.get('/metrics', (req, res) => res.json(readMetrics(database(), String(req.query.range || '24h'))))
  router.get('/traffic', (req, res) => res.json(trafficStats(database())))
  router.get('/users', (req, res) => res.json(listUsers(database())))
  router.get('/pending', (req, res) => res.json(listPending(database())))
  // id 검증 + 실제 변경 여부 확인(없는 id를 조용히 200 처리하지 않음).
  function setStatus(status) {
    return (req, res) => {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' })
      if (!setUserStatus(database(), id, status)) return res.status(404).json({ error: 'user_not_found' })
      res.json({ ok: true })
    }
  }
  router.post('/users/:id/approve', setStatus('active'))
  router.post('/users/:id/reject', setStatus('rejected'))

  // 알려진 검증 오류코드만 클라이언트로. 그 외(DB 내부오류 등)는 일반화해 내부정보 비노출.
  const KNOWN = new Set(['username_taken', 'invalid_username', 'invalid_password', 'invalid_role'])
  router.post('/forecasters', (req, res) => {
    if (req.body?.displayName != null && typeof req.body.displayName !== 'string') return res.status(400).json({ error: 'invalid_input' })
    if (req.body?.airports != null && !Array.isArray(req.body.airports)) return res.status(400).json({ error: 'invalid_input' })
    try {
      const u = createUser(database(), {
        username: req.body?.username,
        password: req.body?.password,
        role: 'forecaster',
        displayName: req.body?.displayName,
        airports: req.body?.airports,
        status: 'active',
      })
      res.status(201).json(u)
    } catch (err) {
      res.status(400).json({ error: KNOWN.has(err.message) ? err.message : 'invalid_input' })
    }
  })
  return router
}
export default createAdminRouter
