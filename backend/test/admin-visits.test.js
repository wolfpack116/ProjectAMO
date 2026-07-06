import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createDb } from '../src/db/index.js'
import { recordVisit, trafficStats } from '../src/admin/visits.js'

test('recordVisit upserts; trafficStats counts online(5m) and total', () => {
  const db = createDb(':memory:')
  recordVisit(db, 'vis-1'); recordVisit(db, 'vis-1'); recordVisit(db, 'vis-2')
  const s = trafficStats(db)
  assert.equal(s.total, 2)
  assert.equal(s.online, 2) // 방금 기록 → 5분 내
})
