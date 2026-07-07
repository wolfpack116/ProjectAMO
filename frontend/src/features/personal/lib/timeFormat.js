// UTC ISO → "MM-DD HH:MMZ / HH:MM KST" 병기. KST = UTC+9 고정(서머타임 없음).
export function formatZAndKst(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const mm = pad(d.getUTCMonth() + 1)
  const dd = pad(d.getUTCDate())
  const hh = pad(d.getUTCHours())
  const mi = pad(d.getUTCMinutes())
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  const khh = pad(kst.getUTCHours())
  const kmi = pad(kst.getUTCMinutes())
  return `${mm}-${dd} ${hh}:${mi}Z / ${khh}:${kmi} KST`
}

// UTC ISO → <input type="datetime-local"> 로컬 표시값("YYYY-MM-DDTHH:mm").
export function isoToLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// <input type="datetime-local"> 값(로컬) → UTC ISO. 빈 값이면 null.
export function localInputToIso(localValue) {
  if (!localValue) return null
  const d = new Date(localValue)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace('.000Z', 'Z')
}
