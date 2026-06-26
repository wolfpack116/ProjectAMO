import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTimeZone } from '../../shared/timezone/TimeZoneContext.jsx'
import useIsMobile from '../../shared/ui/useIsMobile.js'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_CONFIG, BASEMAP_OPTIONS } from './mapConfig.js'
import { addAviationWfsLayers } from '../aviation-layers/addAviationWfsLayers.js'
import { AVIATION_WFS_LAYERS } from '../aviation-layers/aviationWfsLayers.js'
import {
  ADVISORY_LAYER_DEFS,
} from '../weather-overlays/lib/advisoryLayers.js'
import { ADSB_FETCH_DISABLED, fetchAdsbData } from '../../api/adsbApi.js'
import { fetchSigwxCloudMeta, fetchSigwxFrontMeta } from '../../api/weatherApi.js'
import { addAdsbLayers, bindAdsbHover, createAdsbGeoJSON, createAdsbTrailGeoJSON, syncAdsbLayer } from '../aviation-layers/addAdsbLayer.js'
import { registerAircraftImages } from '../aviation-layers/aircraftIconImages.js'
import { registerAirlineLogos } from '../aviation-layers/airlineLogoImages.js'
import AviationLayerPanel from '../aviation-layers/AviationLayerPanel.jsx'
import { SIGWX_FILTER_OPTIONS } from '../weather-overlays/lib/sigwxData.js'
import AdvisoryBadges from '../weather-overlays/AdvisoryBadges.jsx'
import AdsbTimestamp from '../weather-overlays/AdsbTimestamp.jsx'
import SigwxHistoryBar from '../weather-overlays/SigwxHistoryBar.jsx'
import SigwxLegendDialog from '../weather-overlays/SigwxLegendDialog.jsx'
import WeatherTimelineBar from '../weather-overlays/WeatherTimelineBar.jsx'
import WeatherLegends from '../weather-overlays/WeatherLegends.jsx'
import WeatherOverlayPanel from '../weather-overlays/WeatherOverlayPanel.jsx'
import NwpSliderBar from '../weather-overlays/NwpSliderBar.jsx'
import WeatherLayerTimestampBar from '../weather-overlays/WeatherLayerTimestampBar.jsx'
import { useNwpOverlays } from '../weather-overlays/lib/useNwpOverlays.js'
import { destroyWindOverlay, syncWindOverlay } from '../weather-overlays/lib/windOverlaySync.js'
import { WIND_SPEED_COLOR_RAMP } from '../weather-overlays/lib/windField.js'
import { CELSIUS_TEMPERATURE_COLOR_RAMP } from '../weather-overlays/lib/temperatureField.js'
import { destroyTemperatureOverlay, syncTemperatureOverlay } from '../weather-overlays/lib/temperatureOverlaySync.js'
import { CLOUD_POTENTIAL_COLOR_RAMP } from '../weather-overlays/lib/cloudPotentialField.js'
import { destroyCloudPotentialOverlay, syncCloudPotentialOverlay } from '../weather-overlays/lib/cloudPotentialOverlaySync.js'
import { ICING_COLOR_RAMP } from '../weather-overlays/lib/icingPotentialField.js'
import { destroyIcingPotentialOverlay, syncIcingPotentialOverlay } from '../weather-overlays/lib/icingPotentialOverlaySync.js'
import { KTG_COLOR_RAMP } from '../weather-overlays/lib/ktgTurbulenceField.js'
import { destroyKtgTurbulenceOverlay, syncKtgTurbulenceOverlay } from '../weather-overlays/lib/ktgTurbulenceOverlaySync.js'
import { getNextMetVisibility } from '../weather-overlays/lib/metLayerVisibility.js'
import {
  LIGHTNING_BLINK_INTERVAL_MS,
} from '../weather-overlays/lib/lightningLayers.js'
import {
  MET_LAYERS,
  RADAR_RAINRATE_LEGEND,
  installWeatherOverlayLayers,
  syncAdvisoryLayers,
  syncLightningLayers,
  syncRasterAndSigwxLayers,
} from '../weather-overlays/lib/weatherOverlayLayers.js'
import {
  buildWeatherOverlayModel,
  formatReferenceTimeLabel,
} from '../weather-overlays/lib/weatherOverlayModel.js'
import {
  getPlaybackDelayMs,
} from '../weather-overlays/lib/weatherTimeline.js'
import { useFlightCategory } from '../weather-overlays/lib/useFlightCategory.js'
import {
  addFlightCategoryLayer,
  bindFlightCategoryClick,
  removeFlightCategoryLayer,
  syncFlightCategoryLayer,
} from '../weather-overlays/lib/flightCategoryLayers.js'
import BasemapSwitcher from './basemapSwitcher/BasemapSwitcher.jsx'
import { setLayerVisibility } from './lib/mapLayerUtils.js'
import { bindLayerEvent, cleanupAll } from './lib/mapStyleSync.js'
import {
  AIRPORT_CIRCLE_LAYER,
  AIRPORT_INTERACTIVE_LAYERS,
  AIRPORT_STATION_CENTER_LAYER,
  AIRPORT_SOURCE_ID,
  addAirportLayers,
  addGeoBoundaryLayers,
  createAirportGeoJSON,
  setGeoBoundaryVisibility,
  shouldShowGeoBoundaries,
} from './lib/baseMapLayers.js'
import {
  registerAirportStationImages,
  registerAirportWeatherImages,
  registerAirportWindBarbImages,
} from './lib/airportStationImages.js'
import {
  VFR_WP_CIRCLE,
  bindVfrInteractions,
} from '../route-briefing/lib/routePreview.js'
import {
  clearRoutePreviewLayers,
  installRoutePreviewLayers,
  syncBoundaryFixPreview,
  syncRoutePreviewLayers,
  syncVfrWaypointData,
} from '../route-briefing/lib/routePreviewSync.js'
import { useRouteBriefing } from '../route-briefing/useRouteBriefing.js'
import AirportTooltip from './AirportTooltip.jsx'
import './MapView.css'

const RouteBriefingPanel = lazy(() => import('../route-briefing/RouteBriefingPanel.jsx'))
const VerticalProfileWindow = lazy(() => import('../route-briefing/VerticalProfileWindow.jsx'))
const BriefingView = lazy(() => import('../route-briefing/BriefingView.jsx'))

// ???? Constants ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

const ROAD_VISIBILITY_ZOOM = 8
const ADSB_POLL_INTERVAL_MS = 90 * 1000
const HIDDEN_ROAD_COLOR = 'rgba(255,255,255,0.2)'
const VISIBLE_ROAD_COLORS = { roads: '#d6dde6', trunks: '#c6d1dd', motorways: '#b9c7d4' }

// ???? Helpers ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function applyRoadVisibility(map, show) {
  map.setConfigProperty('basemap', 'colorRoads', show ? VISIBLE_ROAD_COLORS.roads : HIDDEN_ROAD_COLOR)
  map.setConfigProperty('basemap', 'colorTrunks', show ? VISIBLE_ROAD_COLORS.trunks : HIDDEN_ROAD_COLOR)
  map.setConfigProperty('basemap', 'colorMotorways', show ? VISIBLE_ROAD_COLORS.motorways : HIDDEN_ROAD_COLOR)
}

// ???? Initial state factories ??????????????????????????????????????????????????????????????????????????????????????????????????????

function initAviationVisibility() {
  return AVIATION_WFS_LAYERS.reduce((acc, l) => { acc[l.id] = l.defaultVisible; return acc }, {})
}

function initMetVisibility() {
  const visibility = MET_LAYERS.reduce((acc, l) => { acc[l.id] = false; return acc }, {})
  visibility.windFlow = true
  visibility.windSpeed = true
  return visibility
}

function bindSectorHover(map) {
  const sector = AVIATION_WFS_LAYERS.find((l) => l.id === 'sector')
  if (!sector?.fillLayerId || !sector.hoverLayerId) return null

  const onMouseMove = (e) => {
    const ids = [...new Set(e.features.map((f) => f.properties.sectorId).filter(Boolean))]
    map.getCanvas().style.cursor = ids.length > 0 ? 'pointer' : ''
    map.setFilter(sector.hoverLayerId, ['in', ['get', 'sectorId'], ['literal', ids]])
  }
  const onMouseLeave = () => {
    map.getCanvas().style.cursor = ''
    map.setFilter(sector.hoverLayerId, ['in', ['get', 'sectorId'], ['literal', []]])
  }

  const cleanups = [
    bindLayerEvent(map, 'mousemove', sector.fillLayerId, onMouseMove),
    bindLayerEvent(map, 'mouseleave', sector.fillLayerId, onMouseLeave),
  ]
  return () => cleanupAll(cleanups)
}

// ???? Lightning layers ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

// ???? Component ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function MapView({
  activePanel,
  airports = [],
  metarData = null,
  echoMeta = null,
  satMeta = null,
  sigmetData = null,
  airmetData = null,
  lightningData = null,
  sigwxLowData = null,
  sigwxLowHistoryData = null,
  sigwxFrontMeta = null,
  sigwxCloudMeta = null,
  selectedAirport,
  onAirportSelect,
  onRequestDeferredWeatherData,
  onLayerCountsChange,
  onClosePanel,
  enableWindOverlay = true,
}) {
  const isMobile = useIsMobile()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const onSelectRef = useRef(onAirportSelect)
  const tooltipTimerRef = useRef(null)
  const tooltipIcaoRef = useRef(null)
  const [hoveredAirportIcao, setHoveredAirportIcao] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const airportEventCleanupRef = useRef([])
  const { tz } = useTimeZone()
  const advisoryEventCleanupRef = useRef([])
  const adsbEventCleanupRef = useRef(null)
  const sectorEventCleanupRef = useRef(null)
  const [error, setError] = useState(null)
  const [isStyleReady, setIsStyleReady] = useState(false)
  const [styleRevision, setStyleRevision] = useState(0)
  const [aviationVisibility, setAviationVisibility] = useState(initAviationVisibility)
  const [metVisibility, setMetVisibility] = useState(initMetVisibility)
  const [blinkLightning, setBlinkLightning] = useState(false)
  const [lightningBlinkOff, setLightningBlinkOff] = useState(false)
  const [lightningReferenceTimeMs, setLightningReferenceTimeMs] = useState(() => Date.now())
  const [weatherTimelineIndex, setWeatherTimelineIndex] = useState(-1)
  const [weatherTimelinePlaying, setWeatherTimelinePlaying] = useState(false)
  const [weatherTimelineSpeed, setWeatherTimelineSpeed] = useState(1)
  const [windFlowOpacity, setWindFlowOpacity] = useState(0.8)
  const [windFlowTrail, setWindFlowTrail] = useState(0.9)
  const [windFlowWidth, setWindFlowWidth] = useState(1.5)
  const [sigwxHistoryIndex, setSigwxHistoryIndex] = useState(0)
  const [sigwxLegendOpen, setSigwxLegendOpen] = useState(false)
  const [openAdvisoryPanel, setOpenAdvisoryPanel] = useState(null)
  const [sigwxFilter, setSigwxFilter] = useState(() => Object.fromEntries(SIGWX_FILTER_OPTIONS.map((option) => [option.key, true])))
  const [hiddenAdvisoryKeys, setHiddenAdvisoryKeys] = useState({ sigwxLow: [], sigmet: [], airmet: [] })
  const [selectedSigwxFrontMeta, setSelectedSigwxFrontMeta] = useState(sigwxFrontMeta)
  const [selectedSigwxCloudMeta, setSelectedSigwxCloudMeta] = useState(sigwxCloudMeta)
  const [adsbData, setAdsbData] = useState(null)
  const [adsbLoading, setAdsbLoading] = useState(false)
  const [basemapId, setBasemapId] = useState('standard')
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false)
  const [routeBriefingMapMode, setRouteBriefingMapMode] = useState(false)
  const routeBriefing = useRouteBriefing({ activePanel, airports, metarData })
  const { routeResult, fitBoundsRequest } = routeBriefing.state
  const { vfrWaypointsRef, hideTimerRef } = routeBriefing.refs
  const { setHoveredWpInfo, setVfrWaypoints } = routeBriefing.actions
  const { routePreviewModel } = routeBriefing
  const { geojson: flightCategoryGeojson } = useFlightCategory()
  const fcPopupRef = useRef(null)
  const {
    windField, windRendererOptions, temperatureField, cloudField, icingField, ktgGrid,
    windStatus, tempStatus, cloudStatus, icingStatus, turbulenceStatus,
    lowPower, cloudMaxSpread,
    altLevelsFt, selectedAltFt, setSelectedAltFt,
    sliderLevels, sliderTimes, sliderAvailability, nwpSelection, setNwpSelection,
  } = useNwpOverlays({ enableWindOverlay, metVisibility, windFlowOpacity, windFlowTrail, windFlowWidth })

  useEffect(() => { onSelectRef.current = onAirportSelect }, [onAirportSelect])

  useEffect(() => {
    if (activePanel !== 'route-check') setRouteBriefingMapMode(false)
  }, [activePanel])

  useEffect(() => {
    const timer = window.setInterval(() => setLightningReferenceTimeMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!metVisibility.lightning || !blinkLightning) {
      setLightningBlinkOff(false)
      return undefined
    }
    const timer = window.setInterval(() => {
      setLightningBlinkOff((prev) => !prev)
    }, LIGHTNING_BLINK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [metVisibility.lightning, blinkLightning])

  useEffect(() => {
    if (!metVisibility.sigwx) {
      setSigwxLegendOpen(false)
    }
  }, [metVisibility.sigwx])

  // ???? Procedure preview on map ????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    const { fitCoordinates } = syncRoutePreviewLayers(map, routePreviewModel)
    if (fitCoordinates.length > 0 && !routeResult) {
      const bounds = fitCoordinates.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(fitCoordinates[0], fitCoordinates[0]))
      map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 500 })
    }
  }, [routePreviewModel, routeResult, isStyleReady, styleRevision])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return

    const { fitCoordinates } = syncBoundaryFixPreview(map, routePreviewModel)
    if (fitCoordinates.length > 0 && !routeResult) {
      const bounds = fitCoordinates.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(fitCoordinates[0], fitCoordinates[0]))
      map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 500 })
    }
  }, [routePreviewModel, isStyleReady, routeResult, styleRevision])

  useEffect(() => {
    const map = mapRef.current
    const coords = fitBoundsRequest?.coordinates ?? []
    if (!map || !isStyleReady || coords.length === 0) return
    const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]))
    map.fitBounds(bounds, { padding: 80, maxZoom: fitBoundsRequest.maxZoom ?? 8, duration: 500 })
  }, [fitBoundsRequest, isStyleReady, styleRevision])

  // Scroll-sync: pan/zoom the live map to the active briefing section's spatial target.
  function focusBriefingSection(id) {
    const map = mapRef.current
    if (!map) return
    const meta = routeBriefing.state.briefing?.meta
    const byIcao = (icao) => airports.find((a) => a.icao === icao)
    const padRight = Math.min(680, Math.round((map.getContainer()?.clientWidth || 1200) * 0.46))
    const pad = { top: 60, bottom: 60, left: 60, right: padRight }
    const fitPts = (pts) => {
      if (pts.length < 1) return
      const bounds = pts.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(pts[0], pts[0]))
      map.fitBounds(bounds, { padding: pad, maxZoom: 8, duration: 600 })
    }
    if (id === 'destination') {
      const ap = byIcao(meta?.arrivalAirport)
      if (ap) map.flyTo({ center: [ap.lon, ap.lat], zoom: 8.5, padding: pad, duration: 600 })
    } else if (id === 'current') {
      fitPts([meta?.departureAirport, meta?.arrivalAirport, meta?.alternateAirport]
        .map(byIcao).filter(Boolean).map((a) => [a.lon, a.lat]))
    } else {
      const samples = routeBriefing.state.verticalProfile?.axis?.samples ?? []
      fitPts(samples.map((s) => [s.lon, s.lat]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])))
    }
  }

  const airportGeoJSON = useMemo(
    () => createAirportGeoJSON(airports, metarData),
    [airports, metarData],
  )
  const airportWeatherImageIds = useMemo(
    () => [...new Set(airportGeoJSON.features.map((feature) => feature.properties.weatherIconId).filter(Boolean))],
    [airportGeoJSON],
  )
  const adsbGeoJSON = useMemo(() => createAdsbGeoJSON(adsbData), [adsbData])
  const adsbTrailGeoJSON = useMemo(() => createAdsbTrailGeoJSON(adsbData), [adsbData])
  const weatherOverlayModel = useMemo(() => buildWeatherOverlayModel({
    echoMeta,
    satMeta,
    lightningData,
    sigwxLowData,
    sigwxLowHistoryData,
    sigmetData,
    airmetData,
    visibility: metVisibility,
    weatherTimelineIndex,
    sigwxHistoryIndex,
    sigwxFilter,
    hiddenAdvisoryKeys,
    selectedSigwxFrontMeta,
    selectedSigwxCloudMeta,
    lightningReferenceTimeMs,
    nwpSelection,
    ktgGrid,
    flightCategoryGeojson,
    tz,
  }), [
    echoMeta,
    satMeta,
    lightningData,
    sigwxLowData,
    sigwxLowHistoryData,
    sigmetData,
    airmetData,
    metVisibility,
    weatherTimelineIndex,
    sigwxHistoryIndex,
    sigwxFilter,
    hiddenAdvisoryKeys,
    selectedSigwxFrontMeta,
    selectedSigwxCloudMeta,
    lightningReferenceTimeMs,
    nwpSelection,
    ktgGrid,
    flightCategoryGeojson,
    tz,
  ])
  const {
    radarFrames,
    satelliteFrames,
    weatherTimelineTicks,
    effectiveWeatherTimelineIndex,
    selectedWeatherTimeMs,
    weatherTimelineVisible,
    sigwxHistoryEntries,
    selectedSigwxEntry,
    sigwxGroups,
    sigmetItems,
    airmetItems,
    advisoryBadgeItems,
    sigmetCount,
    airmetCount,
    sigwxCount,
    lightningCount,
    radarLegendVisible,
    lightningLegendVisible,
    lightningLegendEntries,
    radarReferenceTimeMs,
    sigwxIssueLabel,
    sigwxValidLabel,
    nwpIssueLabel,
    nwpValidLabel,
    ktgIssueLabel,
    ktgValidLabel,
    flightCategoryIssueLabel,
  } = weatherOverlayModel
  const advisoryPanelItems = useMemo(() => {
    if (openAdvisoryPanel === 'sigwxLow') return sigwxGroups
    if (openAdvisoryPanel === 'sigmet') return sigmetItems
    if (openAdvisoryPanel === 'airmet') return airmetItems
    return []
  }, [openAdvisoryPanel, sigwxGroups, sigmetItems, airmetItems])

  const timestampEntries = useMemo(() => {
    const entries = []
    if (enableWindOverlay && metVisibility.wind)
      entries.push({ key: 'wind', label: 'Wind', issueLabel: nwpIssueLabel, validLabel: nwpValidLabel })
    if (enableWindOverlay && metVisibility.temp)
      entries.push({ key: 'temp', label: 'Temp', issueLabel: nwpIssueLabel, validLabel: nwpValidLabel })
    if (enableWindOverlay && metVisibility.cloud)
      entries.push({ key: 'cloud', label: 'Moisture', issueLabel: nwpIssueLabel, validLabel: nwpValidLabel })
    if (enableWindOverlay && metVisibility.icing)
      entries.push({ key: 'icing', label: 'Icing', issueLabel: nwpIssueLabel, validLabel: nwpValidLabel })
    if (enableWindOverlay && metVisibility.turbulence)
      entries.push({ key: 'turbulence', label: 'Turbulence', issueLabel: ktgIssueLabel, validLabel: ktgValidLabel })
    if (metVisibility.flightCategory)
      entries.push({ key: 'flightCategory', label: '비행기상구역', issueLabel: flightCategoryIssueLabel })
    return entries
  }, [
    enableWindOverlay,
    metVisibility.wind, metVisibility.temp, metVisibility.cloud,
    metVisibility.icing, metVisibility.turbulence, metVisibility.flightCategory,
    nwpIssueLabel, nwpValidLabel, ktgIssueLabel, ktgValidLabel, flightCategoryIssueLabel,
  ])

  useEffect(() => {
    const tickCount = weatherTimelineTicks.length
    if (tickCount === 0) {
      setWeatherTimelinePlaying(false)
      setWeatherTimelineIndex(-1)
      return
    }

    setWeatherTimelineIndex((prev) => {
      if (prev >= tickCount) {
        return tickCount - 1
      }
      return prev
    })
  }, [weatherTimelineTicks.length])

  useEffect(() => {
    if (!weatherTimelineVisible || !weatherTimelinePlaying || weatherTimelineTicks.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setWeatherTimelineIndex((prev) => {
        const baseIndex = prev >= 0 ? prev : weatherTimelineTicks.length - 1
        return baseIndex >= weatherTimelineTicks.length - 1 ? 0 : baseIndex + 1
      })
    }, getPlaybackDelayMs(weatherTimelineSpeed))
    return () => window.clearInterval(timer)
  }, [weatherTimelineVisible, weatherTimelinePlaying, weatherTimelineTicks.length, weatherTimelineSpeed])

  useEffect(() => {
    if (sigwxHistoryIndex >= sigwxHistoryEntries.length) {
      setSigwxHistoryIndex(0)
    }
  }, [sigwxHistoryEntries.length, sigwxHistoryIndex])

  useEffect(() => {
    const selectedTmfc = selectedSigwxEntry?.tmfc
    if (!selectedTmfc) {
      setSelectedSigwxFrontMeta(null)
      setSelectedSigwxCloudMeta(null)
      return
    }

    let cancelled = false
    const isLatestTmfc = selectedTmfc === sigwxLowData?.tmfc

    async function loadSigwxMeta() {
      if (isLatestTmfc) {
        setSelectedSigwxFrontMeta(sigwxFrontMeta)
        setSelectedSigwxCloudMeta(sigwxCloudMeta)
      } else {
        setSelectedSigwxFrontMeta(null)
        setSelectedSigwxCloudMeta(null)
      }

      const [frontMeta, cloudMeta] = await Promise.all([
        fetchSigwxFrontMeta(selectedTmfc).catch(() => null),
        fetchSigwxCloudMeta(selectedTmfc).catch(() => null),
      ])

      if (cancelled) return
      setSelectedSigwxFrontMeta(frontMeta)
      setSelectedSigwxCloudMeta(cloudMeta)
    }

    loadSigwxMeta()
    return () => {
      cancelled = true
    }
  }, [selectedSigwxEntry?.tmfc, sigwxLowData?.tmfc, sigwxFrontMeta, sigwxCloudMeta])

  useEffect(() => {
    if (openAdvisoryPanel === 'sigwxLow' && !metVisibility.sigwx) setOpenAdvisoryPanel(null)
    if (openAdvisoryPanel === 'sigmet' && !metVisibility.sigmet) setOpenAdvisoryPanel(null)
    if (openAdvisoryPanel === 'airmet' && !metVisibility.airmet) setOpenAdvisoryPanel(null)
  }, [openAdvisoryPanel, metVisibility.sigwx, metVisibility.sigmet, metVisibility.airmet])

  useEffect(() => {
    if (metVisibility.sigwx) {
      onRequestDeferredWeatherData?.(['sigwxLowHistory'])
    }
  }, [metVisibility.sigwx, onRequestDeferredWeatherData])
  const rasterAndSigwxModel = useMemo(() => ({
    satelliteFrame: weatherOverlayModel.satelliteFrame,
    radarFrame: weatherOverlayModel.radarFrame,
    selectedSigwxFrontMeta: weatherOverlayModel.selectedSigwxFrontMeta,
    selectedSigwxCloudMeta: weatherOverlayModel.selectedSigwxCloudMeta,
    sigwxLowMapData: weatherOverlayModel.sigwxLowMapData,
    visibility: {
      satellite: weatherOverlayModel.visibility.satellite,
      radar: weatherOverlayModel.visibility.radar,
      sigwx: weatherOverlayModel.visibility.sigwx,
    },
    showVisibleSigwxFrontOverlay: weatherOverlayModel.showVisibleSigwxFrontOverlay,
    showVisibleSigwxCloudOverlay: weatherOverlayModel.showVisibleSigwxCloudOverlay,
  }), [
    weatherOverlayModel.satelliteFrame,
    weatherOverlayModel.radarFrame,
    weatherOverlayModel.selectedSigwxFrontMeta,
    weatherOverlayModel.selectedSigwxCloudMeta,
    weatherOverlayModel.sigwxLowMapData,
    weatherOverlayModel.visibility.satellite,
    weatherOverlayModel.visibility.radar,
    weatherOverlayModel.visibility.sigwx,
    weatherOverlayModel.showVisibleSigwxFrontOverlay,
    weatherOverlayModel.showVisibleSigwxCloudOverlay,
  ])
  const advisoryLayerModel = useMemo(() => ({
    visibility: {
      sigmet: weatherOverlayModel.visibility.sigmet,
      airmet: weatherOverlayModel.visibility.airmet,
    },
    sigmetFeatures: weatherOverlayModel.sigmetFeatures,
    sigmetLabels: weatherOverlayModel.sigmetLabels,
    airmetFeatures: weatherOverlayModel.airmetFeatures,
    airmetLabels: weatherOverlayModel.airmetLabels,
  }), [
    weatherOverlayModel.visibility.sigmet,
    weatherOverlayModel.visibility.airmet,
    weatherOverlayModel.sigmetFeatures,
    weatherOverlayModel.sigmetLabels,
    weatherOverlayModel.airmetFeatures,
    weatherOverlayModel.airmetLabels,
  ])
  const lightningLayerModel = useMemo(() => ({
    visibility: {
      lightning: weatherOverlayModel.visibility.lightning,
    },
    lightningGeoJSON: weatherOverlayModel.lightningGeoJSON,
    blinkLightning,
    lightningBlinkOff,
  }), [
    weatherOverlayModel.visibility.lightning,
    weatherOverlayModel.lightningGeoJSON,
    blinkLightning,
    lightningBlinkOff,
  ])

  function toggleAviation(id) {
    setAviationVisibility((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleMet(id) {
    setMetVisibility((prev) => {
      return getNextMetVisibility(prev, id, { lowPower })
    })
  }

  function clearAviationLayers() {
    setAviationVisibility(AVIATION_WFS_LAYERS.reduce((acc, l) => { acc[l.id] = false; return acc }, {}))
  }

  function clearMetLayers() {
    setMetVisibility((prev) => {
      const next = { ...prev }
      MET_LAYERS.forEach((l) => { next[l.id] = false })
      return next
    })
  }

  // ???? ADS-B Polling ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    let timeoutId
    let cancelled = false

    if (ADSB_FETCH_DISABLED || !metVisibility.adsb) {
      setAdsbLoading(false)
      return undefined
    }

    setAdsbLoading(!adsbData)

    async function poll() {
      const data = await fetchAdsbData()
      if (cancelled) return
      if (data) setAdsbData(data)
      setAdsbLoading(false)
      timeoutId = setTimeout(poll, ADSB_POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [metVisibility.adsb])

  // ???? Map init ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined

    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) { setError('VITE_MAPBOX_TOKEN is required.'); return undefined }

    mapboxgl.accessToken = token

    const initialBasemap = BASEMAP_OPTIONS[0]

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: initialBasemap.style,
      config: { basemap: initialBasemap.config },
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      maxBounds: MAP_CONFIG.maxBounds,
      logoPosition: 'bottom-right',
      language: 'ko',
      localIdeographFontFamily: '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif',
    })

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    let resizeFrame = null
    const resizeMap = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null
        map.resize()
      })
    }
    const resizeObserver = new ResizeObserver(resizeMap)
    resizeObserver.observe(mapContainerRef.current)
    window.addEventListener('resize', resizeMap)

    let vfrInteractionsBound = false

    // zoom handler lives outside style.load to avoid duplicate registration on style switch
    let roadsVisible = map.getZoom() >= ROAD_VISIBILITY_ZOOM
    map.on('zoom', () => {
      if (!map.isStyleLoaded()) return
      const should = map.getZoom() >= ROAD_VISIBILITY_ZOOM
      if (should !== roadsVisible) { roadsVisible = should; applyRoadVisibility(map, roadsVisible) }
    })

    map.on('style.load', () => {
      applyRoadVisibility(map, roadsVisible)

      // Aviation GeoJSON
      addAviationWfsLayers(map)

      // Route preview
      installRoutePreviewLayers(map)
      if (!vfrInteractionsBound) {
        vfrInteractionsBound = true
        bindVfrInteractions(map, vfrWaypointsRef, setVfrWaypoints)
      }

      // Weather overlays
      installWeatherOverlayLayers(map)

      // Geo boundaries (coastline + admin)
      addGeoBoundaryLayers(map)

      // Airport circles
      addAirportLayers(map, { type: 'FeatureCollection', features: [] })

      // Flight category overlay (before airport circles so airports render on top)
      addFlightCategoryLayer(map, AIRPORT_CIRCLE_LAYER)

      // ADS-B
      addAdsbLayers(map)

      setStyleRevision((value) => value + 1)
      setIsStyleReady(true)
    })

    mapRef.current = map
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resizeMap)
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return undefined

    cleanupAll(airportEventCleanupRef.current)
    cleanupAll(advisoryEventCleanupRef.current)
    adsbEventCleanupRef.current?.()
    sectorEventCleanupRef.current?.()

    airportEventCleanupRef.current = [
      // click + cursor on all interactive layers
      ...AIRPORT_INTERACTIVE_LAYERS.flatMap((layerId) => [
        bindLayerEvent(map, 'click', layerId, (e) => {
          const icao = e.features?.[0]?.properties?.icao
          if (!icao) return
          // Touch fires no mouseleave, so clear the hover tooltip on selection.
          tooltipIcaoRef.current = null
          clearTimeout(tooltipTimerRef.current)
          setHoveredAirportIcao(null)
          onSelectRef.current?.(icao)
        }),
        bindLayerEvent(map, 'mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' }),
        bindLayerEvent(map, 'mouseleave', layerId, () => { map.getCanvas().style.cursor = '' }),
      ]),
      // tooltip via mousemove — avoids adjacent-airport cancel race condition
      bindLayerEvent(map, 'mousemove', AIRPORT_STATION_CENTER_LAYER, (e) => {
        const icao = e.features?.[0]?.properties?.icao
        const coords = e.features?.[0]?.geometry?.coordinates
        if (!icao || !coords) return
        clearTimeout(tooltipTimerRef.current)
        if (icao !== tooltipIcaoRef.current) {
          tooltipIcaoRef.current = icao
          const { x, y } = map.project(coords)
          setHoveredAirportIcao(icao)
          setTooltipPos({ x, y })
        }
      }),
      bindLayerEvent(map, 'mouseleave', AIRPORT_STATION_CENTER_LAYER, () => {
        tooltipIcaoRef.current = null
        clearTimeout(tooltipTimerRef.current)
        tooltipTimerRef.current = setTimeout(() => {
          setHoveredAirportIcao(null)
        }, 80)
      }),
    ]

    const advisoryLayerIds = [
      ADVISORY_LAYER_DEFS.sigmet.fillLayerId,
      ADVISORY_LAYER_DEFS.sigmet.lineLayerId,
      ADVISORY_LAYER_DEFS.airmet.fillLayerId,
      ADVISORY_LAYER_DEFS.airmet.lineLayerId,
    ]
    advisoryEventCleanupRef.current = advisoryLayerIds.flatMap((layerId) => [
      bindLayerEvent(map, 'click', layerId, (e) => {
        const desc = e.features?.[0]?.properties?.description
        if (!desc) return
        new mapboxgl.Popup({ closeButton: true, maxWidth: '320px' })
          .setLngLat(e.lngLat)
          .setHTML(`<pre class="mapbox-advisory-popup">${desc.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</pre>`)
          .addTo(map)
      }),
      bindLayerEvent(map, 'mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' }),
      bindLayerEvent(map, 'mouseleave', layerId, () => { map.getCanvas().style.cursor = '' }),
    ])

    adsbEventCleanupRef.current = bindAdsbHover(map)
    sectorEventCleanupRef.current = bindSectorHover(map)

    return () => {
      cleanupAll(airportEventCleanupRef.current)
      cleanupAll(advisoryEventCleanupRef.current)
      adsbEventCleanupRef.current?.()
      sectorEventCleanupRef.current?.()
      airportEventCleanupRef.current = []
      advisoryEventCleanupRef.current = []
      adsbEventCleanupRef.current = null
      sectorEventCleanupRef.current = null
    }
  }, [isStyleReady, styleRevision])

  // ???? Sync aviation layer visibility ??????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    AVIATION_WFS_LAYERS.forEach((l) => setLayerVisibility(map, l, aviationVisibility[l.id]))
  }, [aviationVisibility, styleRevision])

  // ???? Route highlight (?롪퍔?δ빳???뚮뜆?????깅턄???띠룆踰????戮?뻣) ????????????????????????????????????????????????????

  // ???? VFR waypoint sync ????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || routeResult?.flightRule !== 'VFR') return
    syncVfrWaypointData(map, routePreviewModel)
  }, [routePreviewModel, routeResult, isStyleReady, styleRevision])

  // ???? VFR WP hover (X ?뺢퀗?????戮?뻣?? ????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return

    const onWpMove = (e) => {
      clearTimeout(hideTimerRef.current)
      const wpIdx = e.features[0].properties.wpIndex
      const wp = vfrWaypointsRef.current[wpIdx]
      if (!wp || wp.fixed) { setHoveredWpInfo(null); return }
      const pos = map.project([wp.lon, wp.lat])
      setHoveredWpInfo({ idx: wpIdx, x: pos.x, y: pos.y })
    }
    const onWpLeave = () => {
      hideTimerRef.current = setTimeout(() => setHoveredWpInfo(null), 120)
    }

    map.on('mousemove', VFR_WP_CIRCLE, onWpMove)
    map.on('mouseleave', VFR_WP_CIRCLE, onWpLeave)
    return () => {
      map.off('mousemove', VFR_WP_CIRCLE, onWpMove)
      map.off('mouseleave', VFR_WP_CIRCLE, onWpLeave)
    }
  }, [isStyleReady, styleRevision])

  // ???? Sync MET overlays ??????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return

    syncRasterAndSigwxLayers(map, rasterAndSigwxModel)
  }, [rasterAndSigwxModel, isStyleReady, styleRevision])

  // ???? Sync SIGMET / AIRMET ????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    syncAdvisoryLayers(map, advisoryLayerModel)
  }, [advisoryLayerModel, isStyleReady, styleRevision])

  // ???? Sync lightning ????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    syncLightningLayers(map, lightningLayerModel)
  }, [lightningLayerModel, isStyleReady, styleRevision])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || !enableWindOverlay) return
    syncWindOverlay(map, {
      windField,
      rendererOptions: windRendererOptions,
      visibility: {
        wind: metVisibility.wind,
        windFlow: metVisibility.windFlow,
        windSpeed: metVisibility.windSpeed,
      },
    })
  }, [
    enableWindOverlay,
    windField,
    windRendererOptions,
    metVisibility.wind,
    metVisibility.windFlow,
    metVisibility.windSpeed,
    isStyleReady,
    styleRevision,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || !enableWindOverlay) return
    syncTemperatureOverlay(map, {
      temperatureField,
      isVisible: metVisibility.temp,
    })
  }, [
    enableWindOverlay,
    temperatureField,
    metVisibility.temp,
    isStyleReady,
    styleRevision,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || !enableWindOverlay) return
    syncCloudPotentialOverlay(map, {
      cloudPotentialField: cloudField,
      isVisible: metVisibility.cloud,
    })
  }, [
    enableWindOverlay,
    cloudField,
    metVisibility.cloud,
    isStyleReady,
    styleRevision,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || !enableWindOverlay) return
    syncIcingPotentialOverlay(map, {
      icingField,
      isVisible: metVisibility.icing,
    })
  }, [
    enableWindOverlay,
    icingField,
    metVisibility.icing,
    isStyleReady,
    styleRevision,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || !enableWindOverlay) return
    syncKtgTurbulenceOverlay(map, {
      ktgGrid,
      isVisible: metVisibility.turbulence,
    })
  }, [
    enableWindOverlay,
    ktgGrid,
    metVisibility.turbulence,
    isStyleReady,
    styleRevision,
  ])

  useEffect(() => () => {
    const map = mapRef.current
    if (map) {
      destroyWindOverlay(map)
      destroyTemperatureOverlay(map)
      destroyCloudPotentialOverlay(map)
      destroyIcingPotentialOverlay(map)
      destroyKtgTurbulenceOverlay(map)
      removeFlightCategoryLayer(map)
    }
  }, [])

  // ???? Sync geo boundaries ??????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    setGeoBoundaryVisibility(map, shouldShowGeoBoundaries({ basemapId, metVisibility, enableWindOverlay }))
  }, [
    basemapId,
    enableWindOverlay,
    metVisibility.satellite,
    metVisibility.radar,
    metVisibility.wind,
    metVisibility.temp,
    metVisibility.cloud,
    metVisibility.icing,
    isStyleReady,
    styleRevision,
  ])

  // ???? Sync ADS-B ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    registerAircraftImages(map)
    registerAirlineLogos(map)
    syncAdsbLayer(map, { geojson: adsbGeoJSON, trailGeojson: adsbTrailGeoJSON, isVisible: metVisibility.adsb })
  }, [adsbGeoJSON, adsbTrailGeoJSON, metVisibility.adsb, isStyleReady, styleRevision])

  // ???? Sync flight category overlay ??????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    syncFlightCategoryLayer(map, {
      geojson: flightCategoryGeojson,
      visible: !!metVisibility.flightCategory,
      beforeLayerId: AIRPORT_CIRCLE_LAYER,
    })
  }, [flightCategoryGeojson, metVisibility.flightCategory, isStyleReady, styleRevision])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return
    return bindFlightCategoryClick(map, fcPopupRef)
  }, [isStyleReady, styleRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  // ???? Sync airport data ??????????????????????????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady) return

    let cancelled = false

    async function syncAirportMarkers() {
      registerAirportStationImages(map)
      registerAirportWindBarbImages(map)
      await registerAirportWeatherImages(map, airportWeatherImageIds)
      if (cancelled) return

      addAirportLayers(map, airportGeoJSON)
      map.getSource(AIRPORT_SOURCE_ID)?.setData(airportGeoJSON)
    }

    void syncAirportMarkers()

    return () => {
      cancelled = true
    }
  }, [airportGeoJSON, airportWeatherImageIds, isStyleReady, styleRevision])

  // ???? Sync airport selected state ??????????????????????????????????????????????????????????????????????????????????????

  useEffect(() => {
    const map = mapRef.current
    if (!map || !isStyleReady || !map.getSource(AIRPORT_SOURCE_ID)) return
    airportGeoJSON.features.forEach((f) => {
      map.setFeatureState(
        { source: AIRPORT_SOURCE_ID, id: f.properties.icao },
        { selected: f.properties.icao === selectedAirport },
      )
    })
  }, [airportGeoJSON, selectedAirport, isStyleReady, styleRevision])

  // ???? Layer panel helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????

  function switchBasemap(id) {
    const map = mapRef.current
    if (!map || id === basemapId) return
    const option = BASEMAP_OPTIONS.find((o) => o.id === id)
    if (!option) return
    setBasemapId(id)
    setBasemapMenuOpen(false)
    setIsStyleReady(false)
    map.setStyle(option.style, { config: { basemap: option.config } })
  }

  function isMetLayerDisabled(id) {
    if (id === 'wind') return !enableWindOverlay || (windStatus === 'error' && !windField)
    if (id === 'temp') return !enableWindOverlay || ((tempStatus === 'error' || tempStatus === 'unavailable') && !temperatureField)
    if (id === 'cloud') {
      return !enableWindOverlay || (!metVisibility.cloud && (cloudStatus === 'error' || cloudStatus === 'unavailable') && !cloudField)
    }
    if (id === 'icing') {
      return !enableWindOverlay || (!metVisibility.icing && (icingStatus === 'error' || icingStatus === 'unavailable') && !icingField)
    }
    if (id === 'turbulence') {
      return !enableWindOverlay || (!metVisibility.turbulence && turbulenceStatus === 'error' && !ktgGrid)
    }
    if (id === 'radar') return radarFrames.length === 0
    if (id === 'satellite') return satelliteFrames.length === 0
    return false
  }

  function metLayerBadge(id) {
    if (id === 'sigmet') return sigmetCount
    if (id === 'airmet') return airmetCount
    if (id === 'lightning') return lightningCount
    if (id === 'sigwx') return sigwxCount
    return null
  }

  function toggleSigwxLegend(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    setSigwxLegendOpen((prev) => !prev)
  }

  function toggleSigwxGroup(groupKey) {
    setHiddenAdvisoryKeys((prev) => {
      const current = new Set(prev.sigwxLow || [])
      if (current.has(groupKey)) current.delete(groupKey)
      else current.add(groupKey)
      return { ...prev, sigwxLow: [...current] }
    })
  }

  function toggleSigwxFilter(filterKey) {
    setSigwxFilter((prev) => ({ ...prev, [filterKey]: prev[filterKey] === false }))
  }

  function toggleAdvisoryPanel(key) {
    setOpenAdvisoryPanel((prev) => (prev === key ? null : key))
  }

  function toggleAdvisoryVisibility(kind, mapKey) {
    setHiddenAdvisoryKeys((prev) => {
      const current = new Set(prev[kind] || [])
      if (current.has(mapKey)) current.delete(mapKey)
      else current.add(mapKey)
      return { ...prev, [kind]: [...current] }
    })
  }

  // Active-layer counts (mirror the panel "N개 켜짐" logic) reported up for the
  // mobile on-map entry buttons.
  const aviationActiveCount = AVIATION_WFS_LAYERS.filter((l) => aviationVisibility[l.id]).length
  const metActiveCount = MET_LAYERS.filter((l) => metVisibility[l.id] && !isMetLayerDisabled(l.id)).length
  useEffect(() => {
    onLayerCountsChange?.({ aviation: aviationActiveCount, met: metActiveCount })
  }, [aviationActiveCount, metActiveCount, onLayerCountsChange])

  // ???? Render ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  return (
    <div
      className="map-view-wrapper"
      data-route-briefing-map-mode={activePanel === 'route-check' && routeBriefingMapMode ? 'true' : 'false'}
    >
      <div ref={mapContainerRef} className="map-view" />

      {adsbLoading && (
        <div className="adsb-loading" role="status" aria-live="polite">
          <span className="adsb-loading__spinner" aria-hidden="true" />
          <span>ADS-B 불러오는 중…</span>
        </div>
      )}

      {error && <div className="map-view-error" role="alert">{error}</div>}

      <WeatherLayerTimestampBar entries={timestampEntries} />

      <WeatherLegends
        radarLegendVisible={radarLegendVisible}
        lightningLegendVisible={lightningLegendVisible}
        blinkLightning={blinkLightning}
        onBlinkLightningChange={setBlinkLightning}
        radarRainrateLegend={RADAR_RAINRATE_LEGEND}
        lightningLegendEntries={lightningLegendEntries}
        windSpeedLegendVisible={!!(enableWindOverlay && metVisibility.wind && metVisibility.windSpeed && windField)}
        windSpeedLegendEntries={WIND_SPEED_COLOR_RAMP}
        temperatureLegendVisible={!!(enableWindOverlay && metVisibility.temp && temperatureField)}
        temperatureLegendEntries={CELSIUS_TEMPERATURE_COLOR_RAMP}
        cloudLegendVisible={!!(enableWindOverlay && metVisibility.cloud && cloudField)}
        cloudLegendEntries={CLOUD_POTENTIAL_COLOR_RAMP.filter((entry) => entry.max <= cloudMaxSpread)}
        icingLegendVisible={!!(enableWindOverlay && metVisibility.icing && icingField)}
        icingLegendEntries={ICING_COLOR_RAMP}
        turbulenceLegendVisible={!!(enableWindOverlay && metVisibility.turbulence && ktgGrid)}
        turbulenceLegendEntries={KTG_COLOR_RAMP}
        radarReferenceTimeMs={radarReferenceTimeMs}
        lightningReferenceTimeMs={lightningReferenceTimeMs}
        formatReferenceTimeLabel={(ms) => formatReferenceTimeLabel(ms, tz)}
      />

      <AdvisoryBadges
        badgeItems={advisoryBadgeItems}
        openPanel={openAdvisoryPanel}
        panelItems={advisoryPanelItems}
        hiddenKeys={hiddenAdvisoryKeys}
        onTogglePanel={toggleAdvisoryPanel}
        onClosePanel={() => setOpenAdvisoryPanel(null)}
        onToggleVisibility={toggleAdvisoryVisibility}
      />

      <SigwxHistoryBar
        isVisible={metVisibility.sigwx}
        selectedEntry={selectedSigwxEntry}
        entryCount={sigwxHistoryEntries.length}
        historyIndex={sigwxHistoryIndex}
        issueLabel={sigwxIssueLabel}
        validLabel={sigwxValidLabel}
        isElevated={weatherTimelineVisible}
        onHistoryIndexChange={setSigwxHistoryIndex}
      />

      <WeatherTimelineBar
        isVisible={weatherTimelineVisible}
        isPlaying={weatherTimelinePlaying}
        selectedIndex={effectiveWeatherTimelineIndex}
        tickCount={weatherTimelineTicks.length}
        selectedTimeMs={selectedWeatherTimeMs}
        playbackSpeed={weatherTimelineSpeed}
        onPlayPause={() => setWeatherTimelinePlaying((prev) => !prev)}
        onIndexChange={(value) => {
          setWeatherTimelinePlaying(false)
          setWeatherTimelineIndex(value)
        }}
        onPlaybackSpeedChange={setWeatherTimelineSpeed}
      />

      <NwpSliderBar
        isVisible={enableWindOverlay && (metVisibility.wind || metVisibility.temp || metVisibility.cloud || metVisibility.icing)}
        levels={sliderLevels}
        times={sliderTimes}
        selection={nwpSelection}
        availability={sliderAvailability}
        isElevated={weatherTimelineVisible}
        onSelectionChange={setNwpSelection}
      />
      {enableWindOverlay && metVisibility.turbulence && altLevelsFt.length > 1 && (() => {
        const altLevels = altLevelsFt
        const selAlt = selectedAltFt
        const idx = altLevels.indexOf(selAlt)
        const effectiveIdx = idx >= 0 ? idx : 0
        return (
          <div className="nwp-level-slider-rail" aria-label="Turbulence altitude">
            <input
              className="nwp-level-slider"
              type="range"
              min="0"
              max={String(altLevels.length - 1)}
              step="1"
              value={String(effectiveIdx)}
              aria-label="Turbulence altitude level"
              onChange={(e) => setSelectedAltFt(altLevels[Number(e.target.value)])}
            />
            <div className="nwp-level-slider-ticks" aria-hidden="true">
              {[...altLevels].reverse().map((ft) => (
                <span
                  key={ft}
                  className={`nwp-level-slider-tick${ft === selAlt ? ' is-active' : ''}`}
                >
                  {`${ft / 1000}K`}
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      <AdsbTimestamp
        isVisible={metVisibility.adsb && !weatherTimelineVisible}
        updatedAt={adsbData?.updated_at}
      />
      <AdsbTimestamp
        isVisible={metVisibility.adsb && weatherTimelineVisible}
        updatedAt={adsbData?.updated_at}
        compact
      />

      <SigwxLegendDialog isOpen={sigwxLegendOpen} onClose={toggleSigwxLegend} />

      <BasemapSwitcher
        basemapId={basemapId}
        isOpen={basemapMenuOpen}
        onOpenChange={setBasemapMenuOpen}
        onSwitchBasemap={switchBasemap}
      />

      {activePanel === 'route-check' && (
        <>
          {!routeBriefing.state.briefing && (
            <>
              <Suspense fallback={null}>
                <RouteBriefingPanel
                  state={routeBriefing.state}
                  refs={routeBriefing.refs}
                  derived={routeBriefing.derived}
                  actions={routeBriefing.actions}
                  airports={airports}
                  onClose={onClosePanel}
                />
              </Suspense>
              {!isMobile && (
                <button
                  type="button"
                  className="route-briefing-map-mode-toggle"
                  onClick={() => setRouteBriefingMapMode((prev) => !prev)}
                >
                  {routeBriefingMapMode ? '입력 보기' : '지도 보기'}
                </button>
              )}
            </>
          )}
          {routeBriefing.state.briefing && (
            <Suspense fallback={null}>
              <BriefingView
                briefing={routeBriefing.state.briefing}
                verticalProfile={routeBriefing.state.verticalProfile}
                crossSection={routeBriefing.state.crossSection}
                onClose={() => routeBriefing.actions.setBriefing(null)}
                onOpenProfile={routeBriefing.actions.handleVerticalProfileRequest}
                onFocus={focusBriefingSection}
              />
            </Suspense>
          )}
        </>
      )}

      {routeBriefing.state.verticalProfileWindowOpen && (
        <Suspense fallback={null}>
          <VerticalProfileWindow
            profile={routeBriefing.state.verticalProfile}
            crossSection={routeBriefing.state.crossSection}
            isOpen={routeBriefing.state.verticalProfileWindowOpen}
            onClose={() => routeBriefing.actions.setVerticalProfileWindowOpen(false)}
            advisories={[
              ...sigmetItems.map((item) => ({ ...item, kind: 'sigmet' })),
              ...airmetItems.map((item) => ({ ...item, kind: 'airmet' })),
            ]}
          />
        </Suspense>
      )}

      {activePanel === 'aviation' && (
        <AviationLayerPanel
          visibility={aviationVisibility}
          onToggle={toggleAviation}
          onClose={onClosePanel}
          onClearAll={clearAviationLayers}
        />
      )}

      {hoveredAirportIcao && (() => {
        const hoveredMetar = metarData?.airports?.[hoveredAirportIcao] || null
        const hoveredAirportMeta = airports.find((a) => a.icao === hoveredAirportIcao) || null
        const hoveredFeature = airportGeoJSON.features.find((f) => f.properties.icao === hoveredAirportIcao)
        const containerEl = mapContainerRef.current
        return (
          <AirportTooltip
            metar={hoveredMetar}
            airport={hoveredAirportMeta}
            flightCategory={hoveredFeature?.properties?.flightCategory}
            categoryColor={hoveredFeature?.properties?.categoryColor}
            x={tooltipPos.x}
            y={tooltipPos.y}
            containerWidth={containerEl?.clientWidth}
            containerHeight={containerEl?.clientHeight}
          />
        )
      })()}

      {activePanel === 'met' && (
        <WeatherOverlayPanel
          layers={MET_LAYERS}
          visibility={metVisibility}
          blinkLightning={blinkLightning}
          onToggle={toggleMet}
          onClose={onClosePanel}
          onClearAll={clearMetLayers}
          onBlinkLightningChange={setBlinkLightning}
          isLayerDisabled={isMetLayerDisabled}
          getLayerBadge={metLayerBadge}
          showWind={enableWindOverlay}
          windStatus={windStatus}
          tempStatus={tempStatus}
          cloudStatus={cloudStatus}
          icingStatus={icingStatus}
          turbulenceStatus={turbulenceStatus}
          windLowPower={lowPower}
          windFlowOpacity={windFlowOpacity}
          windFlowTrail={windFlowTrail}
          windFlowWidth={windFlowWidth}
          onWindFlowOpacityChange={setWindFlowOpacity}
          onWindFlowTrailChange={setWindFlowTrail}
          onWindFlowWidthChange={setWindFlowWidth}
        />
      )}

    </div>
  )
}

export default MapView


