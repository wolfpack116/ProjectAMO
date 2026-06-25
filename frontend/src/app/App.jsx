import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import AirportPanel from '../features/airport-panel/AirportPanel.jsx'
import MapView from '../features/map/MapView.jsx'
import useWeatherPolling from './useWeatherPolling.js'
import Sidebar from './layout/Sidebar.jsx'
import MobileTaskBar from './layout/MobileTaskBar.jsx'
import MobileMapOverlay from './layout/MobileMapOverlay.jsx'
import MobileMoreMenu from './layout/MobileMoreMenu.jsx'
import SettingsModal from '../features/settings/SettingsModal.jsx'
import UpdatesModal from '../features/about/UpdatesModal.jsx'
import { useLastSeenVersion } from '../features/about/useLastSeenVersion.js'
import useIsMobile from '../shared/ui/useIsMobile.js'
import { TimeZoneProvider, useTimeZone } from '../shared/timezone/TimeZoneContext.jsx'

const MonitoringPage = lazy(() => import('../features/monitoring/MonitoringPage.jsx'))

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
  const [selectedAirport, setSelectedAirport] = useState(null)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [mobileTask, setMobileTask] = useState('map')
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

  const warningAirportCount = useMemo(() => {
    const byIcao = weatherData?.warning?.airports
    if (!byIcao) return 0
    return Object.values(byIcao).filter((w) => (w?.warnings?.length || 0) > 0).length
  }, [weatherData])

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
      />
      <main className="map-shell">
        <MapView
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
          onAirportSelect={setSelectedAirport}
          onRequestDeferredWeatherData={requestDeferredWeatherData}
        />
      </main>
      <AirportPanel
        airport={selectedAirportMeta}
        weatherData={weatherData}
        onClose={() => setSelectedAirport(null)}
        onRequestDeferredWeatherData={requestDeferredWeatherData}
      />

      {isMobile && mobileTask === 'map' && !selectedAirport && (
        <MobileMapOverlay
          activePanel={activePanel}
          onToggle={togglePanel}
          warningCount={warningAirportCount}
        />
      )}
      {isMobile && mobileTask === 'more' && !selectedAirport && (
        <MobileMoreMenu
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
    </div>
  )
}

function App() {
  return window.location.pathname === '/monitoring'
    ? <Suspense fallback={null}><MonitoringPage /></Suspense>
    : <TimeZoneProvider><MainAppShell /></TimeZoneProvider>
}

export default App
