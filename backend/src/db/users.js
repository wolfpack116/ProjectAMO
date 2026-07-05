import bcrypt from 'bcrypt'

const BCRYPT_COST = 12
export const ROLES = ['pilot', 'forecaster', 'admin']

// 유저 생성 + bcrypt 해시. 스크립트(관리자 생성)와 step2 register가 공유.
// 검증 실패/중복은 코드형 Error(username_taken 등) throw — 호출자가 매핑.
export function createUser(db, { username, password, role = 'pilot', displayName = null }) {
  if (!/^[A-Za-z0-9_]{3,32}$/.test(String(username || ''))) throw new Error('invalid_username')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('invalid_password')
  if (!ROLES.includes(role)) throw new Error('invalid_role')

  const hash = bcrypt.hashSync(password, BCRYPT_COST)
  const now = new Date().toISOString()
  try {
    const info = db
      .prepare('INSERT INTO users (username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?)')
      .run(username, hash, role, displayName ?? username, now)
    return { id: info.lastInsertRowid, username, role, display_name: displayName ?? username }
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
    .prepare('SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?')
    .get(username)
  if (!row) {
    bcrypt.compareSync(String(password ?? ''), DUMMY_HASH) // 타이밍 평준화
    return null
  }
  if (!bcrypt.compareSync(String(password ?? ''), row.password_hash)) return null
  return { id: row.id, username: row.username, role: row.role, display_name: row.display_name }
}

export default { createUser, verifyLogin, ROLES }
