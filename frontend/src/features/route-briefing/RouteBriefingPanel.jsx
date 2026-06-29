import { useState, useRef } from 'react'
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
import { Button, Field, Dropdown, Option, Input, SpinButton, TabList, Tab, Badge, MessageBar, MessageBarBody, DatePicker, TimePicker, makeStyles, mergeClasses, tokens } from '../../shared/ui/fluent.js'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import MobileSheet from '../../shared/ui/MobileSheet.jsx'
import AirportPickerField from '../../shared/ui/AirportPickerField.jsx'
import PickerField from '../../shared/ui/PickerField.jsx'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'
import { computeEtaIso } from './lib/etaCalc.js'
import { formatBriefingTime } from './lib/briefingTime.js'
import './RouteBriefing.css'

const AIRPORT_KO = {
  RKSI: '인천', RKSS: '김포', RKPC: '제주', RKPK: '김해',
  RKJB: '무안', RKNY: '양양', RKJY: '여수', RKPU: '울산',
}
const AIRPORT_OPTIONS = KNOWN_AIRPORTS.map((icao) => ({ value: icao, ko: AIRPORT_KO[icao] ?? icao }))
const NONE_OPTION = { value: '', label: '-- 없음 --' }

// 데스크톱 폼 레이아웃 — 커스텀 .css 대신 Fluent griffel + 토큰
const useStyles = makeStyles({
  form: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalXXL}` },
  section: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  sectionTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    letterSpacing: '0.04em',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacingHorizontalM, alignItems: 'end' },
  field: { minWidth: 0 },
  fieldFull: { gridColumn: '1 / -1', minWidth: 0 },
  // ⇄ 교환 버튼은 가운데 전용 칸(auto). 출발/도착은 좌우 대칭. (1fr 1fr로 키우면 ⇄ 자리가 없어 겹침)
  routeRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: tokens.spacingHorizontalS, alignItems: 'end' },
  swapBtn: { minWidth: '32px', marginBottom: tokens.spacingVerticalXS },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: tokens.spacingHorizontalS },
  actionsVfr: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  etdQuick: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS },
  detailToggleRow: { display: 'flex', justifyContent: 'flex-end' },
  etdRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacingHorizontalM },
  // DatePicker/TimePicker 내부 Combobox 기본 min-width(250px)를 눌러 좁은 패널에서 한 줄에 맞춤
  picker: {
    width: '100%', minWidth: 0,
    '& .fui-Combobox': { minWidth: 0 },
    '& .fui-Combobox__input': { minWidth: 0, width: '100%' },
    '& .fui-Input__input': { minWidth: 0, width: '100%' },
  },
  summary: {
    display: 'flex', justifyContent: 'space-between', gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS + ' ' + tokens.spacingHorizontalM,
    background: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
  },
  result: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, paddingTop: tokens.spacingVerticalM },
  totalDist: { fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  ctrl: { width: '100%', minWidth: 0 },
  full: { width: '100%' },
})

// 목록 선택 Dropdown(타이핑 없음) — value↔표시텍스트↔selectedOptions 처리 한 곳에
function FDropdown({ value, onChange, options, placeholder = '선택', disabled, className }) {
  const v = String(value ?? '')
  const sel = options.find((o) => String(o.value) === v)
  return (
    <Dropdown
      className={className}
      disabled={disabled}
      value={sel ? sel.label : placeholder}
      selectedOptions={[v]}
      onOptionSelect={(_, d) => onChange(d.optionValue)}
    >
      {options.map((o) => <Option key={o.value} value={String(o.value)}>{o.label}</Option>)}
    </Dropdown>
  )
}

export default function RouteBriefingPanel({ state, refs = {}, derived, actions, airports = [] }) {
  const isMobile = useIsMobile()
  const s = useStyles()
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
  // 출발·도착이 모두 있어야 검색 가능(빈 입력으로 검색→서버 오류를 사전 차단).
  const canSearch = !!routeForm.departureAirport && !!routeForm.arrivalAirport
  // 초기화 오클릭 방지: 잃을 입력이 있으면 한 번 더 눌러 확인(3초 후 자동 해제).
  const [resetArmed, setResetArmed] = useState(false)
  const resetArmTimerRef = useRef(null)
  const hasInput = !!routeResult || !!routeForm.departureAirport || !!routeForm.arrivalAirport
  function armOrReset() {
    if (resetArmed || !hasInput) {
      clearTimeout(resetArmTimerRef.current)
      setResetArmed(false)
      handleRouteReset()
      return
    }
    setResetArmed(true)
    resetArmTimerRef.current = setTimeout(() => setResetArmed(false), 3000)
  }

  // ETA is auto-computed read-only from ETD + planned distance + TAS.
  const etaIso = computeEtaIso(etd, derived.plannedDistanceNm, cruiseSpeedKt)
  const summaryStrip = (
    <div className={s.summary}>
      <span style={{ color: tokens.colorNeutralForeground3 }}>거리 {Math.round(derived.plannedDistanceNm)} NM</span>
      <span style={{ fontWeight: tokens.fontWeightSemibold }}>ETD → ETA {formatBriefingTime(etd, tz)} → {etaIso ? formatBriefingTime(etaIso, tz) : '—'}</span>
    </div>
  )
  const setEtdFromNow = (mins) => setEtd(new Date(Date.now() + mins * 60000).toISOString())
  // ETD(ISO/UTC) ↔ tz 벽시계 변환 — DatePicker/TimePicker는 Date의 로컬 필드를 쓰므로 tz 보정.
  const tzOffsetMs = tz === 'KST' ? 9 * 3600 * 1000 : 0
  const etdBaseMs = Number.isFinite(Date.parse(etd)) ? Date.parse(etd) : Date.now()
  const w0 = new Date(etdBaseMs + tzOffsetMs)
  const etdWall = new Date(w0.getUTCFullYear(), w0.getUTCMonth(), w0.getUTCDate(), w0.getUTCHours(), w0.getUTCMinutes())
  const setEtdWall = (y, mo, d, h, mi) => setEtd(new Date(Date.UTC(y, mo, d, h, mi) - tzOffsetMs).toISOString())
  // 속도·고도·ETD 입력(Fluent). 요약(summaryStrip)은 분리해 ④ 경로 결과에서 재사용.
  const perfFields = (
    <>
      <div className={s.grid}>
        <Field label="순항속도 (TAS, kt)">
          <SpinButton className={s.ctrl} value={Number(cruiseSpeedKt) || 0} min={60} max={600} step={5}
            onChange={(_, d) => { const v = d.value ?? Number(d.displayValue); if (Number.isFinite(v)) setCruiseSpeedKt(v) }} />
        </Field>
        <Field label="순항고도 (ft)">
          <SpinButton className={s.ctrl} value={Number(cruiseAltitudeFt) || 0} min={500} max={60000} step={500}
            onChange={(_, d) => { const v = d.value ?? Number(d.displayValue); if (Number.isFinite(v)) setCruiseAltitudeFt(v) }} />
        </Field>
      </div>
      <Field label={`ETD (${tz})`}>
        <div className={s.etdRow}>
          <DatePicker className={s.picker} value={etdWall}
            formatDate={(d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`}
            onSelectDate={(date) => date && setEtdWall(date.getFullYear(), date.getMonth(), date.getDate(), etdWall.getHours(), etdWall.getMinutes())} />
          <TimePicker key={etd} className={s.picker} freeform hourCycle="h23" increment={5} dateAnchor={etdWall} defaultSelectedTime={etdWall}
            defaultValue={`${String(etdWall.getHours()).padStart(2, '0')}:${String(etdWall.getMinutes()).padStart(2, '0')}`}
            onTimeChange={(_, data) => data.selectedTime && setEtdWall(etdWall.getFullYear(), etdWall.getMonth(), etdWall.getDate(), data.selectedTime.getHours(), data.selectedTime.getMinutes())} />
        </div>
      </Field>
      <div className={s.etdQuick}>
        {[['지금', 0], ['+30분', 30], ['+1시간', 60], ['+2시간', 120]].map(([lbl, m]) => (
          <Button key={lbl} size="small" appearance="secondary" onClick={() => setEtdFromNow(m)}>{lbl}</Button>
        ))}
      </div>
    </>
  )
  // 모바일 ③단계에서 사용(입력 + 요약)
  const perfTimeBlock = (<>{perfFields}{summaryStrip}</>)

  function swapAirports() {
    const dep = routeForm.departureAirport
    const arr = routeForm.arrivalAirport
    handleDepartureAirportChange(arr)
    handleArrivalAirportChange(dep)
  }

  // Shared between the desktop panel and the mobile sheet.
  const errorBlock = routeError && (
    <MessageBar intent="error"><MessageBarBody>{routeError}</MessageBarBody></MessageBar>
  )

  const routePreview = routeResult && (
    <div className="route-check-result">
      {routeResult.flightRule === 'IFR' && (() => {
        const displayTokens = buildIfrSequenceTokens(routeResult, { selectedSid, selectedStar, selectedIap })
        const { totalDistanceNm } = buildIfrDistanceBreakdown({ routeResult, selectedSid, selectedStar, selectedIap })
        const sequenceVisible = showDetailRoute

        return (
          <>
            <div className="route-check-total-dist">
              <div className="route-check-total-dist-head">
                <span>{'총 거리'} <strong>{totalDistanceNm} NM</strong></span>
                <Button appearance="subtle" size="small" type="button" aria-expanded={showDetailRoute}
                  onClick={() => setShowDetailRoute((v) => !v)}>
                  {'세부경로'} {showDetailRoute ? '▴' : '▾'}
                </Button>
              </div>
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

  // 연직단면도: 버튼 하나로 — 생성되면 같은 버튼이 '열기'로 전환(경로 변경 시 다시 '생성').
  const profileReady = verticalProfile && !verticalProfileStale
  const crossSectionBlock = routeResult && (
    <div className="route-check-result">
      <Button appearance="secondary" type="button" className={s.full} disabled={verticalProfileLoading}
        onClick={profileReady ? () => setVerticalProfileWindowOpen(true) : handleVerticalProfileRequest}>
        {verticalProfileLoading ? '생성 중...' : profileReady ? '연직단면도 열기' : '연직단면도 생성'}
      </Button>
      {verticalProfileStale && verticalProfile && (
        <MessageBar intent="warning"><MessageBarBody>경로가 변경되었습니다. 연직단면도를 다시 생성해주세요.</MessageBarBody></MessageBar>
      )}
      {verticalProfileError && <MessageBar intent="error"><MessageBarBody>{verticalProfileError}</MessageBarBody></MessageBar>}
    </div>
  )

  // Briefing inputs (교체공항 / ETD / 순항속도) + 브리핑 생성 trigger. Shared
  // between desktop and mobile. 교체공항 options mirror the 출발/도착 airport
  // source (KNOWN_AIRPORTS) plus a 없음 entry.
  // showGenerate: desktop keeps the 브리핑 생성 button inside this section; mobile
  // moves it to the sheet footer (progressive primary action), so pass false there.
  // ── Desktop panel ──
  function renderDesktopAirportSelect(label, value, onChange, firSentinel, firLabel) {
    const sel = KNOWN_AIRPORTS.includes(value) ? value : value === firSentinel ? firSentinel : ''
    const options = [
      { value: '', label: '-- 선택 --' },
      ...KNOWN_AIRPORTS.map((ap) => ({ value: ap, label: ap })),
      { value: firSentinel, label: firLabel },
    ]
    return (
      <Field className={s.field} label={label}>
        <FDropdown className={s.ctrl} value={sel} onChange={onChange} placeholder="-- 선택 --" options={options} />
      </Field>
    )
  }

  const depProcControl = isFirInMode ? (
    <FDropdown className={s.ctrl} disabled={firInOptions.length === 0} value={routeForm.entryFix} onChange={handleEntryFixChange}
      options={firInOptions.length === 0 ? [{ value: '', label: '진입 FIX 없음' }] : [{ value: '', label: '-- 없음 --' }, ...firInOptions.map((o) => ({ value: o.value, label: o.label }))]} />
  ) : visibleSidOptions.length > 0 ? (
    <FDropdown className={s.ctrl} value={selectedSid?.id ?? ''} onChange={(id) => handleSidChange(visibleSidOptions.find((p) => p.id === id) ?? null)}
      options={[{ value: '', label: '-- 없음 --' }, ...visibleSidOptions.map((p) => ({ value: p.id, label: p.label }))]} />
  ) : (
    <Input className={s.ctrl} value={routeForm.entryFix} onChange={(_, d) => handleEntryFixChange(d.value)} />
  )

  const arrProcControl = isFirExitMode ? (
    <FDropdown className={s.ctrl} disabled={firExitOptions.length === 0} value={routeForm.exitFix} onChange={handleExitFixChange}
      options={firExitOptions.length === 0 ? [{ value: '', label: '이탈 FIX 없음' }] : [{ value: '', label: '-- 없음 --' }, ...firExitOptions.map((o) => ({ value: o.value, label: o.label }))]} />
  ) : starOptions.length > 0 ? (
    <FDropdown className={s.ctrl} value={selectedStar?.id ?? ''} onChange={(id) => handleStarChange(starOptions.find((p) => p.id === id) ?? null)}
      options={[{ value: '', label: '-- 없음 --' }, ...starOptions.map((p) => ({ value: p.id, label: p.label }))]} />
  ) : (
    <Input className={s.ctrl} value={routeForm.exitFix} onChange={(_, d) => handleExitFixChange(d.value)} />
  )

  const desktopBody = (
    <>
      <form className={s.form} onSubmit={handleRouteSearch}>
        <div className={s.section}>
          <h3 className={s.sectionTitle}>{'① 비행 규칙'}</h3>
          <TabList selectedValue={routeForm.flightRule} onTabSelect={(_, d) => switchFlightRule(d.value)}>
            <Tab value="IFR">IFR</Tab>
            <Tab value="VFR">VFR</Tab>
          </TabList>
        </div>

        <div className={s.section}>
          <h3 className={s.sectionTitle}>{'② 경로'}</h3>
          <div className={s.routeRow}>
            {renderDesktopAirportSelect('출발 공항', routeForm.departureAirport, handleDepartureAirportChange, FIR_IN_AIRPORT, 'FIR 진입')}
            <Button className={s.swapBtn} appearance="subtle" type="button" aria-label="출발 도착 교환"
              disabled={routeForm.departureAirport === FIR_IN_AIRPORT || routeForm.arrivalAirport === FIR_EXIT_AIRPORT}
              onClick={swapAirports}>⇄</Button>
            {renderDesktopAirportSelect('도착 공항', routeForm.arrivalAirport, handleArrivalAirportChange, FIR_EXIT_AIRPORT, 'FIR 이탈')}
          </div>
          {isIfr && (
            <Field label="경로 유형">
              <TabList selectedValue={routeForm.routeType} onTabSelect={(_, d) => updateRouteField('routeType', d.value)}>
                <Tab value="ALL">전체</Tab><Tab value="RNAV">RNAV</Tab><Tab value="ATS">ATS</Tab>
              </TabList>
            </Field>
          )}
          {isIfr && (
            <div className={s.grid}>
              <Field className={s.field} label={isFirInMode ? '진입 FIX' : visibleSidOptions.length > 0 ? 'SID' : '진입 FIX'}>{depProcControl}</Field>
              <Field className={s.field} label={isFirExitMode ? '이탈 FIX' : starOptions.length > 0 ? 'STAR' : '이탈 FIX'}>{arrProcControl}</Field>
              {!isFirExitMode && iapCandidates.length > 1 && (
                <Field className={s.field} label="RWY">
                  <FDropdown className={s.ctrl} value={selectedIapKey ?? ''} onChange={handleIapChange}
                    options={iapCandidates.map(({ key, label }) => ({ value: key, label }))} />
                </Field>
              )}
            </div>
          )}
        </div>

        <div className={mergeClasses(s.actions, !isIfr && s.actionsVfr)}>
          <Button appearance="primary" type="submit" disabled={routeLoading || !canSearch}
            title={canSearch ? undefined : '출발·도착 공항을 먼저 선택하세요'}>{routeLoading ? '검색 중...' : '검색'}</Button>
          {isIfr && (
            <Button appearance="secondary" type="button" onClick={handleAutoRecommend} disabled={routeLoading}>{'자동검색'}</Button>
          )}
          <Button appearance="secondary" type="button" onClick={armOrReset} disabled={routeLoading}>{resetArmed ? '초기화 확인' : '초기화'}</Button>
        </div>

        {errorBlock}

        <div className={s.section}>
          <h3 className={s.sectionTitle}>{'③ 브리핑 조건'}</h3>
          <Field label="교체 공항">
            <FDropdown className={s.ctrl} value={alternateAirport} onChange={setAlternateAirport} placeholder="-- 없음 --"
              options={[{ value: '', label: '-- 없음 --' }, ...KNOWN_AIRPORTS.filter((ap) => ap !== routeForm.departureAirport && ap !== routeForm.arrivalAirport).map((ap) => ({ value: ap, label: ap }))]} />
          </Field>
          {perfFields}
        </div>

        {routeResult && (
          <div className={s.section}>
            <h3 className={s.sectionTitle}>{'④ 경로 결과'}</h3>
            {routeResult.flightRule === 'IFR' ? (
              <>
                <div className={s.summary}>
                  <span style={{ color: tokens.colorNeutralForeground3 }}>거리 {Math.round(derived.plannedDistanceNm)} NM</span>
                  <Button appearance="subtle" size="small" type="button" aria-expanded={showDetailRoute} onClick={() => setShowDetailRoute((v) => !v)}>
                    {'세부경로'} {showDetailRoute ? '▴' : '▾'}
                  </Button>
                </div>
                <div className={s.detailToggleRow}>
                  <span style={{ fontWeight: tokens.fontWeightSemibold }}>ETD {formatBriefingTime(etd, tz)} → ETA {etaIso ? formatBriefingTime(etaIso, tz) : '—'}</span>
                </div>
                {showDetailRoute && (
                  <div className="route-check-sequence">
                    {buildIfrSequenceTokens(routeResult, { selectedSid, selectedStar, selectedIap }).map((token, index) => (
                      <span key={`${token.kind}-${token.text}-${index}`}>
                        {index > 0 && <span className="route-check-sequence-sep">{' -> '}</span>}
                        <span className={`route-check-sequence-token is-${token.kind}`} style={{ color: ROUTE_SEQUENCE_COLORS[token.kind] }}>{token.text}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              routePreview
            )}
          </div>
        )}

        {briefingError && <MessageBar intent="error"><MessageBarBody>{briefingError}</MessageBarBody></MessageBar>}
        {crossSectionBlock}
        <Button appearance="primary" type="button" className={s.full} onClick={handleGenerateBriefing} disabled={!routeResult || briefingLoading}>
          {briefingLoading ? '브리핑 생성 중...' : '브리핑 생성'}
        </Button>
      </form>
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
              {KNOWN_AIRPORTS.filter((ap) => ap !== routeForm.departureAirport && ap !== routeForm.arrivalAirport).map((ap) => <option key={ap} value={ap}>{ap}</option>)}
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
      {(depChosen || arrChosen || routeResult) && (
        <button type="button" className="route-check-secondary-button" onClick={armOrReset} disabled={routeLoading}>{resetArmed ? '초기화 확인' : '초기화'}</button>
      )}
      {routeResult ? (
        <button type="button" className="route-check-search-button" onClick={() => setMobileStep(2)}>{'다음'}</button>
      ) : (
        <button type="button" className="route-check-search-button" onClick={() => handleRouteSearch({ preventDefault() {} })} disabled={routeLoading || !canSearch}>{routeLoading ? '검색 중...' : '경로 검색'}</button>
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
              <h2 className="route-check-title">{'경로 확인'}</h2>
            </div>
            <Badge appearance="tint" color="informative">{routeForm.flightRule}</Badge>
          </div>
          {desktopBody}
        </section>
      )}
    </>
  )
}
