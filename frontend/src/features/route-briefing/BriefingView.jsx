import './BriefingView.css'

const LEVEL_CLASS = { green: 'bv-green', amber: 'bv-amber', red: 'bv-red', gray: 'bv-gray' }

function Cell({ field }) {
  return <td className={field?.flag ? 'bv-flag' : ''}>{field?.text ?? '-'}</td>
}

export default function BriefingView({ briefing, onClose, onOpenProfile }) {
  if (!briefing) return null
  const { meta, summary, sections } = briefing
  return (
    <div className="briefing-view">
      <div className="bv-header">
        <div><b>{meta.departureAirport} → {meta.arrivalAirport}</b>{meta.alternateAirport ? ` (교체 ${meta.alternateAirport})` : ''} · {meta.flightRule}</div>
        <button type="button" onClick={onClose}>{'지도로'}</button>
      </div>
      <div className="bv-board">
        {summary.map((s) => (
          <span key={s.key} className={`bv-chip ${LEVEL_CLASS[s.level] || ''}`}>{s.label}</span>
        ))}
      </div>
      <section className={`bv-section ${LEVEL_CLASS[sections.adverse.level]}`}>
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
      <section className="bv-section">
        <h3>③ 현재 실황</h3>
        {sections.current.airports.map((a) => (
          <div key={a.role} className="bv-airport">
            <div className="bv-airport-title">
              {a.role === 'departure' ? '출발' : a.role === 'arrival' ? '도착' : '교체'}공항 · {a.icao}
              <span className={`bv-cat ${LEVEL_CLASS[a.level]}`}>{a.category}</span>
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
        <section className={`bv-section ${LEVEL_CLASS[sections.enroute.level]}`}>
          <h3>④ 노선·공역</h3>
          <p className="bv-muted">계획고도 {sections.enroute.plannedCruiseAltitudeFt}ft</p>
          {sections.enroute.encounters.length === 0
            ? <p className="bv-muted">계획고도에서 조우하는 위험 없음</p>
            : <ul>{sections.enroute.encounters.map((h, i) => (
                <li key={i}><b>{h.label}</b>{h.bandFt ? ` ${h.bandFt.lowFt}–${h.bandFt.highFt}ft` : ''} · {h.routeIntervalNm.startNm}–{h.routeIntervalNm.endNm}NM</li>
              ))}</ul>}
          {sections.enroute.crossSectionAvailable && onOpenProfile && (
            <button type="button" className="bv-link-btn" onClick={onOpenProfile}>{'단면도 열기'}</button>
          )}
        </section>
      )}
      <section className={`bv-section ${LEVEL_CLASS[sections.destination.level]}`}>
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
