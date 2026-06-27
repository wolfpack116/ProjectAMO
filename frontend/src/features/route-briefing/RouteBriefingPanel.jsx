import { useState } from 'react'
import { KNOWN_AIRPORTS } from './lib/procedureData.js'
import { calcVfrDistance } from './lib/routePreview.js'
import {
  FIR_EXIT_AIRPORT,
  FIR_IN_AIRPORT,
  ROUTE_SEQUENCE_COLORS,
  buildIfrDistanceBreakdown,
  buildIfrSequenceTokens,
  getVfrAirportAltitudeFt,
} from './lib/routeBriefingModel.js'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'
import AirportPickerField from '../../shared/ui/AirportPickerField.jsx'
import PickerField from '../../shared/ui/PickerField.jsx'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'
import { computeEtaIso } from './lib/etaCalc.js'
import { formatBriefingTime } from './lib/briefingTime.js'
import EtdField from './EtdField.jsx'
import AircraftProfileField from './AircraftProfileField.jsx'
import './RouteBriefing.css'

const AIRPORT_KO = {
  RKSI: '인천', RKSS: '김포', RKPC: '제주', RKPK: '김해',
  RKJB: '무안', RKNY: '양양', RKJY: '여수', RKPU: '울산',
}
const AIRPORT_OPTIONS = KNOWN_AIRPORTS.map((icao) => ({ value: icao, ko: AIRPORT_KO[icao] ?? icao }))
const NONE_OPTION = { value: '', label: '-- 없음 --' }

export default function RouteBriefingPanel({ state, refs = {}, derived, actions, airports = [] }) {
  const isMobile = useIsMobile()
  const { tz } = useTimeZone()
  // The briefing stays an active task; the sheet × collapses to the peek summary
  // instead of closing (use the bottom task bar to leave 브리핑).
  const [sheetDetent, setSheetDetent] = useState('half')
  const [mobileStep, setMobileStep] = useState(1)
  const [showDetailRoute, setShowDetailRoute] = useState(false)
  const {
    routeForm,
    routeResult,
    routeError,
    routeLoading,
    cruiseAltitudeFt,
    verticalProfile,
    verticalProfileLoading,
    verticalProfileError,
    verticalProfileStale,
    editingVfrAltitudeIndex,
    vfrWaypoints,
    hoveredWpInfo,
    starOptions,
    selectedSid,
    selectedStar,
    iapCandidates,
    selectedIapKey,
    firInOptions,
    firExitOptions,
    alternateAirport,
    etd,
    cruiseSpeedKt,
    briefingLoading,
    briefingError,
  } = state
  const { hideTimerRef } = refs
  const { isFirInMode, isFirExitMode, selectedIap, visibleSidOptions } = derived
  const {
    updateRouteField,
    handleDepartureAirportChange,
    handleArrivalAirportChange,
    handleEntryFixChange,
    handleExitFixChange,
    switchFlightRule,
    handleAutoRecommend,
    handleSidChange,
    handleStarChange,
    handleIapChange,
    handleRouteReset,
    deleteVfrWaypoint,
    handleRouteSearch,
    updateVfrWaypointAltitude,
    applyCruiseAltitudeToVfrWaypoints,
    handleVerticalProfileRequest,
    setHoveredWpInfo,
    setEditingVfrAltitudeIndex,
    setVerticalProfileWindowOpen,
    setCruiseAltitudeFt,
    setAlternateAirport,
    setEtd,
    setCruiseSpeedKt,
    handleGenerateBriefing,
  } = actions

  const isIfr = routeForm.flightRule === 'IFR'

  // ETA is auto-computed read-only from ETD + planned distance + TAS.
  const etaIso = computeEtaIso(etd, derived.plannedDistanceNm, cruiseSpeedKt)
  const applyPerf = ({ tasKt, altitudeFt }) => { setCruiseSpeedKt(tasKt); setCruiseAltitudeFt(altitudeFt) }
  const summaryStrip = (
    <div className="rb-summary">
      <div className="rb-summary-dist"><span>거리</span><strong>{Math.round(derived.plannedDistanceNm)}<em>NM</em></strong></div>
      <div className="rb-summary-time"><span>ETD → ETA</span><strong>{formatBriefingTime(etd, tz)} → {etaIso ? formatBriefingTime(etaIso, tz) : '—'}</strong></div>
    </div>
  )
  // 내 항공기(속도·고도 직접입력) + ETD + 파생 요약. 데스크톱 섹션과 모바일 ③단계에서 공유.
  const perfTimeBlock = (
    <>
      <AircraftProfileField tasKt={cruiseSpeedKt} altitudeFt={Number(cruiseAltitudeFt) || 0} magCourseDeg={derived.magCourseDeg} onChange={applyPerf} />
      <div className="route-check-field">
        <div className="route-check-field-label">{`ETD (${tz})`}</div>
        <EtdField etd={etd} tz={tz} variant={isMobile ? 'mobile' : 'desktop'} onChange={setEtd} />
      </div>
      {summaryStrip}
    </>
  )

  function swapAirports() {
    const dep = routeForm.departureAirport
    const arr = routeForm.arrivalAirport
    handleDepartureAirportChange(arr)
    handleArrivalAirportChange(dep)
  }

  // Shared between the desktop panel and the mobile sheet.
  const errorBlock = routeError && <div className="route-check-error">{routeError}</div>

  const routePreview = routeResult && (
    <div className="route-check-result">
      {routeResult.flightRule === 'IFR' && (() => {
        const displayTokens = buildIfrSequenceTokens(routeResult, { selectedSid, selectedStar, selectedIap })
        const { totalDistanceNm, items: distanceBreakdown } = buildIfrDistanceBreakdown({
          routeResult,
          selectedSid,
          selectedStar,
          selectedIap,
        })
        const sequenceVisible = !isMobile || showDetailRoute

        return (
          <>
            <div className="route-check-total-dist">
              <div className="route-check-total-dist-head">
                <span>{'총 거리'} <strong>{totalDistanceNm} NM</strong></span>
                {isMobile && (
                  <button type="button" className="rb-detail-toggle" onClick={() => setShowDetailRoute((v) => !v)} aria-expanded={showDetailRoute}>
                    {'상세경로'}<span className="rb-detail-caret" aria-hidden="true">{showDetailRoute ? '▴' : '▾'}</span>
                  </button>
                )}
              </div>
              {distanceBreakdown.length > 0 && (
                <div className="dist-breakdown">
                  {distanceBreakdown.map((item) => (
                    <span key={`${item.kind}-${item.label}`} className={`dist-breakdown-token is-${item.kind}`}>
                      <span className="dist-breakdown-dot" style={{ background: ROUTE_SEQUENCE_COLORS[item.kind] }} aria-hidden="true" />
                      {`${item.label} ${item.value.toFixed(1)}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {sequenceVisible && (
              <div className="route-check-sequence">
                {displayTokens.map((token, index) => (
                  <span key={`${token.kind}-${token.text}-${index}`}>
                    {index > 0 && <span className="route-check-sequence-sep">{' -> '}</span>}
                    <span
                      className={`route-check-sequence-token is-${token.kind}`}
                      style={{ color: ROUTE_SEQUENCE_COLORS[token.kind] }}
                    >
                      {token.text}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </>
        )
      })()}
      {routeResult.flightRule === 'VFR' && vfrWaypoints.length >= 2 && (
        <>
          <div className="route-check-total-dist">
            {'총 거리'}: <strong>{calcVfrDistance(vfrWaypoints).toFixed(1)} NM</strong>
          </div>
          <div className="vfr-altitude-tools">
            <span>{'VFR WP 계획고도'}</span>
            <button type="button" onClick={applyCruiseAltitudeToVfrWaypoints}>
              {'순항고도 전체 적용'}
            </button>
          </div>
          <div className="vfr-waypoint-altitude-list">
            {vfrWaypoints.map((wp, index) => {
              const fallbackAltitudeFt = Number(cruiseAltitudeFt)
              const displayAltitudeFt = wp.fixed
                ? getVfrAirportAltitudeFt(airports, wp)
                : Number.isFinite(Number(wp.altitudeFt))
                ? Number(wp.altitudeFt)
                : fallbackAltitudeFt
              const isEditing = !wp.fixed && editingVfrAltitudeIndex === index
              return (
                <div className="vfr-waypoint-altitude-row" key={`${wp.id}-${index}`}>
                  <span className="vfr-waypoint-altitude-id">{wp.id}</span>
                  {isEditing ? (
                    <input
                      className="vfr-waypoint-altitude-input"
                      type="number"
                      min="100"
                      step="100"
                      autoFocus
                      value={Number.isFinite(displayAltitudeFt) ? Math.round(displayAltitudeFt) : ''}
                      onChange={(e) => updateVfrWaypointAltitude(index, e.target.value)}
                      onBlur={() => setEditingVfrAltitudeIndex(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEditingVfrAltitudeIndex(null)
                      }}
                    />
                  ) : wp.fixed ? (
                    <span className="vfr-waypoint-altitude-pill is-fixed" title="공항 고도">
                      {`${Math.round(displayAltitudeFt).toLocaleString()} ft`}
                    </span>
                  ) : (
                    <button
                      className="vfr-waypoint-altitude-pill"
                      type="button"
                      onClick={() => setEditingVfrAltitudeIndex(index)}
                    >
                      {Number.isFinite(displayAltitudeFt)
                        ? `${Math.round(displayAltitudeFt).toLocaleString()} ft`
                        : '고도 입력'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )

  // Cross-section generation moves to the 성능·시간 step (mobile) / below the route
  // (desktop). Cruise altitude comes from 내 항공기 above — no separate input here.
  const crossSectionBlock = routeResult && (
    <div className="route-check-result">
      <button type="button" className="vertical-profile-generate" onClick={handleVerticalProfileRequest} disabled={verticalProfileLoading}>
        {verticalProfileLoading ? '생성 중...' : '연직단면도 생성'}
      </button>
      {verticalProfileStale && (
        <div className="vertical-profile-stale">
          {'경로가 변경되었습니다. 연직단면도를 다시 생성해주세요.'}
        </div>
      )}
      {verticalProfileError && <div className="vertical-profile-error">{verticalProfileError}</div>}
      {verticalProfile && (
        <button
          className="vertical-profile-open-button"
          type="button"
          onClick={() => setVerticalProfileWindowOpen(true)}
        >
          {'연직단면도 열기'}
        </button>
      )}
    </div>
  )

  // Briefing inputs (교체공항 / ETD / 순항속도) + 브리핑 생성 trigger. Shared
  // between desktop and mobile. 교체공항 options mirror the 출발/도착 airport
  // source (KNOWN_AIRPORTS) plus a 없음 entry.
  // showGenerate: desktop keeps the 브리핑 생성 button inside this section; mobile
  // moves it to the sheet footer (progressive primary action), so pass false there.
  const renderBriefingConditions = (showGenerate) => (
    <div className="route-check-section route-check-section--briefing">
      <div className="route-check-section-title">{'브리핑 조건'}</div>
      <label className="rb-altn">{'교체 공항'}
        <select value={alternateAirport} onChange={(e) => setAlternateAirport(e.target.value)}>
          <option value="">{'-- 없음 --'}</option>
          {KNOWN_AIRPORTS.map((ap) => <option key={ap} value={ap}>{ap}</option>)}
        </select>
      </label>
      {perfTimeBlock}
      {showGenerate && (
        <button
          className="route-check-search-button"
          type="button"
          onClick={handleGenerateBriefing}
          disabled={!routeResult || briefingLoading}
        >
          {briefingLoading ? '브리핑 생성 중...' : '브리핑 생성'}
        </button>
      )}
      {briefingError && <div className="route-check-error">{briefingError}</div>}
    </div>
  )

  // ── Desktop panel (unchanged): native selects in the floating panel ──
  function renderDesktopAirportSelect(label, value, onChange, firSentinel, firLabel) {
    return (
      <label>{label}
        <select
          value={KNOWN_AIRPORTS.includes(value) ? value : value === firSentinel ? firSentinel : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>{'-- 선택 --'}</option>
          {KNOWN_AIRPORTS.map((ap) => <option key={ap} value={ap}>{ap}</option>)}
          <option value={firSentinel}>{firLabel}</option>
        </select>
      </label>
    )
  }

  const desktopBody = (
    <>
      <form className="route-check-form" onSubmit={handleRouteSearch}>
        <div className="route-check-section route-check-section--conditions">
          <div className="route-check-section-title">{'운항 조건'}</div>
          <div className="route-check-section-grid">
            <div className={`route-check-field route-check-flight-rule-field${routeForm.flightRule === 'VFR' ? ' full-width' : ''}`}>
              <div className="route-check-field-label">{'비행 규칙'}</div>
              <div className="route-check-flight-rule">
                <label className={`route-check-radio route-check-flight-option${isIfr ? ' is-active' : ''}`}>
                  <input type="radio" name="flightRule" value="IFR" checked={isIfr} onChange={() => switchFlightRule('IFR')} />
                  <span>IFR</span>
                </label>
                <span className="route-check-flight-divider">/</span>
                <label className={`route-check-radio route-check-flight-option${!isIfr ? ' is-active' : ''}`}>
                  <input type="radio" name="flightRule" value="VFR" checked={!isIfr} onChange={() => switchFlightRule('VFR')} />
                  <span>VFR</span>
                </label>
              </div>
            </div>
            {isIfr && (
              <label>{'경로 유형'}
                <select value={routeForm.routeType} onChange={(e) => updateRouteField('routeType', e.target.value)}>
                  <option value="ALL">{'전체'}</option>
                  <option value="RNAV">RNAV</option>
                  <option value="ATS">ATS</option>
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="route-check-section">
          <div className="route-check-section-title">{'출발'}</div>
          <div className="route-check-section-grid">
            {renderDesktopAirportSelect('출발 공항', routeForm.departureAirport, handleDepartureAirportChange, FIR_IN_AIRPORT, 'FIR 진입')}
            {isIfr && (
            <label>{isFirInMode ? '진입 FIX' : visibleSidOptions.length > 0 ? 'SID' : '진입 FIX'}
              {isFirInMode
                ? (
                    <select
                    value={routeForm.entryFix}
                    onChange={(e) => handleEntryFixChange(e.target.value)}
                    disabled={firInOptions.length === 0}
                  >
                    {firInOptions.length === 0
                      ? <option value="">{'진입 FIX 없음'}</option>
                      : [
                          <option key="__empty__" value="">{'-- 없음 --'}</option>,
                          ...firInOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>),
                        ]}
                  </select>
                )
                : visibleSidOptions.length > 0
                ? (
                  <select value={selectedSid?.id ?? ''} onChange={(e) => {
                    const proc = visibleSidOptions.find((p) => p.id === e.target.value) ?? null
                    handleSidChange(proc)
                  }}>
                    <option value="">{'-- 없음 --'}</option>
                    {visibleSidOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )
                : <input value={routeForm.entryFix} onChange={(e) => handleEntryFixChange(e.target.value)} />
              }
            </label>
            )}
          </div>
        </div>

        <div className="route-check-section">
          <div className="route-check-section-title">{'도착'}</div>
          <div className="route-check-section-grid">
            {renderDesktopAirportSelect('도착 공항', routeForm.arrivalAirport, handleArrivalAirportChange, FIR_EXIT_AIRPORT, 'FIR 이탈')}
            {isIfr && (
            <label>{isFirExitMode ? '이탈 FIX' : starOptions.length > 0 ? 'STAR' : '이탈 FIX'}
              {isFirExitMode
                ? (
                  <select
                    value={routeForm.exitFix}
                    onChange={(e) => handleExitFixChange(e.target.value)}
                    disabled={firExitOptions.length === 0}
                  >
                    {firExitOptions.length === 0
                      ? <option value="">{'이탈 FIX 없음'}</option>
                      : [
                          <option key="__empty__" value="">{'-- 없음 --'}</option>,
                          ...firExitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>),
                        ]}
                  </select>
                )
                : starOptions.length > 0
                ? (
                  <select value={selectedStar?.id ?? ''} onChange={(e) => {
                    const proc = starOptions.find((p) => p.id === e.target.value) ?? null
                    handleStarChange(proc)
                  }}>
                    <option value="">{'-- 없음 --'}</option>
                    {starOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                )
                : <input value={routeForm.exitFix} onChange={(e) => handleExitFixChange(e.target.value)} />
              }
            </label>
            )}
            {!isFirExitMode && iapCandidates.length > 1 && (
              <label>RWY
                <select value={selectedIapKey ?? ''} onChange={(e) => {
                  handleIapChange(e.target.value)
                }}>
                  {iapCandidates.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {renderBriefingConditions(true)}

        <div className={`route-check-actions${!isIfr ? ' is-vfr' : ''}`}>
          <button className="route-check-search-button" type="submit" disabled={routeLoading}>{routeLoading ? '검색 중...' : '검색'}</button>
          {isIfr && (
            <button className="route-check-secondary-button" type="button" onClick={handleAutoRecommend} disabled={routeLoading}>{'자동검색'}</button>
          )}
          <button className="route-check-secondary-button" type="button" onClick={handleRouteReset} disabled={routeLoading}>{'초기화'}</button>
        </div>
      </form>
      {errorBlock}
      {routePreview}
      {crossSectionBlock}
    </>
  )

  // ── Mobile sheet: from→to + swap, dependent pickers, progressive disclosure ──
  const depChosen = !!routeForm.departureAirport
  const arrChosen = !!routeForm.arrivalAirport
  const firOnEitherSide = routeForm.departureAirport === FIR_IN_AIRPORT || routeForm.arrivalAirport === FIR_EXIT_AIRPORT

  const stepNav = (
    <div className="rb-steps">
      {[[1, '경로'], [2, '성능·시간']].map(([n, label]) => (
        <button key={n} type="button" className={`rb-step${mobileStep === n ? ' is-active' : ''}`} onClick={() => setMobileStep(n)}>{label}</button>
      ))}
    </div>
  )

  const mobileBody = (
    <form id="rb-mobile-form" className="route-check-form rb-mobile" onSubmit={handleRouteSearch}>
      {mobileStep === 1 && (
        <>
          <div className="route-type-segmented">
            <button type="button" className={`route-type-seg${isIfr ? ' is-active' : ''}`} onClick={() => switchFlightRule('IFR')}>IFR</button>
            <button type="button" className={`route-type-seg${!isIfr ? ' is-active' : ''}`} onClick={() => switchFlightRule('VFR')}>VFR</button>
          </div>
          <div className="rb-route">
            <AirportPickerField label="출발" value={routeForm.departureAirport} options={AIRPORT_OPTIONS} firOption={{ value: FIR_IN_AIRPORT, label: 'FIR 진입' }} onChange={handleDepartureAirportChange} disabledValue={routeForm.arrivalAirport} />
            <div className="rb-swap"><button type="button" className="rb-swap-btn" onClick={swapAirports} disabled={firOnEitherSide} aria-label="출발 도착 교환">⇅</button></div>
            <AirportPickerField label="도착" value={routeForm.arrivalAirport} options={AIRPORT_OPTIONS} firOption={{ value: FIR_EXIT_AIRPORT, label: 'FIR 이탈' }} onChange={handleArrivalAirportChange} disabledValue={routeForm.departureAirport} />
          </div>
          <label className="rb-altn">{'교체 공항'}
            <select value={alternateAirport} onChange={(e) => setAlternateAirport(e.target.value)}>
              <option value="">{'-- 없음 --'}</option>
              {KNOWN_AIRPORTS.map((ap) => <option key={ap} value={ap}>{ap}</option>)}
            </select>
          </label>
          {isIfr && (
            <div className="route-type-segmented">
              {[['ALL', '전체'], ['RNAV', 'RNAV'], ['ATS', 'ATS']].map(([val, lbl]) => (
                <button key={val} type="button" className={`route-type-seg${routeForm.routeType === val ? ' is-active' : ''}`} onClick={() => updateRouteField('routeType', val)}>{lbl}</button>
              ))}
            </div>
          )}
          {isIfr && (depChosen || arrChosen) && (
            <button type="button" className="route-check-secondary-button rb-auto-search" onClick={handleAutoRecommend} disabled={routeLoading}>
              {routeLoading ? '검색 중...' : '자동검색 (SID·STAR 추천)'}
            </button>
          )}
          <div className="rb-procedures">
            {isIfr && depChosen && (isFirInMode
              ? <PickerField label="진입 FIX" value={routeForm.entryFix} options={[NONE_OPTION, ...firInOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={handleEntryFixChange} />
              : <PickerField label="SID" value={selectedSid?.id ?? ''} options={[NONE_OPTION, ...visibleSidOptions.map((p) => ({ value: p.id, label: p.label }))]} onChange={(id) => handleSidChange(id ? (visibleSidOptions.find((p) => p.id === id) ?? null) : null)} />)}
            {isIfr && arrChosen && (isFirExitMode
              ? <PickerField label="이탈 FIX" value={routeForm.exitFix} options={[NONE_OPTION, ...firExitOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={handleExitFixChange} />
              : <PickerField label="STAR" value={selectedStar?.id ?? ''} options={[NONE_OPTION, ...starOptions.map((p) => ({ value: p.id, label: p.label }))]} onChange={(id) => handleStarChange(id ? (starOptions.find((p) => p.id === id) ?? null) : null)} />)}
            {isIfr && arrChosen && !isFirExitMode && iapCandidates.length > 1 && (
              <PickerField label="RWY" value={selectedIapKey ?? ''} options={iapCandidates.map(({ key, label }) => ({ value: key, label }))} onChange={handleIapChange} />
            )}
            {!isIfr && <div className="rb-vfr-note">VFR — 지도에서 경유점을 추가하세요</div>}
          </div>
          {errorBlock}
          {routePreview}
        </>
      )}
      {mobileStep === 2 && (
        <>
          {perfTimeBlock}
          {crossSectionBlock}
        </>
      )}
    </form>
  )

  // Action bar lives in the sheet footer (outside the scroll area) so it stays
  // flush to the bottom task bar regardless of form height.
  // Progressive footer: before a route exists, the primary action is 검색
  // (+자동검색/초기화). Once a route is found, the footer's primary action
  // advances to 브리핑 생성 (the final deliverable) with 초기화 alongside.
  const mobileFooter = mobileStep === 1 ? (
    <div className="route-check-actions is-step">
      {routeResult ? (
        <button type="button" className="route-check-search-button" onClick={() => setMobileStep(2)}>{'다음'}</button>
      ) : (
        <button type="button" className="route-check-search-button" onClick={() => handleRouteSearch({ preventDefault() {} })} disabled={routeLoading}>{routeLoading ? '검색 중...' : '경로 검색'}</button>
      )}
    </div>
  ) : (
    <div className="route-check-actions is-step">
      <button type="button" className="route-check-secondary-button" onClick={() => setMobileStep(1)}>{'이전'}</button>
      <button type="button" className="route-check-search-button" onClick={handleGenerateBriefing} disabled={!routeResult || briefingLoading}>{briefingLoading ? '브리핑 생성 중...' : '브리핑 생성'}</button>
    </div>
  )

  // Centered peek summary shown when the sheet is collapsed (map revealed).
  const depLabel = routeForm.departureAirport === FIR_IN_AIRPORT
    ? 'FIR진입'
    : routeForm.departureAirport || '출발'
  const arrLabel = routeForm.arrivalAirport === FIR_EXIT_AIRPORT
    ? 'FIR이탈'
    : routeForm.arrivalAirport || '도착'
  let peekDistance = null
  if (routeResult) {
    if (routeResult.flightRule === 'VFR' && vfrWaypoints.length >= 2) {
      peekDistance = `${calcVfrDistance(vfrWaypoints).toFixed(1)} NM`
    } else if (routeResult.flightRule === 'IFR') {
      peekDistance = `${buildIfrDistanceBreakdown({ routeResult, selectedSid, selectedStar, selectedIap }).totalDistanceNm} NM`
    }
  }
  const peekSummary = (
    <span className="rb-peek-route">
      <span>{depLabel}</span>
      <span className="rb-peek-arrow" aria-hidden="true">→</span>
      <span>{arrLabel}</span>
      <span className="route-check-status rb-peek-rule">{routeForm.flightRule}</span>
      {peekDistance && <span className="rb-peek-dist">{peekDistance}</span>}
    </span>
  )

  return (
    <>
      {hoveredWpInfo && (
        <button
          className="vfr-wp-delete"
          style={{ left: hoveredWpInfo.x + 8, top: hoveredWpInfo.y - 16 }}
          onClick={() => deleteVfrWaypoint(hoveredWpInfo.idx)}
          onMouseEnter={() => clearTimeout(hideTimerRef?.current)}
          onMouseLeave={() => setHoveredWpInfo(null)}
        >X</button>
      )}
      {isMobile ? (
        <MobileSheet
          open
          eyebrow="Flight Plan"
          title={'경로 확인'}
          onClose={() => setSheetDetent('peek')}
          detent={sheetDetent}
          onDetentChange={setSheetDetent}
          headerExtra={stepNav}
          peekContent={peekSummary}
          footer={mobileFooter}
        >
          {mobileBody}
        </MobileSheet>
      ) : (
        <section className="route-check-panel" aria-label={'경로 확인 패널'}>
          <div className="route-check-header">
            <div>
              <div className="route-check-eyebrow">Flight Plan</div>
              <div className="route-check-title">{'경로 확인'}</div>
            </div>
            <span className="route-check-status">{routeForm.flightRule}</span>
          </div>
          {desktopBody}
        </section>
      )}
    </>
  )
}
