import { randomUUID } from 'node:crypto'

// 관리자 콘솔: 익명 포함 방문 추적. 식별정보 없이 uuid 쿠키만.
const COOKIE = 'amo.vid'
const ONLINE_MS = 5 * 60 * 1000
const RETAIN_MS = 90 * 24 * 60 * 60 * 1000 // 90일 후 오래된 방문자 정리(무한 증가 방지)

export function recordVisit(db, visitorId) {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO visits (visitor_id,first_seen,last_seen) VALUES (?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET last_seen=?')
    .run(visitorId, now, now, now)
  // ponytail: 방문마다 인덱스(idx_visits_last) 기반 prune — 이 규모(운영도구)엔 무해. 쓰기량 급증 시 타이머로 이동.
  db.prepare('DELETE FROM visits WHERE last_seen < ?').run(new Date(Date.now() - RETAIN_MS).toISOString())
}

export function trafficStats(db) {
  const since = new Date(Date.now() - ONLINE_MS).toISOString()
  const online = db.prepare('SELECT COUNT(*) n FROM visits WHERE last_seen >= ?').get(since).n
  const total = db.prepare('SELECT COUNT(*) n FROM visits').get().n
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const byHour = db.prepare("SELECT substr(last_seen,12,2) hh, COUNT(*) n FROM visits WHERE last_seen >= ? GROUP BY hh").all(today.toISOString())
  return { online, total, byHour }
}

// 봇/헬스체크/정적·API 제외. 모든 방문자에 익명 쿠키 부여 후 기록. req.cookies 필요(cookie-parser).
export function visitTracker(getDb) {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/data/')) return next()
    let vid = req.cookies?.[COOKIE]
    if (!vid) { vid = randomUUID(); res.cookie(COOKIE, vid, { httpOnly: true, sameSite: 'lax', maxAge: 31536000000 }) }
    try { recordVisit(getDb(), vid) } catch { /* noop */ }
    next()
  }
}

export default { recordVisit, trafficStats, visitTracker }
