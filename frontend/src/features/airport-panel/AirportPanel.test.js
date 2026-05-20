import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./AirportPanel.jsx', import.meta.url), 'utf8')

test('AirportPanel calls hooks before returning for no selected airport', () => {
  const effectIndex = source.indexOf('useEffect(')
  const emptyReturnIndex = source.indexOf('if (!airport) return null')

  assert.ok(effectIndex >= 0)
  assert.ok(emptyReturnIndex >= 0)
  assert.ok(effectIndex < emptyReturnIndex)
})
