const PROFILES_KEY = 'amo_aircraft_profiles'
const LAST_KEY = 'amo_last_perf'

function memStore() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}
const fallback = memStore()
function store(s) {
  if (s) return s
  return typeof localStorage !== 'undefined' ? localStorage : fallback
}
function readJson(s, key, dflt) {
  try {
    const raw = store(s).getItem(key)
    return raw ? JSON.parse(raw) : dflt
  } catch { return dflt }
}

export function listProfiles(s) {
  const list = readJson(s, PROFILES_KEY, [])
  return Array.isArray(list) ? list : []
}

export function saveProfile({ name, tasKt, altitudeFt }, s) {
  const list = listProfiles(s).filter((p) => p.name !== name)
  list.push({ name, tasKt: Number(tasKt), altitudeFt: Number(altitudeFt) })
  store(s).setItem(PROFILES_KEY, JSON.stringify(list))
  return list
}

export function deleteProfile(name, s) {
  const list = listProfiles(s).filter((p) => p.name !== name)
  store(s).setItem(PROFILES_KEY, JSON.stringify(list))
  return list
}

export function getLastUsed(s) {
  return readJson(s, LAST_KEY, null)
}

export function setLastUsed({ tasKt, altitudeFt }, s) {
  const perf = { tasKt: Number(tasKt), altitudeFt: Number(altitudeFt) }
  store(s).setItem(LAST_KEY, JSON.stringify(perf))
  return perf
}
