import { Router } from 'express'
import { z } from 'zod'

import { getDb } from '../db/index.js'
import { requireAuth } from '../auth/middleware.js'

// 프론트 airport_minima_settings 형태: { [ICAO]: { visibilityM, ceilingFt } }
const AIRPORT_MINIMA = z
  .object({
    visibilityM: z.number().int().min(0).max(10000).nullable().optional(),
    ceilingFt: z.number().int().min(0).max(60000).nullable().optional(),
  })
  .strict()

const presetsSchema = z.object({
  presets: z.record(z.string().regex(/^[A-Z]{4}$/), AIRPORT_MINIMA),
})

// #13 개인 미니마 — 사용자당 단일값(공항별 아님). users.min_ceiling_ft/min_visibility_m.
const minimaSchema = z.object({
  ceilingFt: z.number().int().min(0).max(60000).nullable().optional(),
  visibilityM: z.number().int().min(0).max(10000).nullable().optional(),
}).strict()

// 내 개인 데이터. 모든 쿼리는 req.session.userId로만 필터(클라 id 불신). requireAuth 필수.
export function createMeRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()

  router.use(requireAuth)

  router.get('/presets', (req, res) => {
    const rows = database()
      .prepare('SELECT icao, ceiling_ft, visibility_m FROM presets WHERE user_id = ?')
      .all(req.session.userId)
    const presets = {}
    for (const row of rows) presets[row.icao] = { visibilityM: row.visibility_m, ceilingFt: row.ceiling_ft }
    res.json({ presets })
  })

  // 전체 저장(SettingsModal은 미니마를 한 번에 저장) → upsert. 트랜잭션.
  router.put('/presets', (req, res) => {
    const parsed = presetsSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })

    const db2 = database()
    const now = new Date().toISOString()
    const upsert = db2.prepare(`
      INSERT INTO presets (user_id, icao, ceiling_ft, visibility_m, updated_at)
      VALUES (@user_id, @icao, @ceiling_ft, @visibility_m, @updated_at)
      ON CONFLICT(user_id, icao) DO UPDATE SET
        ceiling_ft = excluded.ceiling_ft,
        visibility_m = excluded.visibility_m,
        updated_at = excluded.updated_at
    `)
    const tx = db2.transaction((entries) => {
      for (const [icao, v] of entries) {
        upsert.run({
          user_id: req.session.userId,
          icao,
          ceiling_ft: v.ceilingFt ?? null,
          visibility_m: v.visibilityM ?? null,
          updated_at: now,
        })
      }
    })
    tx(Object.entries(parsed.data.presets))
    res.json({ ok: true })
  })

  router.delete('/presets/:icao', (req, res) => {
    const icao = String(req.params.icao || '').toUpperCase()
    if (!/^[A-Z]{4}$/.test(icao)) return res.status(400).json({ error: 'invalid_input' })
    database().prepare('DELETE FROM presets WHERE user_id = ? AND icao = ?').run(req.session.userId, icao)
    res.json({ ok: true })
  })

  // #13 단일 개인 미니마 — 알림 판정 기준선. presets(공항별)와 별개.
  router.get('/minima', (req, res) => {
    const row = database().prepare('SELECT min_ceiling_ft, min_visibility_m FROM users WHERE id = ?').get(req.session.userId)
    res.json({ minima: { ceilingFt: row?.min_ceiling_ft ?? null, visibilityM: row?.min_visibility_m ?? null } })
  })

  router.put('/minima', (req, res) => {
    const parsed = minimaSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
    database()
      .prepare('UPDATE users SET min_ceiling_ft = ?, min_visibility_m = ? WHERE id = ?')
      .run(parsed.data.ceilingFt ?? null, parsed.data.visibilityM ?? null, req.session.userId)
    res.json({ ok: true })
  })

  return router
}

export default createMeRouter
