const HOUR_MS = 3600 * 1000
const KST_OFFSET_MS = 9 * HOUR_MS

function pad2(n) { return String(n).padStart(2, '0') }

// Build a UTC ISO instant from wall-clock fields interpreted in tz ('UTC' | 'KST').
export function buildEtdIso({ year, month, day, hour, minute }, tz) {
  const y = Number.isFinite(year) ? year : new Date().getUTCFullYear()
  const utcMs = Date.UTC(y, month - 1, day, hour, minute, 0)
  const instant = tz === 'KST' ? utcMs - KST_OFFSET_MS : utcMs
  return new Date(instant).toISOString().replace('.000Z', 'Z')
}

// Decompose a UTC ISO instant into tz wall-clock fields (for the input).
export function etdFields(iso, tz) {
  const t = Date.parse(iso)
  const base = Number.isFinite(t) ? t : Date.now()
  const d = new Date(tz === 'KST' ? base + KST_OFFSET_MS : base)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}

// Compact time label in tz. withDate prepends 'MM-DD '.
export function formatBriefingTime(iso, tz, { withDate = false } = {}) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const d = new Date(tz === 'KST' ? t + KST_OFFSET_MS : t)
  const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  const label = tz === 'KST' ? `${hm} KST` : `${hm}Z`
  return withDate ? `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${label}` : label
}
