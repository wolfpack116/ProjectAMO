import { Router } from 'express'
import { z } from 'zod'

import { getDb } from '../db/index.js'
import { requireAuth } from '../auth/middleware.js'

const EXPIRE_MS = 3 * 60 * 60 * 1000 // ETD+3h 유예 후 자동삭제 대상(스케줄러가 정리)

const registerSchema = z.object({
  templateId: z.number().int().positive(),
  etd: z.string().min(1),                                   // ISO(UTC)
  eta: z.string().min(1).nullable().optional(),             // 클라 etaCalc 계산값
  alertStartMinBeforeEtd: z.number().int().min(120).max(360).optional(), // 2~6h
  sendNoChangeConfirm: z.boolean().optional(),
})

const patchSchema = z.object({
  etd: z.string().min(1).optional(),
  eta: z.string().min(1).nullable().optional(),
}).strict()

// 감시창(ETD-N ~ ETD) 안에서 사용자당 가장 임박한 1건. 순수 함수(테스트 대상).
// flights: [{ id, etd(ISO), alertStartMinBeforeEtd }]
export function pickActiveFlight(flights, nowMs) {
  const inWindow = flights.filter((f) => {
    const etdMs = Date.parse(f.etd)
    if (!Number.isFinite(etdMs)) return false
    const startMs = etdMs - (f.alertStartMinBeforeEtd || 120) * 60000
    return nowMs >= startMs && nowMs < etdMs
  })
  if (!inWindow.length) return null
  inWindow.sort((a, b) => Date.parse(a.etd) - Date.parse(b.etd))
  return inWindow[0]
}

// #13 예정 비행(알림) 등록·관리. 템플릿(내 route)을 복제해 alert_enabled=1 행 생성.
// 전부 session.userId로만 필터. requireAuth 필수.
export function createAlertsRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()
  router.use(requireAuth)

  router.post('/alerts', (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
    const { templateId, etd, eta, alertStartMinBeforeEtd, sendNoChangeConfirm } = parsed.data

    const etdMs = Date.parse(etd)
    if (!Number.isFinite(etdMs) || etdMs <= Date.now()) return res.status(400).json({ error: 'etd_must_be_future' })
    if (eta && Date.parse(eta) <= etdMs) return res.status(400).json({ error: 'eta_after_etd' })

    const db2 = database()
    const tpl = db2.prepare('SELECT name, payload FROM routes WHERE id = ? AND user_id = ?').get(templateId, req.session.userId)
    if (!tpl) return res.status(404).json({ error: 'template_not_found' })

    const { n } = db2.prepare('SELECT COUNT(*) n FROM routes WHERE user_id = ?').get(req.session.userId)
    if (n >= 100) return res.status(400).json({ error: 'too_many_routes' })

    const now = new Date().toISOString()
    const expiresAt = new Date(etdMs + EXPIRE_MS).toISOString()
    const info = db2.prepare(`
      INSERT INTO routes (user_id, name, etd, eta, payload, alert_enabled, alert_start_min_before_etd, send_no_change_confirm, expires_at, created_at, updated_at)
      VALUES (?,?,?,?,?,1,?,?,?,?,?)
    `).run(req.session.userId, tpl.name, etd, eta ?? null, tpl.payload, alertStartMinBeforeEtd ?? 120, sendNoChangeConfirm ? 1 : 0, expiresAt, now, now)
    res.status(201).json({ id: info.lastInsertRowid })
  })

  router.get('/alerts', (req, res) => {
    const rows = database().prepare(
      'SELECT id, name, etd, eta, alert_start_min_before_etd FROM routes WHERE user_id = ? AND alert_enabled = 1 ORDER BY etd'
    ).all(req.session.userId)
    const active = pickActiveFlight(
      rows.map((r) => ({ id: r.id, etd: r.etd, alertStartMinBeforeEtd: r.alert_start_min_before_etd })),
      Date.now(),
    )
    res.json({ flights: rows.map((r) => ({ ...r, active: active?.id === r.id })) })
  })

  // ETD 조정(지연) — expires_at 재계산.
  router.patch('/alerts/:id', (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_input' })
    const patch = patchSchema.safeParse(req.body)
    if (!patch.success) return res.status(400).json({ error: 'invalid_input' })

    const db2 = database()
    const row = db2.prepare('SELECT etd, eta FROM routes WHERE id=? AND user_id=? AND alert_enabled=1').get(id, req.session.userId)
    if (!row) return res.status(404).json({ error: 'not_found' })

    const etd = patch.data.etd ?? row.etd
    const etdMs = Date.parse(etd)
    if (!Number.isFinite(etdMs)) return res.status(400).json({ error: 'invalid_input' })
    const eta = 'eta' in patch.data ? patch.data.eta : row.eta
    const expiresAt = new Date(etdMs + EXPIRE_MS).toISOString()
    db2.prepare('UPDATE routes SET etd=?, eta=?, expires_at=?, updated_at=? WHERE id=? AND user_id=?')
      .run(etd, eta ?? null, expiresAt, new Date().toISOString(), id, req.session.userId)
    res.json({ ok: true })
  })

  router.delete('/alerts/:id', (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_input' })
    database().prepare('DELETE FROM routes WHERE id=? AND user_id=? AND alert_enabled=1').run(id, req.session.userId)
    res.json({ ok: true })
  })

  return router
}

export default createAlertsRouter
