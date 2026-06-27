import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listProfiles, saveProfile, deleteProfile, getLastUsed, setLastUsed } from './aircraftProfiles.js'

function fakeStore() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}

test('save/list/delete named profiles round-trips', () => {
  const s = fakeStore()
  assert.deepEqual(listProfiles(s), [])
  saveProfile({ name: '세스나 172', tasKt: 120, altitudeFt: 9000 }, s)
  saveProfile({ name: 'TBM', tasKt: 250, altitudeFt: 20000 }, s)
  assert.deepEqual(listProfiles(s).map((p) => p.name), ['세스나 172', 'TBM'])
  saveProfile({ name: '세스나 172', tasKt: 110, altitudeFt: 8000 }, s)
  assert.equal(listProfiles(s).length, 2)
  assert.equal(listProfiles(s).find((p) => p.name === '세스나 172').tasKt, 110)
  deleteProfile('TBM', s)
  assert.deepEqual(listProfiles(s).map((p) => p.name), ['세스나 172'])
})

test('last-used perf round-trips and tolerates empty', () => {
  const s = fakeStore()
  assert.equal(getLastUsed(s), null)
  setLastUsed({ tasKt: 140, altitudeFt: 7500 }, s)
  assert.deepEqual(getLastUsed(s), { tasKt: 140, altitudeFt: 7500 })
})

test('listProfiles tolerates corrupt storage', () => {
  const s = fakeStore()
  s.setItem('amo_aircraft_profiles', 'not json')
  assert.deepEqual(listProfiles(s), [])
})
