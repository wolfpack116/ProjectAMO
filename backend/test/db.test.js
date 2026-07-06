import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDb } from '../src/db/index.js'
import { createUser, verifyLogin, listUsers, listPending, setUserStatus } from '../src/db/users.js'

function freshDb() {
  return createDb(':memory:')
}

test('createUser: inserts pilot and returns id/role', () => {
  const db = freshDb()
  const u = createUser(db, { username: 'pilot1', password: 'password1' })
  assert.ok(Number.isInteger(Number(u.id)))
  assert.equal(u.role, 'pilot')
  assert.equal(u.display_name, 'pilot1')
})

test('createUser: password is bcrypt-hashed, never stored plain', () => {
  const db = freshDb()
  createUser(db, { username: 'pilot2', password: 'password1' })
  const row = db.prepare('SELECT password_hash FROM users WHERE username=?').get('pilot2')
  assert.notEqual(row.password_hash, 'password1')
  assert.match(row.password_hash, /^\$2[aby]\$/)
})

test('createUser: duplicate username → username_taken', () => {
  const db = freshDb()
  createUser(db, { username: 'dup', password: 'password1' })
  assert.throws(() => createUser(db, { username: 'dup', password: 'password2' }), /username_taken/)
})

test('createUser: rejects bad username / short password / bad role', () => {
  const db = freshDb()
  assert.throws(() => createUser(db, { username: 'ab', password: 'password1' }), /invalid_username/)
  assert.throws(() => createUser(db, { username: 'ok_user', password: 'short' }), /invalid_password/)
  assert.throws(() => createUser(db, { username: 'ok_user', password: 'password1', role: 'root' }), /invalid_role/)
})

test('schema: role CHECK rejects invalid role on raw insert', () => {
  const db = freshDb()
  assert.throws(() => db.prepare("INSERT INTO users (username,password_hash,role,created_at) VALUES ('x','h','wizard','t')").run(), /CHECK/)
})

test('schema: presets UNIQUE(user_id, icao)', () => {
  const db = freshDb()
  const u = createUser(db, { username: 'preset_user', password: 'password1' })
  const ins = db.prepare("INSERT INTO presets (user_id, icao, updated_at) VALUES (?,?,?)")
  ins.run(u.id, 'RKSI', 't')
  assert.throws(() => ins.run(u.id, 'RKSI', 't'), /UNIQUE/)
})

test('schema: foreign_keys ON — preset with unknown user_id rejected', () => {
  const db = freshDb()
  assert.throws(() => db.prepare("INSERT INTO presets (user_id, icao, updated_at) VALUES (9999,'RKSI','t')").run(), /FOREIGN KEY/)
})

test('schema: icao length CHECK (must be 4)', () => {
  const db = freshDb()
  const u = createUser(db, { username: 'icao_user', password: 'password1' })
  assert.throws(() => db.prepare("INSERT INTO presets (user_id, icao, updated_at) VALUES (?,?,?)").run(u.id, 'RK', 't'), /CHECK/)
})

// --- 관리자 콘솔 ---

test('users has status column defaulting to active', () => {
  const db = freshDb()
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
  assert.ok(cols.includes('status'))
  db.prepare("INSERT INTO users (username,password_hash,role,created_at) VALUES ('u','h','pilot','t')").run()
  assert.equal(db.prepare("SELECT status FROM users WHERE username='u'").get().status, 'active')
})

test('metrics and visits tables exist', () => {
  const db = freshDb()
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name)
  assert.ok(t.includes('metrics'))
  assert.ok(t.includes('visits'))
})

test('createUser status + verifyLogin returns status + admin queries', () => {
  const db = freshDb()
  createUser(db, { username: 'pilotA', password: 'password1', status: 'pending' })
  assert.equal(verifyLogin(db, 'pilotA', 'password1').status, 'pending')
  assert.equal(listPending(db).length, 1)
  setUserStatus(db, listPending(db)[0].id, 'active')
  assert.equal(verifyLogin(db, 'pilotA', 'password1').status, 'active')
  assert.equal(listUsers(db)[0].username, 'pilotA')
})
