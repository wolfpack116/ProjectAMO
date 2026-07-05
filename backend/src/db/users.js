import bcrypt from 'bcrypt'

import { normalizeForecasterAirports } from '../auth/forecaster-airports.js'

const BCRYPT_COST = 12
export const ROLES = ['pilot', 'forecaster', 'admin']

function parseAirports(json) {
  try { const a = JSON.parse(json || 'null'); return Array.isArray(a) ? a : null } catch { return null }
}

// 유저 생성 + bcrypt 해시. 스크립트(관리자 생성)와 step2 register가 공유.
// 검증 실패/중복은 코드형 Error(username_taken 등) throw — 호출자가 매핑.
export function createUser(db, { username, password, role = 'pilot', displayName = null, airports = null }) {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(String(username || ''))) throw new Error('invalid_username')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('invalid_password')
  if (!ROLES.includes(role)) throw new Error('invalid_role')

  // 담당공항은 예보관만 의미. 7개 집합만 저장.
  const airportsJson = role === 'forecaster' ? JSON.stringify(normalizeForecasterAirports(airports) ?? []) : null

  const hash = bcrypt.hashSync(password, BCRYPT_COST)
  const now = new Date().toISOString()
  try {
    const info = db
      .prepare('INSERT INTO users (username, password_hash, role, display_name, airports, created_at) VALUES (?,?,?,?,?,?)')
      .run(username, hash, role, displayName ?? username, airportsJson, now)
    return { id: info.lastInsertRowid, username, role, display_name: displayName ?? username, airports: parseAirports(airportsJson) }
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) throw new Error('username_taken')
    throw err
  }
}

// 더미 해시 — 유저 없을 때도 compare를 돌려 타이밍으로 존재여부가 새지 않게.
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-guard', BCRYPT_COST)

// 로그인 검증. 실패(없는 유저·비번 불일치) 모두 null → 라우터가 동일 401.
export function verifyLogin(db, username, password) {
  const row = db
    .prepare('SELECT id, username, password_hash, role, display_name, airports FROM users WHERE username = ?')
    .get(username)
  if (!row) {
    bcrypt.compareSync(String(password ?? ''), DUMMY_HASH) // 타이밍 평준화
    return null
  }
  if (!bcrypt.compareSync(String(password ?? ''), row.password_hash)) return null
  return { id: row.id, username: row.username, role: row.role, display_name: row.display_name, airports: parseAirports(row.airports) }
}

// 공개 유저 형태(비번 제외, 담당공항 파싱). /me·예보관 라우터 공용.
export function getUserById(db, id) {
  const row = db.prepare('SELECT id, username, role, display_name, airports FROM users WHERE id = ?').get(id)
  if (!row) return null
  return { id: row.id, username: row.username, role: row.role, display_name: row.display_name, airports: parseAirports(row.airports) }
}

export default { createUser, verifyLogin, getUserById, ROLES }
