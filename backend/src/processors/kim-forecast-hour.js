function tmfcToMs(tmfc) {
  const s = String(tmfc || '')
  if (!/^\d{10}$/.test(s)) return null
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10))
}

// Returns smallest hf whose valid time (tmfc+hf hours) >= nowMs.
// Falls back to last candidate if all valid times are past.
// Returns first candidate if run itself is in the future.
export function selectNearestForecastHour({ tmfc, nowMs = Date.now(), candidateHours = [] }) {
  const baseMs = tmfcToMs(tmfc)
  const hours = [...candidateHours].sort((a, b) => a - b)
  if (baseMs == null || hours.length === 0) return hours[0] ?? 0
  const future = hours.filter((hf) => baseMs + hf * 3_600_000 >= nowMs)
  return future.length > 0 ? future[0] : hours[hours.length - 1]
}
