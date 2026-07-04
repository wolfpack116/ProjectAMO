import { Fragment, useEffect, useRef, useState } from 'react'
import { Layers, CloudLightning, Waves, Snowflake, Wind, AlertTriangle } from 'lucide-react'
import {
  Badge, Button, Card, TabList, Tab,
  Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell,
  MessageBar, MessageBarBody, MessageBarTitle,
  Title3, Subtitle2, Body1, Caption1,
} from '../../shared/ui/fluent.js'
import VerticalProfileChart from './VerticalProfileChart.jsx'
import BriefingBanner from './BriefingBanner.jsx'
import BriefingSynopsis from './BriefingSynopsis.jsx'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'
import { formatBriefingTime } from './lib/briefingTime.js'
import { hazardMapLayers } from './lib/hazardLayers.js'
import LayerToggleChips from '../map/LayerToggleChips.jsx'
import { metLabel } from '../map/layerActions.js'
import { phenomenonKo } from '../../shared/weather/phenomenonKo.js'
import { buildAmosConsoleModel } from '../../shared/weather/amosViewModel.js'
import { useCrossSectionLayers, CrossSectionToggles } from './crossSectionLayers.jsx'
import { buildRawWindsTable } from './lib/rawWindsModel.js'
import { deriveTimeState, formatAltitude, notamSummary, NOTAM_CATEGORIES, TIME_STATE } from '../notam/lib/notamViewModel.js'
import './BriefingView.css'

const LEVEL_BADGE = { green: 'success', amber: 'warning', red: 'danger', gray: 'subtle' }
// 색 = 심각도(level): VFR/MVFR=green(양호) / IFR=amber(주의) / LIFR=red(경고). 카테고리 고정색 폐기.
const LEVEL_COLOR = { green: 'var(--level-green)', amber: 'var(--level-amber)', red: 'var(--level-red)', gray: '#94a3b8' }
const catLevel = (c) => (c === 'VFR' || c === 'MVFR' ? 'green' : c === 'IFR' ? 'amber' : c === 'LIFR' ? 'red' : 'gray')
const catColorOf = (c) => LEVEL_COLOR[catLevel(c)]
const CAT_RANK = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 }
const SEG_RANK = { '약': 1, '중': 2, '심': 3 }
const FIELDS = [['바람', 'wind'], ['시정', 'visibility'], ['운고', 'ceiling'], ['기온/노점', 'temp'], ['현상', 'weather'], ['QNH', 'qnh']]
const NOTAM_CAT_LABEL = Object.fromEntries(NOTAM_CATEGORIES.map((c) => [c.id, c.label]))
// 시간상태 색(색의 유일한 축). 안전값(고도·요약)은 --text-2 이상, 흐린 색 금지(spec 접근성 #2).
const TS_COLOR = { active: 'var(--level-red)', soon: 'var(--level-amber)', upcoming: 'var(--text-3)' }

// 위험현상 code → 아이콘 (substring 매칭, 코드 변종에 견고).
function hazardIcon(code) {
  const c = String(code || '').toUpperCase()
  if (c.includes('ICE')) return Snowflake
  if (c.includes('TURB')) return Waves
  if (c.includes('TS')) return CloudLightning
  if (c.includes('WS') || c.includes('SHEAR') || c.includes('WIND')) return Wind
  return AlertTriangle
}

const roleLabel = (r) => (r === 'departure' ? '출발' : r === 'arrival' ? '도착' : '교체')
const worstAirport = (a) => (a ?? []).reduce((acc, x) => (!acc || (CAT_RANK[x.category] ?? -1) > (CAT_RANK[acc.category] ?? -1) ? x : acc), null)
const worstInterval = (iv) => (iv ?? []).reduce((acc, x) => (!acc || SEG_RANK[x.level] > SEG_RANK[acc.level] ? x : acc), null)

// ⑥ 목적지 카테고리 타임라인 막대 — 시간대별 최악 범주(결정론 단일 막대).
const pctOf = (iso, s, span) => ((Date.parse(iso) - s) / span) * 100
function tafBarSegments(timeline, validity) {
  const s = Date.parse(validity?.start)
  const e = Date.parse(validity?.end)
  if (!timeline?.length || !Number.isFinite(s) || !Number.isFinite(e) || e <= s) return []
  const span = e - s
  const segs = []
  for (const entry of timeline) {
    const color = catColorOf(entry.category)
    const left = Math.max(0, Math.min(100, pctOf(entry.time, s, span)))
    if (segs.length && segs[segs.length - 1].color === color) continue
    segs.push({ color, left })
  }
  return segs.map((sg, i) => ({ ...sg, width: (i < segs.length - 1 ? segs[i + 1].left : 100) - sg.left }))
}

// 표시용 3레벨 fold (배너·②·⑥ 일관): MVFR→VFR(마진 VFR은 VFR로).
const catDisplay = (c) => (c === 'MVFR' ? 'VFR' : c)

// 카테고리 배지 — 라벨은 3단계 fold, 색은 심각도(level). MVFR="VFR"(green), IFR=amber, LIFR=red.
function CatBadge({ category }) {
  const c = catDisplay(category)
  return <Badge appearance="filled" style={{ backgroundColor: catColorOf(category), color: '#fff' }}>{c}</Badge>
}

export default function BriefingView({ briefing, verticalProfile = null, crossSection = null, advisories = [], onClose, onOpenProfile, onFocus, metVisibility, onToggleMetLayer, onEnterMapMode }) {
  const isMobile = useIsMobile()
  const { tz } = useTimeZone()
  const containerRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [detent, setDetent] = useState('half')
  const [activeAirport, setActiveAirport] = useState(null)
  const [xsectionFull, setXsectionFull] = useState(false)
  const [showLayerChips, setShowLayerChips] = useState(false)
  const [expandedRoles, setExpandedRoles] = useState({}) // ② 현재 행 펼침(도착=AMOS, 출발=이륙예보)
  const toggleRole = (role) => setExpandedRoles((m) => ({ ...m, [role]: !m[role] }))
  // 인라인 단면도 레이어 토글 — 해당 현상이 있으면 그 레이어를 기본 ON.
  // 현상 출처: SIGMET/AIRMET 위험기상 + enroute 모델(KTG 난류·KIM 착빙) 둘 다.
  const hazardCodes = (briefing?.sections?.adverse?.hazards ?? []).map((h) => h.code)
  const modelKinds = new Set((briefing?.sections?.enroute?.model?.elements ?? []).map((e) => e.kind))
  const hazHas = (codes) => codes.some((c) => hazardCodes.includes(c))
  const [xLayers, toggleXLayer] = useCrossSectionLayers({
    temp: false, wind: false, moisture: false,
    icing: hazHas(['SEV_ICE', 'MOD_ICE']) || modelKinds.has('icing'),
    turbulence: hazHas(['SEV_TURB', 'MOD_TURB']) || modelKinds.has('turbulence'),
    advisories: hazardCodes.length > 0,
  })
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  useEffect(() => { if (activeId) onFocusRef.current?.(activeId) }, [activeId])

  const hasEnroute = Boolean(briefing?.sections?.enroute)
  const hasNotam = (briefing?.routeNotams ?? []).length > 0
  const destNum = hasNotam ? '⑥' : '⑤' // NOTAM(⑤)이 노선과 목적지 사이에 들어오면 목적지는 ⑥
  const steps = briefing
    ? [
        { id: 'banner', label: 'Go/No-go' },
        { id: 'adverse', label: '① 위험' },
        { id: 'current', label: '② 현재' },
        { id: 'synopsis', label: '③ 개황' },
        ...(hasEnroute ? [{ id: 'enroute', label: '④ 노선' }] : []),
        ...(hasNotam ? [{ id: 'notam', label: '⑤ NOTAM' }] : []),
        { id: 'destination', label: `${destNum} 목적지` },
      ]
    : []

  useEffect(() => {
    const scope = containerRef.current
    if (!scope) return undefined
    const els = [...scope.querySelectorAll('[data-bvid]')]
    if (els.length === 0) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveId(visible[0].target.dataset.bvid)
    }, { root: isMobile ? null : scope, rootMargin: isMobile ? '-8% 0px -60% 0px' : '-12% 0px -68% 0px', threshold: 0 })
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [briefing, isMobile])

  if (!briefing) return null
  const { meta, summary, sections } = briefing
  const mapLayerIds = hazardMapLayers(briefing) // 위험현상 → 켤 지도 레이어 id
  const rawWinds = buildRawWindsTable(crossSection, verticalProfile) // ④ 상층바람 원자료 표
  const airports = sections.current.airports
  const activeAirportObj = airports.find((a) => a.role === activeAirport) ?? airports[0]

  const etdEtaLine = (meta.etd || meta.eta)
    ? `ETD ${formatBriefingTime(meta.etd, tz)} → ETA ${formatBriefingTime(meta.eta, tz, { withDate: (meta.eta || '').slice(0, 10) !== (meta.etd || '').slice(0, 10) })}`
    : null

  const jumpTo = (id) => {
    setActiveId(id)
    containerRef.current?.querySelector(`[data-bvid="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const nav = (
    <div className="bv-navwrap">
      <TabList selectedValue={activeId} onTabSelect={(_, d) => jumpTo(d.value)} size="small">
        {steps.map((s) => <Tab key={s.id} value={s.id}>{s.label}</Tab>)}
      </TabList>
    </div>
  )

  const board = (
    <div className="bv-board">
      {summary.map((s) => <Badge key={s.key} appearance="tint" color={LEVEL_BADGE[s.level] || 'subtle'}>{s.label}</Badge>)}
    </div>
  )

  // 경로상 위험과 연관된 지도 레이어 토글칩(위험 있을 때만). 버튼 → 지도 모드 + 칩 펼침(우측 간격).
  const layerChips = mapLayerIds.map((id) => ({
    key: id, label: metLabel(id),
    on: !!metVisibility?.[id], onToggle: () => onToggleMetLayer?.(id),
  }))
  const layerAction = mapLayerIds.length > 0 && onToggleMetLayer ? (
    <div className="bv-layer-action">
      <Button appearance="primary" size="small" icon={<Layers size={16} />}
        onClick={() => { if (!showLayerChips) onEnterMapMode?.(); setShowLayerChips((v) => !v) }}>
        지도에 관련 레이어 보기
      </Button>
      {showLayerChips && <LayerToggleChips items={layerChips} ariaLabel="관련 지도 레이어" />}
    </div>
  ) : null

  const hazards = sections.adverse.hazards
  const hazardRow = (h, i) => {
    const Icon = hazardIcon(h.code)
    const nm = h.routeIntervalNm
    // 경로위험 = NM 구간, 공항경보 = "RKPC 도착"(scope 있고 NM 없음).
    const locText = h.airportScope
      ? `${h.airportScope} ${roleLabel(h.role) || ''}`.trim()
      : nm ? `${nm.startNm}–${nm.endNm}NM` : null
    const timeText = `${formatBriefingTime(h.validFrom, tz, { withDate: true })}~${formatBriefingTime(h.validTo, tz, { withDate: true })}`
    return (
      <div key={i} className="bv-haz-row" style={{ borderLeftColor: h.level === 'red' ? 'var(--level-red)' : 'var(--level-amber)' }}>
        <Badge appearance={h.encounter === 'on' ? 'filled' : 'tint'} color={h.level === 'red' ? 'danger' : 'warning'} className="bv-haz-enc">
          {h.encounter === 'on' ? '조우' : h.airportScope ? roleLabel(h.role) : '주변'}{h.verticalKnown === false ? '?' : ''}
        </Badge>
        <div className="bv-haz-main">
          <div className="bv-haz-line1">
            <Icon size={16} className="bv-haz-icon" aria-hidden />
            <span>{phenomenonKo(h.code) || h.label}</span>
            {h.code ? <span className="bv-haz-code">{h.code}</span> : null}
            {/* 밴드는 경로위험만 — 공항경보는 고도밴드 개념 없음 */}
            {!h.airportScope && (
              <>
                {' · '}
                {h.bandFt ? <span className="tnum">{h.bandFt.lowFt}–{h.bandFt.highFt}ft</span>
                  : <Badge appearance="tint" color="warning" className="bv-haz-band-unk">밴드 미상</Badge>}
              </>
            )}
          </div>
          <Caption1 className="bv-haz-line2">
            <b>{h.source}</b>{locText ? ` · ${locText}` : ''} · <span className="tnum">{timeText}</span>
          </Caption1>
        </div>
      </div>
    )
  }

  const adverse = (
    <section data-bvid="adverse" className="bv-section">
      <Card>
        <div className="bv-haz-head">
          <Subtitle2 as="h3">① 위험 요약</Subtitle2>
          {hazards.length > 0 && <Caption1 style={{ color: 'var(--text-3)' }}>{hazards.length}건 · 심각도순</Caption1>}
        </div>
        {hazards.length === 0
          ? <Body1 style={{ color: 'var(--text-3)' }}>경로·시간에 걸린 위험기상 없음</Body1>
          : hazards.map(hazardRow)}
      </Card>
    </section>
  )

  const MATRIX_COLS =[['바람', 'wind'], ['시정', 'visibility'], ['운고', 'ceiling'], ['기온/이슬점', 'temp'], ['현상', 'weather'], ['QNH', 'qnh']]
  const cellStyle = (f) => ({ fontVariantNumeric: 'tabular-nums', color: f?.flag ? 'var(--level-red)' : undefined, fontWeight: f?.flag ? 700 : undefined })
  const windCell = (f) => (
    <span style={cellStyle(f)}>{f?.text ?? '-'}{f?.gust ? <span className="bv-gust"> G{f.gust}</span> : null}</span>
  )

  // ② 행 확장 = 이륙예보(출발) + AMOS 지상실황(있으면 전부) + 원문 METAR.
  const takeoffBlock = (a) => {
    const fc = a.takeoffFcst?.forecasts ?? []
    if (fc.length === 0) {
      return (
        <div className="bv-amos">
          <div className="bv-amos-head"><b>이륙예보 ({a.icao})</b><Caption1 style={{ color: 'var(--text-3)' }}>발표 없음</Caption1></div>
          <Caption1 style={{ color: 'var(--text-3)' }}>ETD 전후 이륙예보(바람·기온·QNH)가 아직 없습니다.</Caption1>
        </div>
      )
    }
    const etdMs = Date.parse(meta.etd)
    let etdIdx = -1
    let best = Infinity
    fc.forEach((f, i) => { const d = Math.abs(Date.parse(f.time) - etdMs); if (Number.isFinite(d) && d < best) { best = d; etdIdx = i } })
    const fmtW = (f) => (Number.isFinite(f.windDir) && Number.isFinite(f.windSpeedKt)
      ? `${String(f.windDir).padStart(3, '0')}/${String(f.windSpeedKt).padStart(2, '0')}kt` : '-')
    return (
      <div className="bv-amos">
        <div className="bv-amos-head"><b>이륙예보 ({a.icao})</b><Caption1 style={{ color: 'var(--text-3)' }}>매시 · KMA (이륙 성능용)</Caption1></div>
        <table className="bv-takeoff">
          <thead><tr><th>시각</th><th>풍향/풍속</th><th>기온</th><th>QNH</th></tr></thead>
          <tbody>
            {fc.map((f, i) => (
              <tr key={f.tmFc} className={i === etdIdx ? 'bv-dest-row-hl' : undefined}>
                <td>{formatBriefingTime(f.time, tz)}{i === etdIdx ? <b style={{ color: 'var(--accent)' }}> ◀ETD</b> : ''}</td>
                <td>{fmtW(f)}</td>
                <td>{f.tempC != null ? `${f.tempC}℃` : '-'}</td>
                <td>{f.qnhHpa ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  const amosBlock = (a) => {
    if (!a.amos) return null
    const m = buildAmosConsoleModel(a.amos, null, { icao: a.icao }, tz)
    return (
      <div className="bv-amos">
        <div className="bv-amos-head"><b>AMOS 지상실황</b><Caption1 style={{ color: 'var(--text-3)' }}>{m.observedTimeLabel}</Caption1></div>
        <div className="bv-amos-grid">
          {m.prioritySummary.map((s) => <div key={s.key}><span className="mut">{s.label}</span><b>{s.value}</b></div>)}
          {m.visibilityRows.map((v) => <div key={v.label}><span className="mut">{v.label}</span><span className={v.isRvrGood ? undefined : 'red'}>{v.rvrValue} / {v.morValue}</span></div>)}
          {m.commonCells.filter((c) => c.label !== 'QNH(inHg)').map((c) => <div key={c.label}><span className="mut">{c.label}</span><span>{c.value}</span></div>)}
        </div>
      </div>
    )
  }
  const amosExpansion = (a) => {
    const takeoff = a.role === 'departure' ? takeoffBlock(a) : null
    const amos = amosBlock(a)
    const raw = a.raw ? <div className="bv-amos-raw">{a.raw}</div> : null
    if (!takeoff && !amos && !raw) return <Caption1 style={{ color: 'var(--text-3)' }}>추가 정보 없음</Caption1>
    return <div className="bv-expand-stack">{takeoff}{amos}{raw}</div>
  }

  // ② 현재 실황 — 공항=행 비교 매트릭스 (범주 리딩 열, 관측시각+SPECI, 행 펼치기).
  const currentDesktop = (
    <section data-bvid="current" className="bv-section">
      <Card>
        <Subtitle2 as="h3">② 현재 실황</Subtitle2>
        <table className="bv-current-matrix">
          <thead><tr>
            <th>공항</th><th>범주</th>
            {MATRIX_COLS.map(([l]) => <th key={l}>{l}</th>)}
            <th aria-label="펼치기" />
          </tr></thead>
          <tbody>
            {airports.map((a) => {
              const open = !!expandedRoles[a.role]
              return (
                <Fragment key={a.role}>
                  <tr className="bv-cur-row" onClick={() => toggleRole(a.role)}>
                    <td>
                      <div className="bv-cur-airport">
                        <span className="bv-cur-role"><Badge appearance="tint" color="informative">{roleLabel(a.role)}</Badge> <b>{a.icao}</b></span>
                        {a.observationTime && (
                          <Caption1 style={{ color: 'var(--text-3)' }}>
                            {formatBriefingTime(a.observationTime, tz)}
                            {a.reportType === 'SPECI' ? <Badge appearance="tint" color="warning" className="bv-speci">SPECI</Badge> : null}
                          </Caption1>
                        )}
                      </div>
                    </td>
                    <td><CatBadge category={a.category} /></td>
                    {MATRIX_COLS.map(([, k]) => (
                      <td key={k} style={k === 'wind' ? undefined : cellStyle(a.fields[k])}>
                        {k === 'wind' ? windCell(a.fields[k]) : (a.fields[k]?.text ?? '-')}
                      </td>
                    ))}
                    <td className="bv-cur-caret">{open ? '▾' : '▸'}</td>
                  </tr>
                  {open && <tr className="bv-cur-expand"><td colSpan={MATRIX_COLS.length + 3}>{amosExpansion(a)}</td></tr>}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Card>
    </section>
  )

  const currentMobile = (
    <section data-bvid="current" className="bv-section">
      <Card>
        <Subtitle2 as="h3">② 현재 실황</Subtitle2>
        <TabList selectedValue={activeAirportObj?.role} onTabSelect={(_, d) => setActiveAirport(d.value)} size="small">
          {airports.map((a) => <Tab key={a.role} value={a.role}>{a.icao}</Tab>)}
        </TabList>
        {activeAirportObj && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 4px' }}>
              <Body1><b>{activeAirportObj.icao}</b> <Caption1 style={{ color: 'var(--text-3)' }}>{roleLabel(activeAirportObj.role)}</Caption1></Body1>
              <CatBadge category={activeAirportObj.category} />
            </div>
            <Table size="small" style={{ width: '100%' }}>
              <TableBody>
                {FIELDS.map(([label, key]) => {
                  const f = activeAirportObj.fields[key]
                  return (
                    <TableRow key={key}>
                      <TableCell><Caption1 style={{ color: 'var(--text-3)' }}>{label}</Caption1></TableCell>
                      <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: f?.flag ? 'var(--level-red)' : undefined, fontWeight: 700 }}>{f?.text ?? '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </Card>
    </section>
  )

  const enroute = sections.enroute && (
    <section data-bvid="enroute" className="bv-section">
      <Card>
        <Subtitle2 as="h3">④ 노선·공역</Subtitle2>
        <Body1>계획고도 <b style={{ fontVariantNumeric: 'tabular-nums' }}>{sections.enroute.plannedCruiseAltitudeFt}ft</b></Body1>
        {sections.enroute.encounters.length === 0
          ? <Body1 style={{ color: 'var(--text-3)' }}>계획고도에서 조우하는 위험 없음</Body1>
          : sections.enroute.encounters.map((h, i) => (
              <Body1 key={i}>
                <b>{phenomenonKo(h.code) || h.label}</b>
                {phenomenonKo(h.code) && h.code ? <Caption1 style={{ color: 'var(--text-3)' }}> ({h.code})</Caption1> : null}
                {h.bandFt ? ` ${h.bandFt.lowFt}–${h.bandFt.highFt}ft` : ''} · {h.routeIntervalNm.startNm}–{h.routeIntervalNm.endNm}NM
              </Body1>
            ))}
        {sections.enroute.model?.elements?.length > 0 && (
          <div className="bv-ribbon-legend" aria-label="난기류 강도 범례">
            <span><i style={{ background: 'var(--turb-mod)' }} />중(MOD)</span>
            <span><i style={{ background: 'var(--level-red)' }} />심(SEV)</span>
          </div>
        )}
        {sections.enroute.model?.elements?.length > 0 && (
          <div className="bv-ribbons">
            {sections.enroute.model.elements.map((el, i) => {
              const total = sections.enroute.model.totalDistanceNm || 1
              const worst = worstInterval(el.intervals)
              return (
                <div key={i} className="bv-ribbon-row">
                  <div className="bv-ribbon-head">
                    <span className="bv-ribbon-label">{el.label}</span>
                    {worst && <span className="bv-ribbon-cap">{worst.level} {worst.startNm}–{worst.endNm}NM</span>}
                  </div>
                  <div className="bv-ribbon">
                    {el.intervals.map((iv, j) => (
                      <span key={j} className={`bv-seg ${iv.level === '심' ? 'sev' : 'mod'}`}
                        style={{ left: `${Math.max(0, (iv.startNm / total) * 100)}%`, width: `${Math.max(1.5, ((iv.endNm - iv.startNm) / total) * 100)}%` }}
                        title={`${iv.level} ${iv.startNm}–${iv.endNm}NM`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {verticalProfile && (
          <>
            <CrossSectionToggles layers={xLayers} onToggle={toggleXLayer} />
            <div className={`bv-xsection${isMobile ? ' bv-xsection-scroll' : ''}`}>
              <VerticalProfileChart profile={verticalProfile} crossSection={crossSection} layers={xLayers} advisories={advisories} />
            </div>
          </>
        )}
        {sections.enroute.crossSectionAvailable && (isMobile ? verticalProfile : onOpenProfile) && (
          <Button appearance="secondary" size="small" onClick={isMobile ? () => setXsectionFull(true) : onOpenProfile}>단면도 크게 열기</Button>
        )}
        {rawWinds && (
          <details className="bv-rawwinds">
            <summary>상층바람·기온 원자료 <span className="dim">(격자·층별)</span></summary>
            <div className="bv-rawwinds-scroll">
              <Table size="extra-small" className="bv-rawwinds-table">
                <TableHeader><TableRow>
                  <TableHeaderCell>고도</TableHeaderCell>
                  {rawWinds.columns.map((c) => <TableHeaderCell key={`${c.label}-${c.distanceNm}`}>{c.label}</TableHeaderCell>)}
                </TableRow></TableHeader>
                <TableBody>
                  {rawWinds.rows.map((r) => (
                    <TableRow key={r.fl}>
                      <TableCell style={{ color: 'var(--text-3)' }}>{r.fl}</TableCell>
                      {r.cells.map((cell, ci) => (
                        <TableCell key={ci} className={cell.highlight ? 'bv-rw-hl' : undefined}>
                          {cell.wind}{cell.temp != null ? <span className="bv-rw-temp"> {cell.temp}</span> : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Caption1 className="bv-rawwinds-cap"><span className="bv-rw-swatch" /> 실제 비행경로 고도(연직 프로파일) · KIM NWP</Caption1>
          </details>
        )}
      </Card>
    </section>
  )

  const routeNotams = briefing.routeNotams ?? []
  const routeConflicts = briefing.routeConflicts ?? []
  // 분류: 공항 소속(출/도착/교체) 우선 → 나머지 순수 경로상. 도착공항 NOTAM이 경로 끝과 겹쳐도
  // "경로상"이 아니라 "도착 공항"으로 가야 보는 사람이 헷갈리지 않는다(공항 매칭 우선).
  const notamAirportGroups = ['departure', 'arrival', 'alternate']
    .map((role) => {
      const items = routeNotams.filter((n) => n.airportRole === role)
      return items.length ? { role, icao: items[0].airportIcao, items } : null
    })
    .filter(Boolean)
  const notamRouteGroup = routeNotams.filter((n) => n.onRoute && !n.airportRole) // 어느 공항에도 안 속한 순수 경로 통과
  const notamRow = (n, showNm) => {
    const ts = deriveTimeState(n.validFrom, n.validTo, Date.now())
    const t = TIME_STATE[ts]
    return (
      <div key={n.id} className="bv-notam-row" data-conflict={n.conflict ? 'true' : 'false'}>
        <Badge appearance={n.conflict ? 'filled' : 'tint'}
          style={n.conflict ? { backgroundColor: TS_COLOR[ts], color: '#fff' } : { color: TS_COLOR[ts] }}>
          {t.glyph} {NOTAM_CAT_LABEL[n.category] || n.category}
        </Badge>
        <div className="bv-notam-main">
          <div className="bv-notam-line1">
            {n.conflict ? <b style={{ color: 'var(--level-red)' }}>경로 저촉 · </b> : null}
            <span style={{ color: 'var(--text-2)' }}>{notamSummary(n) || n.summary || n.id}</span>
            <span className="bv-haz-code">{n.id}</span>
          </div>
          <Caption1 style={{ color: 'var(--text-2)' }}>
            {t.label} · {formatAltitude(n.altitude) || '고도 미상'}
            {showNm && n.routeIntervalNm ? <> · <span className="tnum">{n.routeIntervalNm.startNm}–{n.routeIntervalNm.endNm}NM</span></> : ''}
          </Caption1>
        </div>
      </div>
    )
  }
  const notamSection = routeNotams.length > 0 && (
    <section data-bvid="notam" className="bv-section">
      <Card>
        <div className="bv-haz-head">
          <Subtitle2 as="h3">⑤ 경로·공항 NOTAM</Subtitle2>
          <Caption1 style={{ color: 'var(--text-3)' }}>
            {routeNotams.length}건{routeConflicts.length ? ` · 저촉 ${routeConflicts.length}` : ''}
          </Caption1>
        </div>
        {onToggleMetLayer && (
          // 이 섹션 전용: 지도로 가서 경로에 걸린 NOTAM만 켠다(Task 6 경로전용 필터가 자동 적용).
          <Button appearance="secondary" size="small" icon={<Layers size={14} />} className="bv-notam-layerbtn"
            onClick={() => { onEnterMapMode?.(); if (!metVisibility?.notam) onToggleMetLayer('notam') }}>
            지도에 NOTAM 레이어 보기
          </Button>
        )}
        {notamRouteGroup.length > 0 && (
          <>
            <div className="bv-notam-grouphead">경로상 <span className="dim">{notamRouteGroup.length}</span></div>
            {notamRouteGroup.map((n) => notamRow(n, true))}
          </>
        )}
        {notamAirportGroups.map((g) => (
          <Fragment key={g.role}>
            <div className="bv-notam-grouphead">{roleLabel(g.role)} 공항 {g.icao} <span className="dim">{g.items.length}</span></div>
            {g.items.map((n) => notamRow(n, false))}
          </Fragment>
        ))}
      </Card>
    </section>
  )

  const dest = sections.destination
  const CAT3_LEGEND = [['VFR', 'green'], ['IFR', 'amber'], ['LIFR', 'red']]
  const catBar = (timeline, validity, eta, tall) => {
    const segs = tafBarSegments(timeline, validity)
    if (segs.length === 0) return null
    const etaLeft = validity?.start && validity?.end && eta
      ? Math.max(0, Math.min(100, pctOf(eta, Date.parse(validity.start), Date.parse(validity.end) - Date.parse(validity.start))))
      : null
    return (
      <div className={`bv-tafbar${tall ? ' bv-tafbar-tall' : ''}`}>
        {etaLeft != null && <span className="bv-tafbar-eta" style={{ left: `${etaLeft}%` }}><span className="bv-tafbar-eta-mark">▼ETA</span></span>}
        <div className="bv-tafbar-track">
          {segs.map((sg, i) => <span key={i} style={{ left: `${sg.left}%`, width: `${sg.width}%`, background: sg.color }} />)}
        </div>
      </div>
    )
  }
  const periodTypeLabel = (t) => (t === 'base' ? 'base' : t.replace('_', ' '))

  const destination = (
    <section data-bvid="destination" className="bv-section">
      <Card>
        <Subtitle2 as="h3">{destNum} 목적지 예보</Subtitle2>
        {!dest.taf ? <Body1 style={{ color: 'var(--text-3)' }}>TAF 없음</Body1> : (
          <>
            <div className="bv-dest-head">
              <CatBadge category={dest.category} />
              <b style={{ fontSize: 'var(--fs-400)' }}>{dest.icao}</b>
              <Caption1 style={{ color: 'var(--text-3)' }}>도착 · ETA {formatBriefingTime(meta.eta, tz)}</Caption1>
            </div>
            {catBar(dest.timeline, dest.validity, dest.eta, true)}
            <div className="bv-tafbar-legend">
              {CAT3_LEGEND.map(([label, k]) => <span key={k}><i style={{ background: LEVEL_COLOR[k] }} />{label}</span>)}
              <span className="dim">시간대별 최악 범주</span>
            </div>
            {dest.etaOutOfRange && (
              <MessageBar intent="warning"><MessageBarBody>도착(ETA)이 이 TAF 유효기간 밖입니다 — 표시된 TAF는 도착 시각을 포함하지 않습니다(최신 TAF 확인 필요).</MessageBarBody></MessageBar>
            )}
            {dest.periods.length > 0 && (
              <Table size="small" className="bv-dest-periods" style={{ width: '100%' }}>
                <TableHeader><TableRow>
                  <TableHeaderCell>범주</TableHeaderCell><TableHeaderCell>기간</TableHeaderCell>
                  <TableHeaderCell>바람</TableHeaderCell><TableHeaderCell>시정</TableHeaderCell>
                  <TableHeaderCell>운고</TableHeaderCell><TableHeaderCell>현상</TableHeaderCell>
                </TableRow></TableHeader>
                <TableBody>
                  {dest.periods.map((p, i) => {
                    const hl = p.etaActive === true // ETA 시점의 지속조건/TEMPO (백엔드 계산)
                    return (
                      <TableRow key={i} className={hl ? 'bv-dest-row-hl' : undefined}>
                        <TableCell><CatBadge category={p.category} /></TableCell>
                        <TableCell style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatBriefingTime(p.start, tz, { withDate: true })}~{formatBriefingTime(p.end, tz, { withDate: true })}
                          {' '}<b style={{ color: 'var(--accent)' }}>{p.type !== 'base' ? periodTypeLabel(p.type) : 'base'}</b>{hl ? ' ◀ETA' : ''}
                        </TableCell>
                        <TableCell className="tnum">{p.wind}</TableCell>
                        <TableCell className="tnum">{p.vis}</TableCell>
                        <TableCell className="tnum">{p.clouds}</TableCell>
                        <TableCell>{p.wx}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            {dest.raw && (
              <details className="bv-rawwinds bv-dest-raw">
                <summary>원문 TAF</summary>
                <pre className="bv-dest-raw-pre">{dest.raw}</pre>
              </details>
            )}
          </>
        )}
        {dest.alternateRequired === true && (
          <MessageBar intent="warning"><MessageBarBody><MessageBarTitle>교체공항 필요</MessageBarTitle> {dest.alternateReason}</MessageBarBody></MessageBar>
        )}
        {dest.alternate && (
          <div className="bv-dest-alt">
            <div className="bv-dest-head">
              {dest.alternate.category ? <CatBadge category={dest.alternate.category} /> : <Badge appearance="tint">정보 없음</Badge>}
              <b style={{ fontSize: 'var(--fs-400)' }}>{dest.alternate.icao}</b>
              <Caption1 style={{ color: 'var(--text-3)' }}>교체 · ETA {formatBriefingTime(meta.eta, tz)}</Caption1>
            </div>
            {dest.alternate.noTaf
              ? <Caption1 style={{ color: 'var(--text-3)' }}>TAF 없음 — 교체공항 예보 미확보</Caption1>
              : catBar(dest.alternate.timeline, dest.alternate.validity, dest.eta, false)}
          </div>
        )}
      </Card>
    </section>
  )

  if (isMobile) {
    const worst = worstAirport(airports)
    const peek = (
      <span className="bv-peek">
        <b>{meta.departureAirport} → {meta.arrivalAirport}</b>
        <Badge appearance="tint">{meta.flightRule}</Badge>
        {worst && <CatBadge category={worst.category} />}
      </span>
    )
    return (
      <>
        <MobileSheet open eyebrow="비행 전 브리핑" title={`${meta.departureAirport} → ${meta.arrivalAirport}`}
          headerExtra={<Badge appearance="tint">{meta.flightRule}</Badge>}
          onClose={onClose} detent={detent} onDetentChange={setDetent} peekContent={peek}>
          <div className="bv-mobile" ref={containerRef}>
            {etdEtaLine && <Caption1 style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{etdEtaLine}</Caption1>}
            <BriefingBanner banner={briefing.banner} routeConflicts={routeConflicts} />
            {nav}{board}{layerAction}{adverse}{currentMobile}<BriefingSynopsis />{enroute}{notamSection}{destination}
          </div>
        </MobileSheet>
        {xsectionFull && verticalProfile && (
          <div className="bv-xfull" role="dialog" aria-label="단면도 전체화면" onClick={() => setXsectionFull(false)}>
            <button type="button" className="bv-xfull-close" onClick={() => setXsectionFull(false)} aria-label="닫기">×</button>
            <div className="bv-xfull-rotate" onClick={(e) => e.stopPropagation()}>
              <VerticalProfileChart profile={verticalProfile} crossSection={crossSection} layers={{ icing: true, turbulence: true }} />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="briefing-view" ref={containerRef}>
      <div className="bv-header">
        <div>
          <Caption1 style={{ color: 'var(--text-3)' }}>비행 전 브리핑</Caption1>
          <Title3 as="h2" block>{meta.departureAirport} → {meta.arrivalAirport}</Title3>
          <Caption1 style={{ color: 'var(--text-3)', display: 'block' }}>{meta.alternateAirport ? `교체 ${meta.alternateAirport}` : '단일 목적지'}</Caption1>
          {etdEtaLine && <Caption1 style={{ color: 'var(--accent)', display: 'block', fontVariantNumeric: 'tabular-nums' }}>{etdEtaLine}</Caption1>}
        </div>
        <div className="bv-head-side">
          <Badge appearance="tint">{meta.flightRule}</Badge>
          <Button appearance="secondary" size="small" onClick={onClose}>지도로</Button>
        </div>
      </div>
      <BriefingBanner banner={briefing.banner} routeConflicts={routeConflicts} />
      {nav}{board}{layerAction}{adverse}{currentDesktop}<BriefingSynopsis />{enroute}{notamSection}{destination}
    </div>
  )
}
