import os from 'node:os'
import { execSync } from 'node:child_process'

// 관리자 콘솔: 시스템 리소스 시계열. 60초 샘플, 7일 보관.
const WINDOW = { '1h': 3600e3, '24h': 86400e3, '7d': 604800e3 }
const RETAIN_MS = WINDOW['7d']

export function currentResources() {
  const cpuPct = Math.min(100, Math.round((os.loadavg()[0] / os.cpus().length) * 100))
  const memTotal = os.totalmem(); const memUsed = memTotal - os.freemem()
  let diskUsed = 0; let diskTotal = 0
  try {
    const line = execSync('df -kP /', { encoding: 'utf8' }).trim().split('\n').pop().split(/\s+/)
    diskTotal = Number(line[1]) * 1024; diskUsed = Number(line[2]) * 1024 // Linux/mac. Windows면 0(무해).
  } catch { /* df 없음(Windows dev) → 0 */ }
  return { cpuPct, memUsed, memTotal, diskUsed, diskTotal }
}

export function sampleOnce(db) {
  const r = currentResources(); const now = new Date().toISOString()
  db.prepare('INSERT INTO metrics (ts,cpu_pct,mem_used,mem_total,disk_used,disk_total) VALUES (?,?,?,?,?,?)')
    .run(now, r.cpuPct, r.memUsed, r.memTotal, r.diskUsed, r.diskTotal)
  db.prepare('DELETE FROM metrics WHERE ts < ?').run(new Date(Date.now() - RETAIN_MS).toISOString())
}

export function readMetrics(db, range = '24h') {
  const since = new Date(Date.now() - (WINDOW[range] ?? WINDOW['24h'])).toISOString()
  const series = db.prepare('SELECT ts,cpu_pct,mem_used,mem_total,disk_used,disk_total FROM metrics WHERE ts >= ? ORDER BY ts').all(since)
  const peakCpu = series.reduce((m, r) => (r.cpu_pct > (m?.cpu_pct ?? -1) ? r : m), series[0] ?? { cpu_pct: 0 })
  return { range, series, peakCpu, current: currentResources() }
}

export function startSampler(db, intervalMs = 60000) {
  sampleOnce(db)
  const t = setInterval(() => { try { sampleOnce(db) } catch { /* noop */ } }, intervalMs)
  t.unref?.()
  return () => clearInterval(t)
}

export default { currentResources, sampleOnce, readMetrics, startSampler }
