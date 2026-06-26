import { useEffect, useRef, useState } from 'react'
import VerticalProfileChart from './VerticalProfileChart.jsx'
import './BriefingView.css'

const LEVEL_CLASS = { green: 'bv-green', amber: 'bv-amber', red: 'bv-red', gray: 'bv-gray' }
const CAT_CLASS = { VFR: 'bv-cat-vfr', MVFR: 'bv-cat-mvfr', IFR: 'bv-cat-ifr', LIFR: 'bv-cat-lifr' }
const SEG_RANK = { '약': 1, '중': 2, '심': 3 }

// 항공 표준 카테고리 색 어휘(VFR/MVFR/IFR/LIFR). 미지의 값은 level 색으로 폴백.
function catClass(category, level) {
  return CAT_CLASS[String(category ?? '').toUpperCase()] ?? LEVEL_CLASS[level] ?? ''
}

function worstInterval(intervals) {
  return (intervals ?? []).reduce((acc, iv) => (!acc || SEG_RANK[iv.level] > SEG_RANK[acc.level] ? iv : acc), null)
}

function Cell({ field }) {
  return <td className={field?.flag ? 'bv-flag' : ''}>{field?.text ?? '-'}</td>
}

export default function BriefingView({ briefing, verticalProfile = null, crossSection = null, onClose, onOpenProfile, onFocus }) {
  const containerRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
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

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined
    const els = [...root.querySelectorAll('section[data-bvid]')]
    if (els.length === 0) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveId(visible[0].target.dataset.bvid)
    }, { root, rootMargin: '-12% 0px -68% 0px', threshold: 0 })
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [briefing])

  if (!briefing) return null
  const { meta, summary, sections } = briefing

  const jumpTo = (id) => {
    setActiveId(id) // optimistic: scrollIntoView may land the section above the observer band
    containerRef.current?.querySelector(`section[data-bvid="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

      <nav className="bv-nav" aria-label="브리핑 순서">
        {steps.map((s) => (
          <button key={s.id} type="button" className={`bv-nav-step${activeId === s.id ? ' is-active' : ''}`} aria-current={activeId === s.id ? 'true' : undefined} onClick={() => jumpTo(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      <div className="bv-board">
        {summary.map((s) => (
          <span key={s.key} className={`bv-chip ${LEVEL_CLASS[s.level] || ''}`}>{s.label}</span>
        ))}
      </div>

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

      <section data-bvid="current" className="bv-section">
        <h3>③ 현재 실황</h3>
        {sections.current.airports.map((a) => (
          <div key={a.role} className={`bv-airport ${catClass(a.category, a.level)}`}>
            <div className="bv-airport-title">
              <span className="bv-airport-name">{a.icao}<span className="bv-airport-role">{a.role === 'departure' ? '출발공항' : a.role === 'arrival' ? '도착공항' : '교체공항'}</span></span>
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

      {sections.enroute && (
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
            <div className="bv-xsection">
              <VerticalProfileChart profile={verticalProfile} crossSection={crossSection} layers={{ icing: true, turbulence: true }} />
            </div>
          )}
          {sections.enroute.crossSectionAvailable && onOpenProfile && (
            <button type="button" className="bv-link-btn" onClick={onOpenProfile}>{'단면도 크게 열기'}</button>
          )}
        </section>
      )}

      <section data-bvid="destination" className={`bv-section ${LEVEL_CLASS[sections.destination.level]}`}>
        <h3>⑤ 목적지 예보</h3>
        {sections.destination.taf
          ? <p>{sections.destination.taf.time} · {sections.destination.taf.clouds} · {sections.destination.taf.category}</p>
          : <p className="bv-muted">TAF 없음</p>}
        {sections.destination.alternateRequired === true &&
          <p className="bv-flag-text">⚠️ 교체공항 필요 — {sections.destination.alternateReason}</p>}
      </section>
    </div>
  )
}
