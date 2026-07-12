import { Router } from 'express'
import { z } from 'zod'

import { getDb } from '../db/index.js'
import { requireAuth } from '../auth/middleware.js'
import { isForecasterAirport } from '../auth/forecaster-airports.js'

const createSchema = z.object({
  route_id: z.number().int().positive(),
  target_airport: z.string().regex(/^[A-Z]{4}$/),
  message: z.string().max(500).optional(),
})

// 조종사 → 예보관 문의 생성/내 문의 상태. requireAuth.
export function createMeRequestsRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()

  router.use(requireAuth)

  router.post('/requests', (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
    const { route_id, target_airport, message } = parsed.data
    if (!isForecasterAirport(target_airport)) return res.status(400).json({ error: 'not_forecaster_airport' })

    const db2 = database()
    // 경로는 내 것이어야(클라 id 불신). 없으면 404.
    const route = db2.prepare('SELECT id FROM routes WHERE id = ? AND user_id = ?').get(route_id, req.session.userId)
    if (!route) return res.status(404).json({ error: 'route_not_found' })

    const now = new Date().toISOString()
    const info = db2
      .prepare('INSERT INTO requests (pilot_id, route_id, target_airport, message, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(req.session.userId, route_id, target_airport, message ?? null, 'pending', now, now)
    res.status(201).json({ id: info.lastInsertRowid, status: 'pending', target_airport })
  })

  // 내가 보낸 문의 상태(조종사가 진행상황 확인)
  router.get('/requests', (req, res) => {
    const rows = database()
      .prepare('SELECT id, route_id, target_airport, status, created_at FROM requests WHERE pilot_id = ? ORDER BY created_at DESC')
      .all(req.session.userId)
    res.json({ requests: rows })
  })

  return router
}

export default createMeRequestsRouter
