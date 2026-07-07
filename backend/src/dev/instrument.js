// 개발/테스트 인스턴스 전용 계측(Phase 2). server.js가 DISABLE_COLLECTION일 때만 기록을 켠다.
// 전부 in-memory(파일 미변경): 요청 링버퍼 + snapshot-meta 캐시 hit/miss 카운터.
// 목적: 지금 안 찍히는 요청 지연·응답 크기·헛fetch(폴링 낭비)를 /dev 관찰 탭에서 드러낸다.
const MAX_REQUESTS = 500
const requests = [] // { t, path, method, status, ms, bytes }
const cache = { hit: 0, miss: 0 }

export function recordRequest(entry) {
  requests.push(entry)
  if (requests.length > MAX_REQUESTS) requests.shift()
}

export function getRequests(limit = MAX_REQUESTS) {
  return requests.slice(-limit).reverse() // 최신순
}

// 경로별 집계: 호출수·평균/최대 지연·평균/최대 응답크기. KIM NWP 통짜 payload가 한눈에 보이게.
export function aggregateByPath() {
  const map = new Map()
  for (const r of requests) {
    const m = map.get(r.path) ?? { path: r.path, count: 0, sumMs: 0, maxMs: 0, sumBytes: 0, maxBytes: 0 }
    m.count++
    m.sumMs += r.ms; m.maxMs = Math.max(m.maxMs, r.ms)
    m.sumBytes += r.bytes; m.maxBytes = Math.max(m.maxBytes, r.bytes)
    map.set(r.path, m)
  }
  return [...map.values()]
    .map((m) => ({ path: m.path, count: m.count, avgMs: Math.round(m.sumMs / m.count), maxMs: m.maxMs, avgBytes: Math.round(m.sumBytes / m.count), maxBytes: m.maxBytes }))
    .sort((a, b) => b.maxBytes - a.maxBytes || b.count - a.count)
}

export function bumpCache(hit) { if (hit) cache.hit++; else cache.miss++ }
export function getCacheStats() { return { ...cache, total: cache.hit + cache.miss } }

export default { recordRequest, getRequests, aggregateByPath, bumpCache, getCacheStats }
