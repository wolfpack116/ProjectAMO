// 리소스 24h 타임라인. 인라인 SVG로 CPU·메모리%·디스크% 3선 + CPU 피크 표시.
// props: series(metrics rows), peakCpu(row). 빈 데이터면 "데이터 수집 중".
const W = 720
const H = 180
const PAD = { top: 16, right: 16, bottom: 24, left: 32 }

function pct(used, total) {
  return total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
}

function hhmm(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function linePath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export default function ResourceTimeline({ series = [], peakCpu = null }) {
  if (!series.length) {
    return <div className="admin-chart-empty">데이터 수집 중…</div>
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const n = series.length
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (p) => PAD.top + (1 - p / 100) * innerH // 0% 하단, 100% 상단

  const lines = [
    { key: 'cpu', color: 'var(--accent)', val: (r) => r.cpu_pct ?? 0, label: 'CPU' },
    { key: 'mem', color: 'var(--level-amber)', val: (r) => pct(r.mem_used, r.mem_total), label: '메모리' },
    { key: 'disk', color: 'var(--level-gray)', val: (r) => pct(r.disk_used, r.disk_total), label: '디스크' },
  ]

  const peakIdx = peakCpu ? series.findIndex((r) => r.ts === peakCpu.ts) : -1

  return (
    <div className="admin-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="admin-chart-svg" role="img" aria-label="시스템 리소스 24시간 타임라인">
        {/* y축 눈금 0·50·100 */}
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.left} y1={y(g)} x2={W - PAD.right} y2={y(g)} stroke="var(--stroke-2)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(g) + 3} textAnchor="end" className="admin-chart-tick">{g}</text>
          </g>
        ))}
        {lines.map((ln) => (
          <path
            key={ln.key}
            d={linePath(series.map((r, i) => ({ x: x(i), y: y(ln.val(r)) })))}
            fill="none" stroke={ln.color} strokeWidth="1.6" strokeLinejoin="round"
          />
        ))}
        {/* CPU 피크 점 + 라벨 */}
        {peakIdx >= 0 && (
          <g>
            <circle cx={x(peakIdx)} cy={y(peakCpu.cpu_pct)} r="3.5" fill="var(--level-red)" />
            <text x={Math.min(x(peakIdx), W - PAD.right - 90)} y={Math.max(y(peakCpu.cpu_pct) - 8, PAD.top + 8)} className="admin-chart-peak">
              피크 {Math.round(peakCpu.cpu_pct)}% · {hhmm(peakCpu.ts)}
            </text>
          </g>
        )}
      </svg>
      <div className="admin-chart-legend">
        {lines.map((ln) => (
          <span key={ln.key} className="admin-chart-legend-item">
            <span className="admin-chart-swatch" style={{ background: ln.color }} /> {ln.label}
          </span>
        ))}
      </div>
    </div>
  )
}
