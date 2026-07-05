// 인증/인가 미들웨어. 세션 미들웨어 뒤에 위치해야 req.session 존재.

// 절대 만료(24h) 초과면 세션 파기. 유휴(1h)는 rolling maxAge가 처리.
function absoluteExpired(session) {
  return session?.absoluteExpiry && Date.now() > session.absoluteExpiry
}

export function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'unauthenticated' })
  if (absoluteExpired(req.session)) {
    return req.session.destroy(() => res.status(401).json({ error: 'session_expired' }))
  }
  next()
}

// 역할 게이트. admin은 상위 권한으로 모든 역할 통과.
export function requireRole(role) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.session.role !== role && req.session.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden' })
      }
      next()
    })
  }
}

export default { requireAuth, requireRole }
