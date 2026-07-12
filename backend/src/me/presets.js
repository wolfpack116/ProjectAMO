import { Router } from 'express'
import { z } from 'zod'

import { getDb } from '../db/index.js'
import { requireAuth } from '../auth/middleware.js'

// #13 개인 미니마 — 사용자당 단일값(공항별 아님). users.min_ceiling_ft/min_visibility_m.
// (공항별 미니마는 AIP/설비 기반 고정값 → 코드 상수 DEFAULT_AIRPORT_MINIMA_RULES로만 관리, 사용자 편집·presets 폐기.)
const minimaSchema = z.object({
  ceilingFt: z.number().int().min(0).max(60000).nullable().optional(),
  visibilityM: z.number().int().min(0).max(10000).nullable().optional(),
}).strict()

// 내 개인 데이터. 모든 쿼리는 req.session.userId로만 필터(클라 id 불신). requireAuth 필수.
export function createMeRouter({ db = null } = {}) {
  const router = Router()
  const database = () => db || getDb()

  router.use(requireAuth)

  // #13 단일 개인 미니마 — 알림 판정 기준선(사용자당 하나). 공항별 미니마는 코드 상수라 API 없음.
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
