import { useEffect, useState } from 'react'
import { Badge, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, makeStyles, tokens } from '../../../shared/ui/fluent.js'
import { getNotifications, getSnapshotMeta, getVitals, getRequestLog, getProcessorLog, getStoreStats } from '../developerApi.js'

const POLL_MS = 2000
const useStyles = makeStyles({
  body: { display: 'flex', flexDirection: 'column', gap: '18px' },
  section: { display: 'flex', flexDirection: 'column', gap: '8px' },
  h: { fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  note: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular },
  cards: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  card: { padding: '10px 14px', borderRadius: tokens.borderRadiusMedium, background: tokens.colorNeutralBackground3, minWidth: '110px' },
  cardLabel: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  cardValue: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  empty: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  mono: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
  big: { color: tokens.colorPaletteRedForeground1, fontWeight: tokens.fontWeightSemibold }, // 통짜 payload 강조
})

const SEV = { info: 'informative', low: 'informative', medium: 'warning', high: 'danger', critical: 'danger' }
const mb = (n) => `${(n / 1024 / 1024).toFixed(0)}MB`
const hms = (sec) => `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
const hhmmss = (iso) => (iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour12: false }) : '—')
const short = (v) => (v && typeof v === 'object' ? (v.hash ?? v.status ?? JSON.stringify(v)).toString().slice(0, 16) : String(v ?? '—').slice(0, 16))
const bytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : n >= 1024 ? `${(n / 1024).toFixed(0)}KB` : `${n}B`)

// ② 관찰 탭 — 2초 폴링. 기본(vitals·알림·해시) + Phase 2 심화(요청 지연/크기·수집기·store/캐시).
export default function ObserveTab() {
  const s = useStyles()
  const [d, setD] = useState({}) // { feed, meta, vitals, req, proc, store }

  useEffect(() => {
    let alive = true
    const load = async () => {
      const r = await Promise.allSettled([getNotifications(), getSnapshotMeta(), getVitals(), getRequestLog(80), getProcessorLog(20), getStoreStats()])
      if (!alive) return
      const val = (i) => (r[i].status === 'fulfilled' ? r[i].value : undefined)
      setD({ feed: val(0)?.notifications, meta: val(1), vitals: val(2), req: val(3), proc: val(4), store: val(5) })
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const feed = d.feed ?? []
  const byPath = d.req?.byPath ?? []
  const cache = d.store?.cache
  const cacheHitPct = cache?.total ? Math.round((cache.hit / cache.total) * 100) : null

  return (
    <div className={s.body}>
      {/* 프로세스 상태 */}
      <div className={s.section}>
        <span className={s.h}>프로세스 상태 <span className={s.note}>(2초 폴링)</span></span>
        <div className={s.cards}>
          <div className={s.card}><div className={s.cardLabel}>Uptime</div><div className={s.cardValue}>{d.vitals ? hms(d.vitals.uptimeSec) : '—'}</div></div>
          <div className={s.card}><div className={s.cardLabel}>RSS</div><div className={s.cardValue}>{d.vitals ? mb(d.vitals.rss) : '—'}</div></div>
          <div className={s.card}><div className={s.cardLabel}>Heap</div><div className={s.cardValue}>{d.vitals ? `${mb(d.vitals.heapUsed)} / ${mb(d.vitals.heapTotal)}` : '—'}</div></div>
          {cacheHitPct != null && (
            <div className={s.card}><div className={s.cardLabel}>snapshot-meta 캐시</div><div className={s.cardValue}>{cacheHitPct}% hit <span className={s.note}>({cache.hit}/{cache.total})</span></div></div>
          )}
        </div>
      </div>

      {/* Phase 2: 엔드포인트 지연·응답크기 */}
      <div className={s.section}>
        <span className={s.h}>엔드포인트 지연·응답크기 <span className={s.note}>(테스트 인스턴스 자체 트래픽 · 크기 큰 순)</span></span>
        {byPath.length === 0 ? <span className={s.empty}>아직 요청 없음.</span> : (
          <Table size="small">
            <TableHeader><TableRow>
              <TableHeaderCell>경로</TableHeaderCell><TableHeaderCell>호출</TableHeaderCell>
              <TableHeaderCell>평균ms</TableHeaderCell><TableHeaderCell>최대ms</TableHeaderCell>
              <TableHeaderCell>평균크기</TableHeaderCell><TableHeaderCell>최대크기</TableHeaderCell>
            </TableRow></TableHeader>
            <TableBody>
              {byPath.slice(0, 20).map((r) => (
                <TableRow key={r.path}>
                  <TableCell className={s.mono}>{r.path}</TableCell>
                  <TableCell>{r.count}</TableCell>
                  <TableCell>{r.avgMs}</TableCell>
                  <TableCell>{r.maxMs}</TableCell>
                  <TableCell>{bytes(r.avgBytes)}</TableCell>
                  <TableCell className={r.maxBytes >= 1024 * 1024 ? s.big : undefined}>{bytes(r.maxBytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Phase 2: 수집기 타임라인 */}
      <div className={s.section}>
        <span className={s.h}>수집기 타임라인 <span className={s.note}>(cron off — 마지막 실제 수집 결과가 고정 표시)</span></span>
        {!d.proc?.recent?.length ? <span className={s.empty}>수집 기록 없음.</span> : (
          <Table size="small">
            <TableHeader><TableRow>
              <TableHeaderCell>타입</TableHeaderCell><TableHeaderCell>시각</TableHeaderCell>
              <TableHeaderCell>소요</TableHeaderCell><TableHeaderCell>결과</TableHeaderCell>
            </TableRow></TableHeader>
            <TableBody>
              {d.proc.recent.slice(0, 15).map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{hhmmss(r.time)}</TableCell>
                  <TableCell>{r.duration_ms == null ? '—' : `${r.duration_ms}ms`}</TableCell>
                  <TableCell><Badge appearance="filled" color={r.success ? 'success' : 'danger'}>{r.success ? 'OK' : 'FAIL'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Phase 2: store 상태 */}
      <div className={s.section}>
        <span className={s.h}>store 캐시 상태 <span className={s.note}>(타입별 아이템수·대략 크기)</span></span>
        {!d.store?.types?.length ? <span className={s.empty}>로딩…</span> : (
          <Table size="small">
            <TableHeader><TableRow>
              <TableHeaderCell>타입</TableHeaderCell><TableHeaderCell>아이템</TableHeaderCell><TableHeaderCell>크기</TableHeaderCell>
            </TableRow></TableHeader>
            <TableBody>
              {d.store.types.filter((t) => t.present).map((t) => (
                <TableRow key={t.type}>
                  <TableCell>{t.type}</TableCell>
                  <TableCell>{t.items ?? '—'}</TableCell>
                  <TableCell className={t.bytes >= 1024 * 1024 ? s.big : undefined}>{bytes(t.bytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 기본: 발생 알림 피드 */}
      <div className={s.section}>
        <span className={s.h}>발생 알림 피드 <span className={s.note}>(triggered_alerts · {feed.length}건)</span></span>
        {feed.length === 0 ? <span className={s.empty}>아직 알림 없음. 조작 탭에서 주입/발화하세요.</span> : (
          <Table size="small">
            <TableHeader><TableRow>
              <TableHeaderCell>시각</TableHeaderCell><TableHeaderCell>경로</TableHeaderCell>
              <TableHeaderCell>종류</TableHeaderCell><TableHeaderCell>심각도</TableHeaderCell><TableHeaderCell>변화</TableHeaderCell>
            </TableRow></TableHeader>
            <TableBody>
              {feed.slice(0, 30).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{hhmmss(a.detectedAt)}</TableCell>
                  <TableCell>{a.routeName ?? a.routeId}</TableCell>
                  <TableCell>{a.type}{a.target ? ` (${a.target})` : ''}</TableCell>
                  <TableCell><Badge appearance="filled" color={SEV[a.severity] ?? 'subtle'}>{a.severity}</Badge></TableCell>
                  <TableCell className={s.mono}>{a.fromVal ?? '—'} → {a.toVal ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 기본: 데이터셋 해시 */}
      <div className={s.section}>
        <span className={s.h}>데이터셋 해시 <span className={s.note}>(snapshot-meta)</span></span>
        {!d.meta ? <span className={s.empty}>로딩…</span> : (
          <Table size="small">
            <TableHeader><TableRow><TableHeaderCell>데이터셋</TableHeaderCell><TableHeaderCell>해시/상태</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {Object.entries(d.meta).map(([k, v]) => (
                <TableRow key={k}><TableCell>{k}</TableCell><TableCell className={s.mono}>{short(v)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
