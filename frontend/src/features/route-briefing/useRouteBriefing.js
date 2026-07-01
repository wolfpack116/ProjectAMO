import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchVerticalProfile, fetchCrossSection, fetchRouteBriefing } from '../../api/briefingApi.js'
import { getProcedures, KNOWN_AIRPORTS } from './lib/procedureData.js'
import { buildBriefingRoute, buildVfrRoute, canBuildBriefingRoutePath, loadIapData, loadNavpoints, loadRouteDirectionMetadata } from './lib/routePlanner.js'
import { relabeledWaypoints, calcVfrDistance, findInsertIndex } from './lib/routePreview.js'
import { computeEtaIso } from './lib/etaCalc.js'
import { getLastUsed } from './lib/aircraftProfiles.js'
import { initialBearingDeg, magneticCourse } from './lib/altitude.js'
import { buildVerticalProfileRequest } from './lib/verticalProfileRequest.js'
import { buildAirportStationMarkerModel } from '../map/lib/airportStationModel.js'
import { FLIGHT_CATEGORY_META } from '../../shared/weather/helpers.js'
import {
  FIR_EXIT_AIRPORT,
  FIR_IN_AIRPORT,
  buildBoundaryFixOptions,
  buildIapCandidates,
  buildIfrDistanceBreakdown,
  buildInitialVfrWaypoints,
  buildRoutePreviewModel,
  buildVisibleSidOptions,
  chooseIapKeyForRunway,
  filterProceduresByRunway,
  getCurrentRouteLineString,
  getVfrAirportAltitudeFt,
  getWindDirection,
  pickBestRunwayGroup,
} from './lib/routeBriefingModel.js'

export const initialRouteForm = {
  flightRule: 'IFR',
  departureAirport: '', entryFix: '',
  exitFix: '', arrivalAirport: '', routeType: 'RNAV',
}
export const DEFAULT_CRUISE_ALTITUDE_FT = 9000

const CATEGORY_WORST_ORDER = ['LIFR', 'IFR', 'VFR', 'UNKNOWN']

export function useRouteBriefing({ activePanel, airports = [], metarData = null, warnedAirports = [] }) {
  const [routeForm, setRouteForm] = useState(initialRouteForm)
  const [routeResult, setRouteResult] = useState(null)
  const [routeError, setRouteError] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [cruiseAltitudeFt, setCruiseAltitudeFt] = useState(() => getLastUsed()?.altitudeFt ?? DEFAULT_CRUISE_ALTITUDE_FT)
  const [verticalProfile, setVerticalProfile] = useState(null)
  const [crossSection, setCrossSection] = useState(null)
  const [verticalProfileLoading, setVerticalProfileLoading] = useState(false)
  const [verticalProfileError, setVerticalProfileError] = useState(null)
  const [verticalProfileStale, setVerticalProfileStale] = useState(false)
  const [verticalProfileWindowOpen, setVerticalProfileWindowOpen] = useState(false)
  const [editingVfrAltitudeIndex, setEditingVfrAltitudeIndex] = useState(null)
  const [vfrWaypoints, setVfrWaypoints] = useState([])
  // 되돌리기: 패널에서의 경유점 편집(추가/삭제/순서/전체고도) 직전 스냅샷 스택.
  const [vfrUndoStack, setVfrUndoStack] = useState([])
  const [hoveredWpInfo, setHoveredWpInfo] = useState(null)
  const [sidOptions, setSidOptions] = useState([])
  const [availableSidIds, setAvailableSidIds] = useState(null)
  const [starOptions, setStarOptions] = useState([])
  const [selectedSid, setSelectedSid] = useState(null)
  const [selectedStar, setSelectedStar] = useState(null)
  const [iapData, setIapData] = useState(null)
  const [iapCandidates, setIapCandidates] = useState([])
  const [selectedIapKey, setSelectedIapKey] = useState(null)
  const [firInOptions, setFirInOptions] = useState([])
  const [firExitOptions, setFirExitOptions] = useState([])
  const [navpointsById, setNavpointsById] = useState({})
  const [autoRecommendRequested, setAutoRecommendRequested] = useState(false)
  const [fitBoundsRequest, setFitBoundsRequest] = useState(null)

  const vfrWaypointsRef = useRef([])
  const lastVfrKeyRef = useRef('') // 자동 VFR 경로생성: 마지막으로 생성한 출발>도착 (중복 생성·경유점 리셋 방지)
  const hideTimerRef = useRef(null)
  const sidRequestRef = useRef(0)
  const starRequestRef = useRef(0)
  const iapRequestRef = useRef(0)
  const sidFilterRequestRef = useRef(0)
  const routeSearchRequestRef = useRef(0)
  const verticalProfileRequestRef = useRef(0)
  const fitBoundsRequestRef = useRef(0)

  const isFirInMode = routeForm.flightRule === 'IFR' && routeForm.departureAirport === FIR_IN_AIRPORT
  const isFirExitMode = routeForm.flightRule === 'IFR' && routeForm.arrivalAirport === FIR_EXIT_AIRPORT
  const selectedIap = iapData?.iapRoutes?.[selectedIapKey] ?? null
  const [alternateAirport, setAlternateAirport] = useState('')
  const [etd, setEtd] = useState(() => {
    // Absolute UTC instant; the ETD field renders/edits it in the app timezone.
    const d = new Date()
    d.setUTCSeconds(0, 0)
    return d.toISOString().replace('.000Z', 'Z')
  })
  const [cruiseSpeedKt, setCruiseSpeedKt] = useState(() => getLastUsed()?.tasKt ?? 120)
  const [briefing, setBriefing] = useState(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState(null)
  const visibleSidOptions = useMemo(() => buildVisibleSidOptions(sidOptions, availableSidIds), [availableSidIds, sidOptions])
  const routePreviewModel = useMemo(() => buildRoutePreviewModel({
    routeForm,
    routeResult,
    vfrWaypoints,
    selectedSid,
    selectedStar,
    selectedIap,
    navpointsById,
  }), [navpointsById, routeForm, routeResult, selectedIap, selectedSid, selectedStar, vfrWaypoints])

  useEffect(() => { vfrWaypointsRef.current = vfrWaypoints }, [vfrWaypoints])

  function clearRouteDisplay() {
    routeSearchRequestRef.current += 1
    verticalProfileRequestRef.current += 1
    setRouteResult(null)
    setRouteError(null)
    setRouteLoading(false)
    setVerticalProfile(null)
    setCrossSection(null)
    setVerticalProfileError(null)
    setVerticalProfileStale(false)
    setVerticalProfileWindowOpen(false)
    setVfrWaypoints([])
    setVfrUndoStack([])
    setFitBoundsRequest(null)
    setBriefing(null)
    setBriefingError(null)
  }

  useEffect(() => {
    const airport = routeForm.departureAirport
    const requestId = ++sidRequestRef.current
    if (!KNOWN_AIRPORTS.includes(airport)) { setSidOptions([]); setSelectedSid(null); return }
    getProcedures(airport, 'SID').then((procs) => {
      if (requestId !== sidRequestRef.current) return
      setSidOptions(procs)
      setSelectedSid(null)
    })
  }, [routeForm.departureAirport])

  useEffect(() => {
    const requestId = ++sidFilterRequestRef.current

    if (routeForm.flightRule !== 'IFR' || !routeForm.exitFix) {
      setAvailableSidIds(null)
      return
    }

    Promise.all(
      sidOptions.map(async (proc) => {
        const allowed = await canBuildBriefingRoutePath({
          entryFix: proc.enrouteFix,
          exitFix: routeForm.exitFix,
          routeType: routeForm.routeType,
        })
        return allowed ? proc.id : null
      }),
    )
      .then((ids) => {
        if (requestId !== sidFilterRequestRef.current) return
        const filteredIds = ids.filter(Boolean)
        setAvailableSidIds(filteredIds.length > 0 ? filteredIds : null)
        if (filteredIds.length > 0 && selectedSid && !filteredIds.includes(selectedSid.id)) {
          setSelectedSid(null)
        }
      })
      .catch(() => {
        if (requestId === sidFilterRequestRef.current) setAvailableSidIds(null)
      })
  }, [routeForm.flightRule, routeForm.exitFix, routeForm.routeType, sidOptions, selectedSid])

  useEffect(() => {
    const airport = routeForm.arrivalAirport
    const requestId = ++starRequestRef.current
    if (!KNOWN_AIRPORTS.includes(airport)) { setStarOptions([]); setSelectedStar(null); return }
    getProcedures(airport, 'STAR').then((procs) => {
      if (requestId !== starRequestRef.current) return
      setStarOptions(procs)
      setSelectedStar(null)
    })
  }, [routeForm.arrivalAirport])

  useEffect(() => {
    let cancelled = false

    loadRouteDirectionMetadata()
      .then((metadata) => {
        if (cancelled) return
        const options = buildBoundaryFixOptions(metadata)
        setFirInOptions(options.firInOptions)
        setFirExitOptions(options.firExitOptions)
      })
      .catch(() => {
        if (!cancelled) {
          setFirInOptions([])
          setFirExitOptions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadNavpoints()
      .then((navpoints) => {
        if (!cancelled) setNavpointsById(navpoints ?? {})
      })
      .catch(() => {
        if (!cancelled) setNavpointsById({})
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const airport = routeForm.arrivalAirport
    const requestId = ++iapRequestRef.current
    if (KNOWN_AIRPORTS.includes(airport)) {
      loadIapData(airport).then((data) => {
        if (requestId === iapRequestRef.current) setIapData(data)
      })
    } else {
      setIapData(null)
      setIapCandidates([])
      setSelectedIapKey(null)
    }
  }, [routeForm.arrivalAirport])

  useEffect(() => {
    if (!selectedStar || !iapData) {
      setIapCandidates([])
      setSelectedIapKey(null)
      return
    }
    const { candidates } = buildIapCandidates(selectedStar, iapData)
    setIapCandidates(candidates)
    setSelectedIapKey((current) => buildIapCandidates(selectedStar, iapData, current).selectedIapKey)
  }, [selectedStar, iapData])

  useEffect(() => {
    if (verticalProfile) {
      setVerticalProfileStale(true)
    }
  }, [selectedSid, selectedStar, selectedIapKey, vfrWaypoints])

  useEffect(() => {
    let cancelled = false

    if (
      activePanel !== 'route-check' ||
      routeForm.flightRule !== 'IFR' ||
      !autoRecommendRequested
    ) {
      return () => {
        cancelled = true
      }
    }

    const isDomesticDeparture = KNOWN_AIRPORTS.includes(routeForm.departureAirport)
    const isDomesticArrival = KNOWN_AIRPORTS.includes(routeForm.arrivalAirport)

    if (isFirInMode && !routeForm.entryFix) {
      return () => {
        cancelled = true
      }
    }

    if (isFirExitMode && !routeForm.exitFix) {
      return () => {
        cancelled = true
      }
    }

    if (
      !isFirInMode &&
      !isFirExitMode &&
      (!isDomesticDeparture || !isDomesticArrival || sidOptions.length === 0 || starOptions.length === 0 || !iapData)
    ) {
      return () => {
        cancelled = true
      }
    }

    if (isFirInMode && (!isDomesticArrival || starOptions.length === 0 || !iapData)) {
      return () => {
        cancelled = true
      }
    }

    if (isFirExitMode && (!isDomesticDeparture || sidOptions.length === 0)) {
      return () => {
        cancelled = true
      }
    }

    const departureCandidates = isFirInMode
      ? [{ sid: null, entryFix: routeForm.entryFix }]
      : filterProceduresByRunway(
          sidOptions,
          pickBestRunwayGroup(
            sidOptions.flatMap((proc) => proc.runways ?? []),
            getWindDirection(metarData, routeForm.departureAirport),
          ),
        ).map((sid) => ({ sid, entryFix: sid.enrouteFix ?? '' }))

    const arrivalRunwayGroup = pickBestRunwayGroup(
      starOptions
        .map((star) => iapData?.starToIapCandidates?.[star.id]?.runways ?? [])
        .flat(),
      getWindDirection(metarData, routeForm.arrivalAirport),
    )

    const arrivalCandidates = isFirExitMode
      ? [{ star: null, iapKey: null, exitFix: routeForm.exitFix }]
      : filterProceduresByRunway(
          starOptions
            .map((star) => {
              const entry = iapData.starToIapCandidates?.[star.id]
              return { star, entry, runways: entry?.runways ?? [] }
            })
            .filter(({ entry }) => entry),
          arrivalRunwayGroup,
        ).map(({ star, entry }) => ({
          star,
          iapKey: chooseIapKeyForRunway(entry, iapData, arrivalRunwayGroup),
          exitFix: star.startFix ?? '',
        }))

    Promise.all(
      departureCandidates.flatMap(({ sid, entryFix }) =>
        arrivalCandidates.map(async ({ star, iapKey, exitFix }) => {
          try {
            const result = await buildBriefingRoute({
              departureAirport: routeForm.departureAirport,
              arrivalAirport: routeForm.arrivalAirport,
              entryFix,
              exitFix,
              routeType: routeForm.routeType,
            })

            return {
              sid,
              star,
              iapKey,
              entryFix,
              exitFix,
              distanceNm: Number(result?.distanceNm) || Number.POSITIVE_INFINITY,
            }
          } catch {
            return null
          }
        }),
      ),
    ).then((results) => {
      if (cancelled) return

      const valid = results.filter(Boolean).sort((a, b) => a.distanceNm - b.distanceNm)
      const fallbackSid = departureCandidates[0] ?? null
      const fallbackArrival = arrivalCandidates[0] ?? null
      const best = valid[0] ?? (fallbackSid && fallbackArrival
        ? {
            sid: fallbackSid.sid ?? null,
            star: fallbackArrival.star,
            iapKey: fallbackArrival.iapKey,
            entryFix: fallbackSid.entryFix,
            exitFix: fallbackArrival.exitFix,
          }
        : null)

      if (!best) return

      setAutoRecommendRequested(false)
      setSelectedSid(best.sid ?? null)
      setSelectedStar(best.star ?? null)
      setSelectedIapKey(best.iapKey ?? null)
      setRouteForm((prev) => ({
        ...prev,
        entryFix: best.entryFix ?? prev.entryFix,
        exitFix: best.exitFix ?? prev.exitFix,
      }))
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [
    activePanel,
    iapData,
    isFirInMode,
    isFirExitMode,
    metarData,
    routeForm.arrivalAirport,
    routeForm.departureAirport,
    routeForm.entryFix,
    routeForm.exitFix,
    routeForm.flightRule,
    routeForm.routeType,
    sidOptions,
    starOptions,
    autoRecommendRequested,
  ])

  function updateRouteField(field, value) {
    setRouteForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleDepartureAirportChange(value) {
    clearRouteDisplay()
    updateRouteField('departureAirport', value)
    setSelectedSid(null)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAutoRecommendRequested(true)

    if (value === FIR_IN_AIRPORT) {
      updateRouteField('entryFix', '')
    }
  }

  function handleArrivalAirportChange(value) {
    clearRouteDisplay()
    updateRouteField('arrivalAirport', value)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAutoRecommendRequested(true)

    if (value === FIR_EXIT_AIRPORT) {
      updateRouteField('exitFix', '')
    }
  }

  function handleEntryFixChange(value) {
    clearRouteDisplay()
    updateRouteField('entryFix', value)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAutoRecommendRequested(true)
  }

  function handleExitFixChange(value) {
    clearRouteDisplay()
    updateRouteField('exitFix', value)
    setSelectedSid(null)
    setAutoRecommendRequested(true)
  }

  function switchFlightRule(rule) {
    setRouteForm((prev) => ({ ...prev, flightRule: rule }))
    clearRouteDisplay()
    setSelectedSid(null)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAutoRecommendRequested(true)
  }

  function handleAutoRecommend() {
    clearRouteDisplay()
    setSelectedSid(null)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAutoRecommendRequested(true)
  }

  function handleSidChange(proc) {
    clearRouteDisplay()
    setAutoRecommendRequested(false)
    setSelectedSid(proc)
    if (proc) updateRouteField('entryFix', proc.enrouteFix ?? '')
  }

  function handleStarChange(proc) {
    clearRouteDisplay()
    setAutoRecommendRequested(false)
    setSelectedStar(proc)
    if (proc) updateRouteField('exitFix', proc.startFix ?? '')
  }

  function handleIapChange(key) {
    clearRouteDisplay()
    setAutoRecommendRequested(false)
    setSelectedIapKey(key || null)
  }

  function handleRouteReset() {
    clearRouteDisplay()
    setRouteForm((prev) => ({ ...initialRouteForm, flightRule: prev.flightRule }))
    setSelectedSid(null)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAvailableSidIds(null)
    setAutoRecommendRequested(false)
  }

  // Snapshot the committed waypoints before a panel edit so 되돌리기 can restore.
  function snapshotVfr() {
    setVfrUndoStack((s) => [...s.slice(-19), vfrWaypointsRef.current])
  }

  function deleteVfrWaypoint(idx) {
    snapshotVfr()
    const next = relabeledWaypoints(vfrWaypoints.filter((_, i) => i !== idx))
    setVfrWaypoints(next)
    setHoveredWpInfo(null)
  }

  // 검색-추가: insert a named fix (airport/navaid) at its best segment position.
  function addVfrWaypointByFix(cand) {
    if (!cand || !Number.isFinite(cand.lon) || !Number.isFinite(cand.lat)) return
    snapshotVfr()
    setVfrWaypoints((prev) => {
      if (prev.length < 2) return prev
      const idx = findInsertIndex(prev, { lng: cand.lon, lat: cand.lat })
      const wp = { id: cand.id, uid: crypto.randomUUID(), lon: cand.lon, lat: cand.lat, named: true }
      return relabeledWaypoints([...prev.slice(0, idx), wp, ...prev.slice(idx)])
    })
  }

  // 드래그 시작 시 1회 스냅샷(되돌리기용). 드래그 중 매 단계 reorder는 스냅샷하지 않음.
  function beginVfrReorder() {
    snapshotVfr()
  }

  // 순서 변경: 비고정 경유점만(고정 출/도착은 양끝 유지). to는 [1, len-2]로 클램프.
  // 드래그 중 라이브로 여러 번 호출되므로 스냅샷은 beginVfrReorder에서 1회만.
  function reorderVfrWaypoint(from, to) {
    setVfrWaypoints((prev) => {
      if (from < 0 || from >= prev.length || prev[from]?.fixed) return prev
      const lastMid = prev.length - 2
      const target = Math.max(1, Math.min(lastMid, to))
      if (target === from) return prev
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(target, 0, moved)
      return relabeledWaypoints(arr)
    })
  }

  function undoVfrWaypoints() {
    if (vfrUndoStack.length === 0) return
    const prev = vfrUndoStack[vfrUndoStack.length - 1]
    setVfrUndoStack((s) => s.slice(0, -1))
    setVfrWaypoints(prev)
    setHoveredWpInfo(null)
  }

  // Core search by explicit form (so 불러오기 can search the saved form without
  // waiting for a setRouteForm state flush). Returns the result or null.
  async function runRouteSearch(form) {
    const requestId = ++routeSearchRequestRef.current
    setRouteLoading(true)
    setRouteError(null)
    setVfrUndoStack([])
    setVerticalProfile(null)
    setCrossSection(null)
    setVerticalProfileError(null)
    setVerticalProfileStale(false)
    setVerticalProfileWindowOpen(false)
    setBriefing(null)
    setBriefingError(null)
    try {
      const result = form.flightRule === 'VFR'
        ? await buildVfrRoute(form)
        : await buildBriefingRoute(form)
      if (requestId !== routeSearchRequestRef.current) return null
      setRouteResult(result)
      if (result.flightRule === 'VFR') {
        const initialWaypoints = buildInitialVfrWaypoints(result, airports)
        setVfrWaypoints(initialWaypoints)
        const coords = initialWaypoints.map((wp) => [wp.lon, wp.lat])
        if (coords.length > 0) {
          setFitBoundsRequest({ id: ++fitBoundsRequestRef.current, coordinates: coords, maxZoom: 8 })
        }
      } else {
        setVfrWaypoints([])
        const routeGeometry = getCurrentRouteLineString({
          routeResult: result,
          vfrWaypoints: [],
          selectedSid,
          selectedStar,
          selectedIap,
        })
        const coords = routeGeometry?.coordinates ?? []
        if (coords.length > 0) {
          setFitBoundsRequest({ id: ++fitBoundsRequestRef.current, coordinates: coords, maxZoom: 8 })
        }
      }
      return result
    } catch (err) {
      if (requestId !== routeSearchRequestRef.current) return null
      setRouteResult(null)
      setRouteError(err.message)
      return null
    } finally {
      if (requestId === routeSearchRequestRef.current) setRouteLoading(false)
    }
  }

  async function handleRouteSearch(e) {
    e.preventDefault()
    return runRouteSearch(routeForm)
  }

  // VFR: 출발·도착이 모두 정해지거나 바뀌면 경로를 자동 생성한다(직선 dep→arr이라 명시적 "검색" 불필요).
  // 같은 dep/arr면 재생성하지 않아 경유점이 보존됨 — 무심코 검색해 경유점이 날아가는 footgun 제거.
  // 불러오기(loadSavedRoute)는 자체 re-search+overlay를 하므로 키를 선점해 이 effect를 건너뛴다.
  useEffect(() => {
    if (routeForm.flightRule !== 'VFR') { lastVfrKeyRef.current = ''; return }
    const dep = routeForm.departureAirport
    const arr = routeForm.arrivalAirport
    if (!dep || !arr) { lastVfrKeyRef.current = ''; return }
    const key = `${dep}>${arr}`
    if (key === lastVfrKeyRef.current) return
    lastVfrKeyRef.current = key
    runRouteSearch(routeForm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeForm.flightRule, routeForm.departureAirport, routeForm.arrivalAirport])

  // 불러오기: restore saved inputs, re-search, then overlay saved VFR waypoints.
  async function loadSavedRoute(saved) {
    if (!saved?.routeForm) return
    // 자동 VFR 생성 effect가 이 dep/arr에 또 발동해 overlay를 덮지 않도록 키 선점.
    lastVfrKeyRef.current = `${saved.routeForm.departureAirport}>${saved.routeForm.arrivalAirport}`
    clearRouteDisplay()
    setRouteForm(saved.routeForm)
    setSelectedSid(null)
    setSelectedStar(null)
    setIapCandidates([])
    setSelectedIapKey(null)
    setAvailableSidIds(null)
    setAutoRecommendRequested(false)
    if (Number.isFinite(Number(saved.cruiseAltitudeFt))) setCruiseAltitudeFt(Number(saved.cruiseAltitudeFt))
    setAlternateAirport(saved.alternateAirport || '')
    if (saved.etd) setEtd(saved.etd)
    const result = await runRouteSearch(saved.routeForm)
    if (result?.flightRule === 'VFR' && Array.isArray(saved.vfrWaypoints) && saved.vfrWaypoints.length >= 2) {
      // Backfill uid for routes saved before uids existed (stable React keys).
      setVfrWaypoints(saved.vfrWaypoints.map((wp) => (wp.uid ? wp : { ...wp, uid: crypto.randomUUID() })))
    }
  }

  function updateVfrWaypointAltitude(idx, value) {
    setVfrWaypoints((prev) => prev.map((wp, i) => (
      i === idx ? { ...wp, altitudeFt: value } : wp
    )))
  }

  function applyCruiseAltitudeToVfrWaypoints() {
    const plannedCruiseAltitudeFt = Number(cruiseAltitudeFt)
    if (!Number.isFinite(plannedCruiseAltitudeFt) || plannedCruiseAltitudeFt <= 0) return
    snapshotVfr()
    setVfrWaypoints((prev) => prev.map((wp) => {
      if (!wp.fixed) return { ...wp, altitudeFt: Math.round(plannedCruiseAltitudeFt) }
      const airportElevationFt = getVfrAirportAltitudeFt(airports, wp)
      return { ...wp, airportElevationFt, altitudeFt: airportElevationFt }
    }))
  }

  async function handleVerticalProfileRequest() {
    const routeGeometry = getCurrentRouteLineString({
      routeResult,
      vfrWaypoints,
      selectedSid,
      selectedStar,
      selectedIap,
    })
    const plannedCruiseAltitudeFt = Number(cruiseAltitudeFt)

    if (!routeGeometry) {
      setVerticalProfileError('\uc5f0\uc9c1\ub2e8\uba74\ub3c4\ub97c \uc0dd\uc131\ud560 \uacbd\ub85c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.')
      return
    }

    if (!Number.isFinite(plannedCruiseAltitudeFt) || plannedCruiseAltitudeFt <= 0) {
      setVerticalProfileError('\uc21c\ud56d\uace0\ub3c4\ub97c 0\ubcf4\ub2e4 \ud070 ft \uac12\uc73c\ub85c \uc785\ub825\ud574\uc8fc\uc138\uc694.')
      return
    }

    const requestId = ++verticalProfileRequestRef.current
    setVerticalProfileLoading(true)
    setVerticalProfileError(null)
    try {
      const [profile, cs] = await Promise.all([
        fetchVerticalProfile(buildVerticalProfileRequest({
          routeGeometry,
          routeResult,
          selectedSid,
          selectedStar,
          selectedIap,
          vfrWaypoints,
          plannedCruiseAltitudeFt,
        })),
        fetchCrossSection({ routeGeometry }).catch(() => null),
      ])
      if (requestId !== verticalProfileRequestRef.current) return
      setVerticalProfile(profile)
      setCrossSection(cs)
      setVerticalProfileStale(false)
      setVerticalProfileWindowOpen(true)
    } catch (err) {
      if (requestId === verticalProfileRequestRef.current) setVerticalProfileError(err.message)
    } finally {
      if (requestId === verticalProfileRequestRef.current) setVerticalProfileLoading(false)
    }
  }

  // Planned total distance (IFR total incl SID/STAR/IAP; VFR waypoint-summed).
  // Shared by 브리핑 생성 and the live ETA readout in the form.
  const plannedDistanceNm = useMemo(() => {
    if (!routeResult) return 0
    return routeForm.flightRule === 'VFR'
      ? calcVfrDistance(vfrWaypoints)
      : (buildIfrDistanceBreakdown({ routeResult, selectedSid, selectedStar, selectedIap })?.totalDistanceNm
          || Number(routeResult?.distanceNm) || 0)
  }, [routeResult, routeForm.flightRule, vfrWaypoints, selectedSid, selectedStar, selectedIap])

  // dep→arr magnetic course (for the VFR cruising-altitude hint). Hint only.
  const magCourseDeg = useMemo(() => {
    const dep = airports.find((a) => a.icao === routeForm.departureAirport)
    const arr = airports.find((a) => a.icao === routeForm.arrivalAirport)
    if (!dep || !arr || !Number.isFinite(dep.lat) || !Number.isFinite(arr.lat)) return null
    return magneticCourse(initialBearingDeg(dep.lat, dep.lon, arr.lat, arr.lon))
  }, [airports, routeForm.departureAirport, routeForm.arrivalAirport])

  // 항로 상태 배지: 출/도/교체 공항 중 최악 flight category + 활성 공항경보 여부.
  const routeStatus = useMemo(() => {
    const icaos = [routeForm.departureAirport, routeForm.arrivalAirport, alternateAirport].filter(Boolean)
    if (icaos.length === 0) return null

    let worstCategory = null
    for (const icao of icaos) {
      const airport = airports.find((a) => a.icao === icao)
      const metar = metarData?.airports?.[icao] || null
      const { flightCategory } = buildAirportStationMarkerModel({ airport, metar })
      if (worstCategory == null || CATEGORY_WORST_ORDER.indexOf(flightCategory) < CATEGORY_WORST_ORDER.indexOf(worstCategory)) {
        worstCategory = flightCategory
      }
    }

    const warnedIcaos = icaos.filter((icao) => warnedAirports.includes(icao))
    return {
      worstCategory,
      categoryMeta: FLIGHT_CATEGORY_META[worstCategory] || null,
      warned: warnedIcaos.length > 0,
      warnedIcaos,
    }
  }, [routeForm.departureAirport, routeForm.arrivalAirport, alternateAirport, airports, metarData, warnedAirports])

  async function handleGenerateBriefing() {
    const routeGeometry = getCurrentRouteLineString({ routeResult, vfrWaypoints, selectedSid, selectedStar, selectedIap })
    if (!routeGeometry) { setBriefingError('먼저 경로를 검색하세요.'); return }
    const distanceNm = plannedDistanceNm
    const etdIso = new Date(etd).toISOString().replace('.000Z', 'Z')
    const etaIso = computeEtaIso(etdIso, distanceNm, cruiseSpeedKt) || etdIso
    setBriefingLoading(true); setBriefingError(null)
    try {
      const result = await fetchRouteBriefing({
        flightRule: routeForm.flightRule,
        departureAirport: routeForm.departureAirport,
        arrivalAirport: routeForm.arrivalAirport,
        alternateAirport: alternateAirport || null,
        routeGeometry,
        etd: etdIso,
        eta: etaIso,
        plannedCruiseAltitudeFt: Number(cruiseAltitudeFt) || DEFAULT_CRUISE_ALTITUDE_FT,
      })
      setBriefing(result)
      // also load profile + cross-section so ④ can render the inline 단면도 (best-effort)
      try {
        const plannedCruiseAltitudeFt = Number(cruiseAltitudeFt) || DEFAULT_CRUISE_ALTITUDE_FT
        const [profile, cs] = await Promise.all([
          fetchVerticalProfile(buildVerticalProfileRequest({
            routeGeometry, routeResult, selectedSid, selectedStar, selectedIap, vfrWaypoints, plannedCruiseAltitudeFt,
          })),
          fetchCrossSection({ routeGeometry }).catch(() => null),
        ])
        setVerticalProfile(profile)
        setCrossSection(cs)
      } catch { /* inline 단면도 optional */ }
    } catch (err) { setBriefingError(err.message) }
    finally { setBriefingLoading(false) }
  }

  return {
    state: {
      routeForm,
      routeResult,
      routeError,
      routeLoading,
      cruiseAltitudeFt,
      verticalProfile,
      crossSection,
      verticalProfileLoading,
      verticalProfileError,
      verticalProfileStale,
      verticalProfileWindowOpen,
      editingVfrAltitudeIndex,
      vfrWaypoints,
      hoveredWpInfo,
      sidOptions,
      availableSidIds,
      starOptions,
      selectedSid,
      selectedStar,
      iapData,
      iapCandidates,
      selectedIapKey,
      firInOptions,
      firExitOptions,
      navpointsById,
      autoRecommendRequested,
      fitBoundsRequest,
      alternateAirport,
      etd,
      cruiseSpeedKt,
      briefing,
      briefingLoading,
      briefingError,
    },
    refs: {
      vfrWaypointsRef,
      hideTimerRef,
    },
    derived: {
      isFirInMode,
      isFirExitMode,
      selectedIap,
      visibleSidOptions,
      plannedDistanceNm,
      magCourseDeg,
      routeStatus,
      canUndoVfr: vfrUndoStack.length > 0,
    },
    actions: {
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
      addVfrWaypointByFix,
      beginVfrReorder,
      reorderVfrWaypoint,
      undoVfrWaypoints,
      handleRouteSearch,
      loadSavedRoute,
      updateVfrWaypointAltitude,
      applyCruiseAltitudeToVfrWaypoints,
      handleVerticalProfileRequest,
      setHoveredWpInfo,
      setEditingVfrAltitudeIndex,
      setVerticalProfileWindowOpen,
      setCruiseAltitudeFt,
      setVfrWaypoints,
      setAlternateAirport,
      setEtd,
      setCruiseSpeedKt,
      handleGenerateBriefing,
      setBriefing,
    },
    routePreviewModel,
  }
}
