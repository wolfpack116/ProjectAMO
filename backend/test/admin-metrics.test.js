import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createDb } from '../src/db/index.js'
import { sampleOnce, readMetrics, currentResources } from '../src/admin/metrics.js'

test('sampleOnce writes a row; readMetrics returns it with peak', () => {
  const db = createDb(':memory:')
  sampleOnce(db)
  const out = readMetrics(db, '24h')
  assert.ok(out.series.length >= 1)
  assert.ok(Number.isFinite(out.peakCpu.cpu_pct))
  const cur = currentResources()
  assert.ok(cur.memTotal > 0)
})
