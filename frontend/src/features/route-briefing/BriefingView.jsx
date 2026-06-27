import { useEffect, useRef, useState } from 'react'
import VerticalProfileChart from './VerticalProfileChart.jsx'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'
import './BriefingView.css'

const LEVEL_CLASS = { green: 'bv-green', amber: 'bv-amber', red: 'bv-red', gray: 'bv-gray' }
const CAT_CLASS = { VFR: 'bv-cat-vfr', MVFR: 'bv-cat-mvfr', IFR: 'bv-cat-ifr', LIFR: 'bv-cat-lifr' }
const CAT_COLOR = { VFR: '#15803d', MVFR: '#1d4ed8', IFR: '#c0291f', LIFR: '#9d2c9d' }
const CAT_RANK = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 }
const SEG_RANK = { '약': 1, '중': 2, '심': 3 }
const READOUT_FIELDS = [['바람', 'wind'], ['시정', 'visibility'], ['운고', 'ceiling'], ['기온/노점', 'temp'], ['현상', 'weather'], ['QNH', 'qnh']]

// 항공 표준 카테고리 색 어휘(VFR/MVFR/IFR/LIFR). 미지의 값은 level 색으로 폴백.
function catClass(category, level) {
  return CAT_CLASS[String(category ?? '').toUpperCase()] ?? LEVEL_CLASS[level] ?? ''
}

function roleLabel(role) {
  return role === 'departure' ? '출발공항' : role === 'arrival' ? '도착공항' : '교체공항'
}

function worstAirport(airports) {
  return (airports ?? []).reduce((acc, a) => (
    !acc || (CAT_RANK[a.category] ?? -1) > (CAT_RANK[acc.category] ?? -1) ? a : acc
  ), null)
}

function worstInterval(intervals) {
  return (intervals ?? []).reduce((acc, iv) => (!acc || SEG_RANK[iv.level] > SEG_RANK[acc.level] ? iv : acc), null)
}

function Cell({ field }) {
  return <td className={field?.flag ? 'bv-flag' : ''}>{field?.text ?? '-'}</td>
}

export default function BriefingView({ briefing, verticalProfile = null, crossSection = null, onClose, onOpenProfile, onFocus }) {
  const isMobile = useIsMobile()
  const containerRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [detent, setDetent] = useState('half')
  const [activeAirport, setActiveAirport] = useState(null)
  const [xsectionFull, setXsectionFull] = useState(false)
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  // scroll-sync: drive the live map to the active section's spatial target
  useEffect(() => {
    if (activeId) onFocusRef.current?.(activeId)
  }, [activeId])

  const hasEnroute = Boolean(briefing?.sections?.enroute)
  const steps = briefing
    ? [
        { id: 'adverse', label: '① 위험' },
        { id: 'current', label: '③ 현재' },
        ...(hasEnroute ? [{ id: 'enroute', label: '④ 노선' }] : []),
        { id: 'destination', label: '⑤ 목적지' },
      ]
    : []

  // scroll-spy: desktop observes within the panel; mobile observes the viewport
  // (the sheet body is the scroller, so the panel element is not a scroll root).
  useEffect(() => {
    const scope = containerRef.current
    if (!scope) return undefined
    const els = [...scope.querySelectorAll('section[data-bvid]')]
    if (els.length === 0) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveId(visible[0].target.dataset.bvid)
    }, {
      root: isMobile ? null : scope,
      rootMargin: isMobile ? '-8% 0px -60% 0px' : '-12% 0px -68% 0px',
      threshold: 0,
    })
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [briefing, isMobile])

  if (!briefing) return null
  const { meta, summary, sections } = briefing

  const jumpTo = (id) => {
    setActiveId(id) // optimistic: scrollIntoView may land the section above the observer band
    containerRef.current?.querySelector(`section[data-bvid="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const navEl = (
    <nav className="bv-nav" aria-label="브리핑 순서">
      {steps.map((s) => (
        <button key={s.id} type="button" className={`bv-nav-step${activeId === s.id ? ' is-active' : ''}`} aria-current={activeId === s.id ? 'true' : undefined} onClick={() => jumpTo(s.id)}>
          {s.label}
        </button>
      ))}
    </nav>
  )

  const boardEl = (
    <div className="bv-board">
      {summary.map((s) => (
        <span key={s.key} className={`bv-chip ${LEVEL_CLASS[s.level] || ''}`}>{s.label}</span>
      ))}
    </div>
  )

  const adverseSection = (
    <section data-bvid="adverse" className={`bv-section ${LEVEL_CLASS[sections.adverse.level]}`}>
      <h3>① 위험 요약</h3>
      {sections.adverse.hazards.length === 0
        ? <p className="bv-muted">경로·시간에 걸린 위험기상 없음</p>
        : <ul>{sections.adverse.hazards.map((h, i) => (
            <li key={i}>
              <span className={`bv-enc ${h.encounter === 'on' ? 'bv-red' : 'bv-amber'}`}>
                {h.encounter === 'on' ? '🔴 조우' : '🟡 주변'}{h.verticalKnown === false ? '?' : ''}
              </span>{' '}
              <b>{h.source}</b> {h.label}
              {h.bandFt ? <span className="bv-muted"> {h.bandFt.lowFt}–{h.bandFt.highFt}ft</span> : null}
              <span className="bv-muted"> ({h.validFrom}~{h.validTo})</span>
            </li>
          ))}</ul>}
    </section>
  )

  const airports = sections.current.airports
  const activeAirportObj = airports.find((a) => a.role === activeAirport) ?? airports[0]

  const currentDesktop = (
    <section data-bvid="current" className="bv-section">
      <h3>③ 현재 실황</h3>
      {airports.map((a) => (
        <div key={a.role} className={`bv-airport ${catClass(a.category, a.level)}`}>
          <div className="bv-airport-title">
            <span className="bv-airport-name">{a.icao}<span className="bv-airport-role">{roleLabel(a.role)}</span></span>
            <span className={`bv-cat ${catClass(a.category, a.level)}`}>{a.category}</span>
          </div>
          <table className="bv-table">
            <thead><tr><th>바람</th><th>시정</th><th>운고</th><th>기온/노점</th><th>현상</th><th>QNH</th></tr></thead>
            <tbody><tr>
              <Cell field={a.fields.wind} /><Cell field={a.fields.visibility} /><Cell field={a.fields.ceiling} />
              <Cell field={a.fields.temp} /><Cell field={a.fields.weather} /><Cell field={a.fields.qnh} />
            </tr></tbody>
          </table>
        </div>
      ))}
    </section>
  )

  const currentMobile = (
    <section data-bvid="current" className="bv-section">
      <h3>③ 현재 실황</h3>
      <div className="bv-airport-tabs" role="tablist">
        {airports.map((a) => (
          <button
            key={a.role}
            type="button"
            role="tab"
            aria-selected={activeAirportObj?.role === a.role}
            className={`bv-airport-tab${activeAirportObj?.role === a.role ? ' is-active' : ''}`}
            onClick={() => setActiveAirport(a.role)}
          >
            <span className="bv-tab-dot" style={{ background: CAT_COLOR[a.category] || '#94a3b8' }} aria-hidden="true" />
            {a.icao}
          </button>
        ))}
      </div>
      {activeAirportObj && (
        <div className={`bv-airport ${catClass(activeAirportObj.category, activeAirportObj.level)}`}>
          <div className="bv-airport-title">
            <span className="bv-airport-name">{activeAirportObj.icao}<span className="bv-airport-role">{roleLabel(activeAirportObj.role)}</span></span>
            <span className={`bv-cat ${catClass(activeAirportObj.category, activeAirportObj.level)}`}>{activeAirportObj.category}</span>
          </div>
          <div className="bv-readout">
            {READOUT_FIELDS.map(([label, key]) => {
              const f = activeAirportObj.fields[key]
              return (
                <div className="bv-readout-row" key={key}>
                  <span className="bv-readout-label">{label}</span>
                  <span className={`bv-readout-val${f?.flag ? ' bv-flag' : ''}`}>{f?.text ?? '-'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )

  const enrouteSection = sections.enroute && (
    <section data-bvid="enroute" className={`bv-section ${LEVEL_CLASS[sections.enroute.level]}`}>
      <h3>④ 노선·공역</h3>
      <p className="bv-plan">계획고도 <b>{sections.enroute.plannedCruiseAltitudeFt}ft</b></p>
      {sections.enroute.encounters.length === 0
        ? <p className="bv-muted">계획고도에서 조우하는 위험 없음</p>
        : <ul>{sections.enroute.encounters.map((h, i) => (
            <li key={i}><b>{h.label}</b>{h.bandFt ? ` ${h.bandFt.lowFt}–${h.bandFt.highFt}ft` : ''} · {h.routeIntervalNm.startNm}–{h.routeIntervalNm.endNm}NM</li>
          ))}</ul>}
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
                    <span key={j}
                      className={`bv-seg ${iv.level === '심' ? 'sev' : 'mod'}`}
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
        <div className={`bv-xsection${isMobile ? ' bv-xsection-scroll' : ''}`}>
          <VerticalProfileChart profile={verticalProfile} crossSection={crossSection} layers={{ icing: true, turbulence: true }} />
        </div>
      )}
      {sections.enroute.crossSectionAvailable && (isMobile ? verticalProfile : onOpenProfile) && (
        <button type="button" className="bv-link-btn" onClick={isMobile ? () => setXsectionFull(true) : onOpenProfile}>{'단면도 크게 열기'}</button>
      )}
    </section>
  )

  const destinationSection = (
    <section data-bvid="destination" className={`bv-section ${LEVEL_CLASS[sections.destination.level]}`}>
      <h3>⑤ 목적지 예보</h3>
      {sections.destination.taf
        ? <p>{sections.destination.taf.time} · {sections.destination.taf.clouds} · {sections.destination.taf.category}</p>
        : <p className="bv-muted">TAF 없음</p>}
      {sections.destination.alternateRequired === true &&
        <p className="bv-flag-text">⚠️ 교체공항 필요 — {sections.destination.alternateReason}</p>}
    </section>
  )

  if (isMobile) {
    const worst = worstAirport(airports)
    const peekSummary = (
      <span className="bv-peek">
        <b>{meta.departureAirport} → {meta.arrivalAirport}</b>
        <span className="bv-peek-rule">{meta.flightRule}</span>
        {worst && <span className={`bv-cat ${catClass(worst.category, worst.level)}`}>{worst.category}</span>}
      </span>
    )
    return (
      <>
        <MobileSheet
          open
          eyebrow="비행 전 브리핑"
          title={`${meta.departureAirport} → ${meta.arrivalAirport}`}
          headerExtra={<span className="bv-rule-chip">{meta.flightRule}</span>}
          onClose={onClose}
          detent={detent}
          onDetentChange={setDetent}
          peekContent={peekSummary}
        >
          <div className="bv-mobile" ref={containerRef}>
            {navEl}
            {boardEl}
            {adverseSection}
            {currentMobile}
            {enrouteSection}
            {destinationSection}
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
        <div className="bv-head-main">
          <div className="bv-eyebrow">비행 전 브리핑</div>
          <div className="bv-route"><b>{meta.departureAirport} → {meta.arrivalAirport}</b></div>
          <div className="bv-meta">{meta.alternateAirport ? `교체 ${meta.alternateAirport}` : '단일 목적지'}</div>
        </div>
        <div className="bv-head-side">
          <span className="bv-rule-chip">{meta.flightRule}</span>
          <button type="button" className="bv-map-btn" onClick={onClose}>{'지도로'}</button>
        </div>
      </div>
      {navEl}
      {boardEl}
      {adverseSection}
      {currentDesktop}
      {enrouteSection}
      {destinationSection}
    </div>
  )
}
