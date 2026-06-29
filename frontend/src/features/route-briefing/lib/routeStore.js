// Saved VFR/IFR routes in localStorage. We store only inputs (form + waypoints +
// perf/time); routeResult is rebuilt by re-searching on load (navdata stays fresh).
const KEY = 'projectamo.savedRoutes.v1'

function read() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function write(routes) {
  localStorage.setItem(KEY, JSON.stringify(routes))
}

export function listSavedRoutes() {
  return read().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
}

// snapshot: { routeForm, vfrWaypoints, cruiseAltitudeFt, alternateAirport, etd }
export function saveRoute(name, snapshot) {
  const routes = read()
  const entry = { id: `r${Date.now()}`, name: name || '이름 없는 경로', savedAt: Date.now(), ...snapshot }
  routes.push(entry)
  write(routes)
  return entry
}

export function deleteSavedRoute(id) {
  write(read().filter((r) => r.id !== id))
}
