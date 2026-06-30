import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import AirportPanel from '../features/airport-panel/AirportPanel.jsx'
import MapView from '../features/map/MapView.jsx'
import useWeatherPolling from './useWeatherPolling.js'
import Sidebar from './layout/Sidebar.jsx'
import MobileTaskBar from './layout/MobileTaskBar.jsx'
import MobileMapOverlay from './layout/MobileMapOverlay.jsx'
import MobileMoreMenu from './layout/MobileMoreMenu.jsx'
import SettingsModal from '../features/settings/SettingsModal.jsx'
import UpdatesModal from '../features/about/UpdatesModal.jsx'
import SearchPalette from '../features/search/SearchPalette.jsx'
import { buildSearchCatalog } from '../features/search/layerActions.js'
import { useLastSeenVersion } from '../features/about/useLastSeenVersion.js'
import useIsMobile from '../shared/ui/useIsMobile.js'
import { TimeZoneProvider, useTimeZone } from '../shared/timezone/TimeZoneContext.jsx'

const MonitoringPage = lazy(() => import('../features/monitoring/MonitoringPage.jsx'))
const DesignTestPage = lazy(() => import('../features/design-test/DesignTestPage.jsx'))

function formatTimeByTz(ms, tz) {
  const d = tz === 'KST' ? new Date(ms + 9 * 3600 * 1000) : new Date(ms)
  const year  = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day   = String(d.getUTCDate()).padStart(2, '0')
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const mins  = String(d.getUTCMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${mins} ${tz}`
}

function MainAppShell() {
  const { tz } = useTimeZone()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [activePanel, setActivePanel] = useState(null)
  const [selectedAirport, setSelectedAirport] = useState(() => {
    // 딥링크: ?airport=RKSI 로 공항패널 바로 열기 (공유 링크 + Playwright 캡처용)
    const p = new URLSearchParams(window.location.search).get('airport')
    return p ? p.toUpperCase() : null
  })
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [mobileTask, setMobileTask] = useState('map')
  const [layerCounts, setLayerCounts] = useState({ aviation: 0, met: 0 })
  const [searchOpen, setSearchOpen] = useState(false)
  const mapRef = useRef(null)
  const isMobile = useIsMobile()
  const { weatherData, requestDeferredWeatherData } = useWeatherPolling()
  const { hasUpdate, markSeen } = useLastSeenVersion()

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activePanel === 'updates') markSeen()
  }, [activePanel, markSeen])

  // Auto-open the update board on first visit after a new release (once, on mount).
  useEffect(() => {
    if (hasUpdate) setActivePanel('updates')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function togglePanel(panelId) {
    setActivePanel((cur) => (cur === panelId ? null : panelId))
  }

  const selectedAirportMeta = useMemo(
    () => weatherData?.airports?.find((a) => a.icao === selectedAirport) || null,
    [weatherData, selectedAirport],
  )

  const searchCatalog = useMemo(
    () => buildSearchCatalog(weatherData?.airports || []),
    [weatherData],
  )

  // 활성 공항경보가 있는 공항 ICAO 목록(상시 위험 요약 칩용).
  const warnedAirports = useMemo(
    () => Object.entries(weatherData?.warning?.airports || {})
      .filter(([, w]) => (w?.warnings?.length || 0) > 0)
      .map(([icao]) => icao),
    [weatherData],
  )

  // Cmd/Ctrl+K → 검색 팔레트 (사이드바 검색 아이콘과 동일).
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 검색 결과 실행 — 패널 열기/공항 선택은 여기서, 레이어·베이스맵은 MapView ref(상태가 거기 있음).
  function runAction(entry) {
    switch (entry.type) {
      case 'airport':
        setSelectedAirport(entry.id)
        break
      case 'panel':
        if (entry.href) window.location.assign(entry.href)
        else setActivePanel(entry.panelId)
        break
      case 'met':
        setActivePanel('met')
        mapRef.current?.setLayerOn(entry.id, 'met')
        break
      case 'aviation':
        setActivePanel('aviation')
        mapRef.current?.setLayerOn(entry.id, 'aviation')
        break
      case 'basemap':
        mapRef.current?.switchBasemap(entry.id)
        break
      default:
        break
    }
  }

  // Map the mobile task switcher onto the existing activePanel mechanism.
  function selectMobileTask(task) {
    setMobileTask(task)
    setSelectedAirport(null) // switching tasks dismisses the airport detail panel
    if (task === 'route') setActivePanel('route-check')
    else setActivePanel((cur) => (['aviation', 'met', 'route-check'].includes(cur) ? null : cur))
  }

  return (
    <div className={`app ${isSidebarExpanded ? 'sidebar-is-expanded' : ''}`}>
      <Sidebar
        activePanel={activePanel}
        onPanelToggle={togglePanel}
        isExpanded={isSidebarExpanded}
        onExpandToggle={setIsSidebarExpanded}
        hasUpdate={hasUpdate}
        layerCounts={layerCounts}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <main className="map-shell">
        <MapView
          ref={mapRef}
          activePanel={activePanel}
          airports={weatherData?.airports || []}
          metarData={weatherData?.metar || null}
          echoMeta={weatherData?.echoMeta || null}
          satMeta={weatherData?.satMeta || null}
          sigmetData={weatherData?.sigmet || null}
          airmetData={weatherData?.airmet || null}
          lightningData={weatherData?.lightning || null}
          sigwxLowData={weatherData?.sigwxLow || null}
          sigwxLowHistoryData={weatherData?.sigwxLowHistory || null}
          sigwxFrontMeta={weatherData?.sigwxFrontMeta || null}
          sigwxCloudMeta={weatherData?.sigwxCloudMeta || null}
          selectedAirport={selectedAirport}
          warnedAirports={warnedAirports}
          onAirportSelect={setSelectedAirport}
          onRequestDeferredWeatherData={requestDeferredWeatherData}
          onLayerCountsChange={setLayerCounts}
          onClosePanel={() => { setActivePanel(null); setMobileTask('map') }}
        />
      </main>
      <AirportPanel
        airport={selectedAirportMeta}
        weatherData={weatherData}
        onClose={() => setSelectedAirport(null)}
        onRequestDeferredWeatherData={requestDeferredWeatherData}
      />

      {isMobile && mobileTask === 'map' && !selectedAirport
        && activePanel !== 'aviation' && activePanel !== 'met' && (
        <MobileMapOverlay
          activePanel={activePanel}
          onToggle={togglePanel}
          aviationCount={layerCounts.aviation}
          metCount={layerCounts.met}
        />
      )}
      {isMobile && mobileTask === 'more' && !selectedAirport && (
        <MobileMoreMenu
          onSearch={() => setSearchOpen(true)}
          onSettings={() => togglePanel('settings')}
          onUpdates={() => togglePanel('updates')}
          hasUpdate={hasUpdate}
        />
      )}
      {isMobile && (
        <MobileTaskBar activeTask={mobileTask} onSelect={selectMobileTask} hasUpdate={hasUpdate} />
      )}

      <div className="utc-bar">{formatTimeByTz(nowMs, tz)}</div>
      {activePanel === 'settings' && (
        <SettingsModal onClose={() => togglePanel('settings')} />
      )}
      {activePanel === 'updates' && (
        <UpdatesModal onClose={() => togglePanel('updates')} />
      )}
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        catalog={searchCatalog}
        onRun={runAction}
      />
    </div>
  )
}

function App() {
  if (window.location.pathname === '/monitoring') {
    return <Suspense fallback={null}><MonitoringPage /></Suspense>
  }
  if (window.location.pathname === '/test') {
    return <Suspense fallback={null}><DesignTestPage /></Suspense>
  }
  return <TimeZoneProvider><MainAppShell /></TimeZoneProvider>
}

export default App
