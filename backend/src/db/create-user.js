// 관리자·예보관·조종사 계정 생성 CLI (예보관은 공개 등록 불가 → 관리자가 이걸로 생성).
// 사용: USERNAME=admin PASSWORD='...' ROLE=admin node src/db/create-user.js
//       (ROLE 기본 admin. 예보관: ROLE=forecaster)
import { getDb } from './index.js'
import { createUser } from './users.js'

const username = process.env.USERNAME
const password = process.env.PASSWORD
const role = process.env.ROLE || 'admin'
const displayName = process.env.DISPLAY_NAME || null

if (!username || !password) {
  console.error("Usage: USERNAME=.. PASSWORD=.. [ROLE=admin|forecaster|pilot] [DISPLAY_NAME=..] node src/db/create-user.js")
  process.exit(1)
}

try {
  const user = createUser(getDb(), { username, password, role, displayName })
  console.log(`Created ${user.role} '${user.username}' (id ${user.id})`)
} catch (err) {
  console.error('Failed:', err.message)
  process.exit(1)
}
