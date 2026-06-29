import { useEffect, useRef, useState } from 'react'
import {
  Badge, Button, Card, TabList, Tab,
  Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell,
  MessageBar, MessageBarBody, MessageBarTitle,
  Title3, Subtitle2, Body1, Caption1,
} from '../../shared/ui/fluent.js'
import VerticalProfileChart from './VerticalProfileChart.jsx'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'
import { formatBriefingTime } from './lib/briefingTime.js'
import { phenomenonKo } from '../../shared/weather/phenomenonKo.js'
import { useCrossSectionLayers, CrossSectionToggles } from './crossSectionLayers.jsx'
import './BriefingView.css'

const LEVEL_BADGE = { green: 'success', amber: 'warning', red: 'danger', gray: 'subtle' }
const CAT_COLOR = { VFR: '#166534', MVFR: '#1d4ed8', IFR: '#c0291f', LIFR: '#9d2c9d' }
const CAT_RANK = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 }
const SEG_RANK = { '약': 1, '중': 2, '심': 3 }
const FIELDS = [['바람', 'wind'], ['시정', 'visibility'], ['운고', 'ceiling'], ['기온/노점', 'temp'], ['현상', 'weather'], ['QNH', 'qnh']]

const roleLabel = (r) => (r === 'departure' ? '출발' : r === 'arrival' ? '도착' : '교체')
const worstAirport = (a) => (a ?? []).reduce((acc, x) => (!acc || (CAT_RANK[x.category] ?? -1) > (CAT_RANK[acc.category] ?? -1) ? x : acc), null)
const worstInterval = (iv) => (iv ?? []).reduce((acc, x) => (!acc || SEG_RANK[x.level] > SEG_RANK[acc.level] ? x : acc), null)

// 카테고리 배지(표준색) — Fluent 팔레트 밖이라 색만 inline.
function CatBadge({ category }) {
  return <Badge appearance="filled" style={{ backgroundColor: CAT_COLOR[category] || '#94a3b8', color: '#fff' }}>{category}</Badge>
}

export default function BriefingView({ briefing, verticalProfile = null, crossSection = null, advisories = [], onClose, onOpenProfile, onFocus }) {
  const isMobile = useIsMobile()
  const { tz } = useTimeZone()
  const containerRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [detent, setDetent] = useState('half')
  const [activeAirport, setActiveAirport] = useState(null)
  const [xsectionFull, setXsectionFull] = useState(false)
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
  const steps = briefing
    ? [
        { id: 'adverse', label: '① 위험' },
        { id: 'current', label: '② 현재' },
        ...(hasEnroute ? [{ id: 'enroute', label: '③ 노선' }] : []),
        { id: 'destination', label: '④ 목적지' },
      ]
    : []

  useEffect(() => {
    const scope = containerRef.current
    if (!scope) return undefined
    const els = [...scope.querySelectorAll('section[data-bvid]')]
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
  const airports = sections.current.airports
  const activeAirportObj = airports.find((a) => a.role === activeAirport) ?? airports[0]

  const etdEtaLine = (meta.etd || meta.eta)
    ? `ETD ${formatBriefingTime(meta.etd, tz)} → ETA ${formatBriefingTime(meta.eta, tz, { withDate: (meta.eta || '').slice(0, 10) !== (meta.etd || '').slice(0, 10) })}`
    : null

  const jumpTo = (id) => {
    setActiveId(id)
    containerRef.current?.querySelector(`section[data-bvid="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  const adverse = (
    <section data-bvid="adverse" className="bv-section">
      <Card>
        <Subtitle2 as="h3">① 위험 요약</Subtitle2>
        {sections.adverse.hazards.length === 0
          ? <Body1 style={{ color: 'var(--text-3)' }}>경로·시간에 걸린 위험기상 없음</Body1>
          : sections.adverse.hazards.map((h, i) => (
              <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Badge appearance="tint" color={h.encounter === 'on' ? 'danger' : 'warning'}>
                  {h.encounter === 'on' ? '조우' : '주변'}{h.verticalKnown === false ? '?' : ''}
                </Badge>
                <Body1>
                  <b>{h.source}</b> {phenomenonKo(h.code) || h.label}
                  {phenomenonKo(h.code) && h.code ? <Caption1 style={{ color: 'var(--text-3)' }}> ({h.code})</Caption1> : null}
                  {h.bandFt ? ` ${h.bandFt.lowFt}–${h.bandFt.highFt}ft` : ''}{' '}
                  <Caption1 style={{ color: 'var(--text-3)' }}>({formatBriefingTime(h.validFrom, tz, { withDate: true })}~{formatBriefingTime(h.validTo, tz, { withDate: true })})</Caption1>
                </Body1>
              </div>
            ))}
      </Card>
    </section>
  )

  const airportTable = (a) => (
    <Table size="small" style={{ width: '100%' }}>
      <TableHeader><TableRow>{FIELDS.map(([l]) => <TableHeaderCell key={l}>{l}</TableHeaderCell>)}</TableRow></TableHeader>
      <TableBody><TableRow>
        {FIELDS.map(([, k]) => {
          const f = a.fields[k]
          return <TableCell key={k} style={{ fontVariantNumeric: 'tabular-nums', color: f?.flag ? 'var(--level-red)' : undefined, fontWeight: f?.flag ? 700 : undefined }}>{f?.text ?? '-'}</TableCell>
        })}
      </TableRow></TableBody>
    </Table>
  )

  const currentDesktop = (
    <section data-bvid="current" className="bv-section">
      <Card>
        <Subtitle2 as="h3">② 현재 실황</Subtitle2>
        {airports.map((a) => (
          <div key={a.role} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Body1><b>{a.icao}</b> <Caption1 style={{ color: 'var(--text-3)' }}>{roleLabel(a.role)}</Caption1></Body1>
              <CatBadge category={a.category} />
            </div>
            {airportTable(a)}
          </div>
        ))}
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
        <Subtitle2 as="h3">③ 노선·공역</Subtitle2>
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
      </Card>
    </section>
  )

  const destination = (
    <section data-bvid="destination" className="bv-section">
      <Card>
        <Subtitle2 as="h3">④ 목적지 예보</Subtitle2>
        {sections.destination.taf
          ? <Body1><b>ETA {formatBriefingTime(meta.eta, tz)} 기준 예보</b> · {sections.destination.taf.clouds} · {sections.destination.taf.category}</Body1>
          : <Body1 style={{ color: 'var(--text-3)' }}>TAF 없음</Body1>}
        {sections.destination.alternateRequired === true && (
          <MessageBar intent="warning"><MessageBarBody><MessageBarTitle>교체공항 필요</MessageBarTitle> {sections.destination.alternateReason}</MessageBarBody></MessageBar>
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
            {nav}{board}{adverse}{currentMobile}{enroute}{destination}
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
      {nav}{board}{adverse}{currentDesktop}{enroute}{destination}
    </div>
  )
}
