import assert from 'node:assert/strict'
import test from 'node:test'

import { createKimSnapshotMetaPoller } from './useKimSnapshotMeta.js'

test('shared KIM snapshot poller coalesces concurrent subscriber refreshes', async () => {
  let fetchCount = 0
  const poller = createKimSnapshotMetaPoller({
    fetchSnapshotMeta: async () => {
      fetchCount += 1
      return { kimNwp: { hash: `hash-${fetchCount}` } }
    },
    setInterval: () => 1,
    clearInterval: () => {},
    intervalMs: 60_000,
  })

  const seenA = []
  const seenB = []
  const unsubscribeA = poller.subscribe((snapshot) => seenA.push(snapshot))
  const unsubscribeB = poller.subscribe((snapshot) => seenB.push(snapshot))

  await Promise.all([poller.refresh(), poller.refresh()])

  assert.equal(fetchCount, 1)
  assert.equal(seenA.length, 1)
  assert.equal(seenB.length, 1)
  assert.equal(seenA[0].kimNwp.hash, 'hash-1')

  unsubscribeA()
  unsubscribeB()
})
