import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const css = readFileSync(new URL('./layoutTokens.css', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')
const sidebarCss = readFileSync(new URL('./Sidebar.css', import.meta.url), 'utf8')
const mapView = readFileSync(new URL('../../features/map/MapView.jsx', import.meta.url), 'utf8')
const mapCss = readFileSync(new URL('../../features/map/MapView.css', import.meta.url), 'utf8')
const routeCss = readFileSync(new URL('../../features/route-briefing/RouteBriefing.css', import.meta.url), 'utf8')
const airportCss = readFileSync(new URL('../../features/airport-panel/AirportPanel.css', import.meta.url), 'utf8')
const monitoringCss = readFileSync(new URL('../../features/monitoring/legacy/App.css', import.meta.url), 'utf8')
const monitoringPage = readFileSync(new URL('../../features/monitoring/MonitoringPage.jsx', import.meta.url), 'utf8')
const monitoringSettings = readFileSync(new URL('../../features/monitoring/legacy/components/alerts/Settings.jsx', import.meta.url), 'utf8')

test('layout tokens define shell and panel sizing contracts', () => {
  for (const token of [
    '--breakpoint-mobile-max',
    '--sidebar-collapsed',
    '--sidebar-expanded',
    '--app-bottom-bar',
    '--panel-overlay-sm',
    '--panel-overlay-md',
    '--panel-drawer-lg',
    '--breakpoint-tablet',
    '--breakpoint-compact',
    '--breakpoint-desktop',
    '--breakpoint-wide',
  ]) {
    assert.match(css, new RegExp(`${token}\\s*:`), `${token} should be defined`)
  }

  assert.match(css, /--panel-overlay-sm:\s*clamp\(/)
  assert.match(css, /--panel-overlay-md:\s*clamp\(/)
  assert.match(css, /--panel-drawer-lg:\s*clamp\(/)

  for (const declaration of [
    '--breakpoint-mobile-max: 719px;',
    '--breakpoint-tablet: 720px;',
    '--breakpoint-compact: 980px;',
    '--breakpoint-desktop: 1200px;',
    '--breakpoint-wide: 1600px;',
    '--app-bottom-bar: 24px;',
    '--sidebar-collapsed: 56px;',
    '--sidebar-expanded: clamp(260px, 16vw, 280px);',
    '--panel-overlay-sm: clamp(260px, 20vw, 320px);',
    '--panel-overlay-md: clamp(320px, 26vw, 420px);',
    '--panel-drawer-lg: clamp(560px, 50vw, 960px);',
  ]) {
    assert.match(css, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('app css imports layout tokens first', () => {
  const firstLine = appCss.split(/\r?\n/, 1)[0]
  assert.equal(firstLine, "@import './layout/layoutTokens.css';")
})

test('layout tokens stay globally scoped under :root', () => {
  assert.match(css, /^\s*:root\s*\{/)
})

test('app shell and sidebar consume shared layout tokens', () => {
  assert.match(appCss, /var\(--sidebar-collapsed\)/)
  assert.match(appCss, /var\(--sidebar-expanded\)/)
  assert.match(appCss, /--active-sidebar-width:\s*var\(--sidebar-collapsed\)/)
  assert.match(appCss, /var\(--app-bottom-bar\)/)
  assert.match(sidebarCss, /width:\s*var\(--sidebar-collapsed\)/)
  assert.match(sidebarCss, /width:\s*var\(--sidebar-expanded\)/)
  assert.doesNotMatch(appCss, /calc\(100vw - 56px\)/)
  assert.doesNotMatch(appCss, /calc\(100vw - 260px\)/)
})

test('map overlay panels use responsive panel tokens', () => {
  assert.match(mapCss, /width:\s*var\(--panel-overlay-sm\)/)
  assert.match(mapCss, /width:\s*min\(196px,\s*var\(--panel-overlay-sm\)\)/)
  assert.match(mapCss, /\.basemap-switcher/)
  assert.doesNotMatch(mapCss, /\.map-view-wrapper \.layer-drawer\s*\{[^}]*width:\s*286px/s)
  assert.doesNotMatch(mapCss, /\.dev-layer-panel\s*\{[^}]*width:\s*160px/s)
  assert.doesNotMatch(mapCss, /\.sigwx-legend-modal\s*\{[^}]*width:\s*280px/s)
})

test('route briefing panel uses responsive medium panel token', () => {
  assert.match(routeCss, /width:\s*var\(--panel-overlay-md\)/)
  assert.match(routeCss, /\.vertical-profile-window/)
  assert.doesNotMatch(routeCss, /\.route-check-panel\s*\{[^}]*width:\s*376px/s)
})

test('airport drawer uses responsive large drawer token', () => {
  assert.match(airportCss, /width:\s*min\(var\(--panel-drawer-lg\),\s*calc\(100vw - var\(--active-sidebar-width\)\)\)/)
  assert.match(airportCss, /@media \(max-width: 719px\)\s*\{[\s\S]*?\.airport-panel\s*\{[^}]*z-index:\s*120/s)
  assert.doesNotMatch(airportCss, /\.airport-panel\s*\{[^}]*width:\s*800px/s)
})

test('monitoring dashboard documents shared responsive breakpoints', () => {
  assert.match(monitoringCss, /ProjectAMO responsive layout policy/)
  assert.match(monitoringCss, /@media \(max-width: 1199px\)/)
  assert.match(monitoringCss, /@media \(max-width: 979px\)/)
  assert.match(monitoringCss, /@media \(max-width: 719px\)/)
})

test('monitoring phone settings task renders settings inline instead of a modal launcher', () => {
  assert.match(monitoringSettings, /variant\s*=\s*["']modal["']/)
  assert.match(monitoringSettings, /isInline/)
  assert.match(monitoringPage, /className="phone-settings-task"[^]*renderSettingsPanel\('inline'\)/)
  assert.match(monitoringPage, /<Settings[^]*variant=\{variant\}/)
  assert.doesNotMatch(monitoringPage, /className="settings-icon-btn phone-settings-open"/)
  assert.match(monitoringCss, /phone-settings-inline/)
})

test('route briefing phone map mode is parent-owned and does not use a fake map placeholder', () => {
  assert.match(mapView, /routeBriefingMapMode/)
  assert.match(mapView, /data-route-briefing-map-mode/)
  assert.match(mapCss, /@media \(max-width: 719px\)[^]*data-route-briefing-map-mode/)
  assert.doesNotMatch(mapView, /route-check-(fake|placeholder|preview-map)/i)
})
