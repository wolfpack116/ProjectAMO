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
  router.post('/users/:id/approve', (req, res) => { setUserStatus(database(), Number(req.params.id), 'active'); res.json({ ok: true }) })
  router.post('/users/:id/reject', (req, res) => { setUserStatus(database(), Number(req.params.id), 'rejected'); res.json({ ok: true }) })
  router.post('/forecasters', (req, res) => {
    try {
      const u = createUser(database(), {
        username: req.body.username,
        password: req.body.password,
        role: 'forecaster',
        displayName: req.body.displayName,
        airports: req.body.airports,
        status: 'active',
      })
      res.status(201).json(u)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
  return router
}
export default createAdminRouter
