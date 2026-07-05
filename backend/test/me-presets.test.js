import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { createDb } from '../src/db/index.js'
import { sessionMiddleware } from '../src/auth/session.js'
import { createAuthRouter } from '../src/auth/router.js'
import { createMeRouter } from '../src/me/presets.js'

function makeServer() {
  const db = createDb(':memory:')
  const app = express()
  app.use(express.json())
  app.use(sessionMiddleware({ db, secret: 'test-secret-000000000000000000000000000000' }))
  app.use('/api/auth', createAuthRouter({ db }))
  app.use('/api/me', createMeRouter({ db }))
  return { db, app }
}
const listen = (app) => new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
const at = (s, p) => `http://127.0.0.1:${s.address().port}${p}`
const CLOSE = { connection: 'close' }
const JSONH = { 'content-type': 'application/json', ...CLOSE }

async function registerAndLogin(s, username) {
  await fetch(at(s, '/api/auth/register'), { method: 'POST', headers: JSONH, body: JSON.stringify({ username, password: 'password1' }) })
  const r = await fetch(at(s, '/api/auth/login'), { method: 'POST', headers: JSONH, body: JSON.stringify({ username, password: 'password1' }) })
  return r.headers.get('set-cookie').split(';')[0]
}

test('presets: PUT saves, GET returns own presets', async () => {
  const { db, app } = makeServer()
  const s = await listen(app)
  try {
    const cookie = await registerAndLogin(s, 'pilotp')
    let r = await fetch(at(s, '/api/me/presets'), { method: 'PUT', headers: { ...JSONH, cookie }, body: JSON.stringify({ presets: { RKSI: { visibilityM: 800, ceilingFt: 200 } } }) })
    assert.equal(r.status, 200)
    r = await fetch(at(s, '/api/me/presets'), { headers: { ...CLOSE, cookie } })
    assert.equal(r.status, 200)
    assert.deepEqual((await r.json()).presets, { RKSI: { visibilityM: 800, ceilingFt: 200 } })
  } finally { s.close(); db.close() }
})

test('presets: unauthenticated → 401', async () => {
  const { db, app } = makeServer()
  const s = await listen(app)
  try {
    const r = await fetch(at(s, '/api/me/presets'), { headers: CLOSE })
    assert.equal(r.status, 401)
  } finally { s.close(); db.close() }
})

test('presets: users only see their own (ownership by session, not client id)', async () => {
  const { db, app } = makeServer()
  const s = await listen(app)
  try {
    const cookieA = await registerAndLogin(s, 'userA')
    await fetch(at(s, '/api/me/presets'), { method: 'PUT', headers: { ...JSONH, cookie: cookieA }, body: JSON.stringify({ presets: { RKSS: { visibilityM: 175, ceilingFt: null } } }) })
    const cookieB = await registerAndLogin(s, 'userB')
    const r = await fetch(at(s, '/api/me/presets'), { headers: { ...CLOSE, cookie: cookieB } })
    assert.deepEqual((await r.json()).presets, {}, 'userB sees nothing of userA')
  } finally { s.close(); db.close() }
})

test('presets: invalid body → 400', async () => {
  const { db, app } = makeServer()
  const s = await listen(app)
  try {
    const cookie = await registerAndLogin(s, 'pilotq')
    const r = await fetch(at(s, '/api/me/presets'), { method: 'PUT', headers: { ...JSONH, cookie }, body: JSON.stringify({ presets: { RKSI: { visibilityM: 99999 } } }) })
    assert.equal(r.status, 400)
  } finally { s.close(); db.close() }
})
