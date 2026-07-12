import { test } from 'node:test'
import assert from 'node:assert/strict'
import config from '../src/config.js'
import store from '../src/store.js'

test('config.notam exists with 24h horizon', () => {
  assert.equal(config.notam.horizon_hours, 24)
  assert.ok(Array.isArray(config.notam.fir_codes))
  assert.ok(config.notam.fir_codes.includes('RKRR'))
  assert.equal(typeof config.schedule.notam_interval, 'string')
})

test("store.save('notam') does not throw (type registered)", () => {
  assert.doesNotThrow(() => store.save('notam', { fetched_at: new Date().toISOString(), horizon_hours: 24, items: [] }))
})
