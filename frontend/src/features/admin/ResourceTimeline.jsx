import { useRef, useState } from 'react'

// 리소스 타임라인. CPU·메모리%·디스크% 3선 + x축 날짜/시각 + CPU 피크 + 호버 툴팁.
// props: series(metrics rows), peakCpu(row). 빈 데이터면 "데이터 수집 중".
const W = 720
const H = 196
const PAD = { top: 16, right: 16, bottom: 40, left: 32 }

function pct(used, total) {
  return total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
}

// 3선 색은 서로 최대한 구분되게(관습 차용: 차트 계열색). 게이지 임계색(green/amber/red)과 겹치지 않게.
const LINES = [
  { key: 'cpu', color: '#2563eb', label: 'CPU', val: (r) => r.cpu_pct ?? 0 },
  { key: 'mem', color: '#c2410c', label: '메모리', val: (r) => pct(r.mem_used, r.mem_total) },
  { key: 'disk', color: '#7c3aed', label: '디스크', val: (r) => pct(r.disk_used, r.disk_total) },
]

const p2 = (n) => String(n).padStart(2, '0')
const fmtTime = (ts) => { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}` }
const fmtDate = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}` }

function linePath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export default function ResourceTimeline({ series = [], peakCpu = null }) {
  const svgRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)

  if (!series.length) {
    return <div className="admin-chart-empty">데이터 수집 중…</div>
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const n = series.length
  const x = (i) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v) => PAD.top + (1 - v / 100) * innerH // 0% 하단, 100% 상단

  const peakIdx = peakCpu ? series.findIndex((r) => r.ts === peakCpu.ts) : -1

  // x축 시간 눈금(~5개). 날짜는 첫 눈금·날짜가 바뀔 때만 표시.
  const tickCount = Math.min(5, n)
  const tickIdxs = n === 1
    ? [0]
    : [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round((i * (n - 1)) / (tickCount - 1))))]
  let prevDay = null
  const xTicks = tickIdxs.map((i) => {
    const d = new Date(series[i].ts)
    const dayKey = `${d.getMonth()}-${d.getDate()}`
    const showDate = dayKey !== prevDay
    prevDay = dayKey
    return {
      x: x(i),
      time: fmtTime(series[i].ts),
      date: showDate ? fmtDate(series[i].ts) : null,
      anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle',
    }
  })

  // 마우스 x → 가장 가까운 샘플 index.
  function handleMove(e) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const vx = ((e.clientX - rect.left) / rect.width) * W
    const i = n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((vx - PAD.left) / innerW) * (n - 1))))
    setHoverIdx(i)
  }

  const hv = hoverIdx != null ? series[hoverIdx] : null
  const hx = hv ? x(hoverIdx) : 0
  const boxW = 120
  const boxH = 72
  const bx = hx < W / 2 ? hx + 10 : hx - 10 - boxW // 커서 반대쪽에 툴팁

  return (
    <div className="admin-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="admin-chart-svg"
        role="img"
        aria-label="시스템 리소스 타임라인"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* y축 눈금 0·50·100 */}
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.left} y1={y(g)} x2={W - PAD.right} y2={y(g)} stroke="var(--stroke-2)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(g) + 3} textAnchor="end" className="admin-chart-tick">{g}</text>
          </g>
        ))}
        {/* x축 날짜/시각 */}
        {xTicks.map((t, k) => (
          <g key={k}>
            <text x={t.x} y={H - PAD.bottom + 14} textAnchor={t.anchor} className="admin-chart-xtick">{t.time}</text>
            {t.date && <text x={t.x} y={H - PAD.bottom + 26} textAnchor={t.anchor} className="admin-chart-xdate">{t.date}</text>}
          </g>
        ))}
        {/* 3선 */}
        {LINES.map((ln) => (
          <path
            key={ln.key}
            d={linePath(series.map((r, i) => ({ x: x(i), y: y(ln.val(r)) })))}
            fill="none" stroke={ln.color} strokeWidth="1.6" strokeLinejoin="round"
          />
        ))}
        {/* CPU 피크 */}
        {peakIdx >= 0 && (
          <g>
            <circle cx={x(peakIdx)} cy={y(peakCpu.cpu_pct)} r="3.5" fill="var(--level-red)" />
            <text x={Math.min(x(peakIdx), W - PAD.right - 90)} y={Math.max(y(peakCpu.cpu_pct) - 8, PAD.top + 8)} className="admin-chart-peak">
              피크 {Math.round(peakCpu.cpu_pct)}% · {fmtTime(peakCpu.ts)}
            </text>
          </g>
        )}
        {/* 호버: 세로선 + 각 선 위 점 + 툴팁 */}
        {hv && (
          <g>
            <line x1={hx} y1={PAD.top} x2={hx} y2={H - PAD.bottom} stroke="var(--text-3)" strokeWidth="0.8" strokeDasharray="3 2" />
            {LINES.map((ln) => (
              <circle key={ln.key} cx={hx} cy={y(ln.val(hv))} r="3" fill={ln.color} stroke="#fff" strokeWidth="1" />
            ))}
            <rect x={bx} y={PAD.top} width={boxW} height={boxH} rx="4" fill="var(--bg-1)" stroke="var(--stroke-1)" opacity="0.97" />
            <text x={bx + 9} y={PAD.top + 16} className="admin-chart-tip-time">{fmtDate(hv.ts)} {fmtTime(hv.ts)}</text>
            {LINES.map((ln, idx) => (
              <text key={ln.key} x={bx + 9} y={PAD.top + 33 + idx * 14} className="admin-chart-tip-row">
                <tspan fill={ln.color}>■</tspan>
                <tspan fill="var(--text-2)"> {ln.label}</tspan>
                <tspan fill="var(--text-1)" fontWeight="600"> {Math.round(ln.val(hv))}%</tspan>
              </text>
            ))}
          </g>
        )}
      </svg>
      <div className="admin-chart-legend">
        {LINES.map((ln) => (
          <span key={ln.key} className="admin-chart-legend-item">
            <span className="admin-chart-swatch" style={{ background: ln.color }} /> {ln.label}
          </span>
        ))}
      </div>
    </div>
  )
}
