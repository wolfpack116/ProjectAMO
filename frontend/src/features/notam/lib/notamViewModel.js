// 시간상태(색의 유일한 축) + 고도 포맷(AGL/AMSL 기준면 보존). 순수 함수, 렌더 시점 계산.
export const SOON_WINDOW_MS = 2 * 60 * 60 * 1000 // "곧 발효" 판정 임계값(config 상수)

export const TIME_STATE = {
  active:   { key: 'active',   glyph: '●', label: '발효 중' },
  soon:     { key: 'soon',     glyph: '◐', label: '곧 발효' },
  upcoming: { key: 'upcoming', glyph: '○', label: '예정' },
}

// 카테고리는 아이콘 + 라벨로만 구분(색과 무관). icon 키는 NotamPanel/Tab에서 tabler로 매핑.
export const NOTAM_CATEGORIES = [
  { id: 'prohibited', label: '금지',   icon: 'ban' },
  { id: 'firing',     label: '사격',   icon: 'target-arrow' },
  { id: 'danger',     label: '위험',   icon: 'alert-triangle' },
  { id: 'restricted', label: '제한',   icon: 'shield-half' },
  { id: 'obstacle',   label: '장애물', icon: 'antenna' },
  { id: 'facility',   label: '시설',   icon: 'broadcast' },
  { id: 'other',      label: '기타',   icon: 'dots' },
]

export function deriveTimeState(validFrom, validTo, nowMs, soonWindowMs = SOON_WINDOW_MS) {
  const from = typeof validFrom === 'number' ? validFrom : Date.parse(validFrom)
  const to = typeof validTo === 'number' ? validTo : Date.parse(validTo)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 'upcoming'
  if (nowMs >= from && nowMs <= to) return 'active'
  if (nowMs < from && from - nowMs <= soonWindowMs) return 'soon'
  return 'upcoming'
}

function comma(n) {
  return Number(n).toLocaleString('en-US')
}

// SFC(0)~무제한(FL 999 등) → "전고도". 그 외 실제 범위. FT는 AGL/AMSL 라벨 보존, FL은 FLxxx.
export function formatAltitude(altitude) {
  if (!altitude) return ''
  const { lower, upper, unit, ref } = altitude
  if (unit === 'FL' && Number(lower) === 0 && Number(upper) >= 999) return '전고도'
  if (unit === 'FL') return `FL${lower}–FL${upper}`
  const lo = Number(lower) === 0 ? 'SFC' : comma(lower)
  const hi = `${comma(upper)}FT`
  const label = ref ? ` ${ref}` : '' // AGL/AMSL 라벨은 있을 때만; 기준면 불명이면 라벨 없이 값만(spec 안전 규칙)
  return `${lo}–${hi}${label}`
}

// 유효기간(NOTAM 최우선 정보). B) ~ C) 를 'MM/DD HH:MM ~ MM/DD HH:MM' (KST)로.
export function formatValidPeriod(validFrom, validTo, tz = 'KST') {
  const off = tz === 'KST' ? 9 * 3600000 : 0
  const fmt = (v) => {
    const ms = typeof v === 'number' ? v : Date.parse(v)
    if (!Number.isFinite(ms)) return '—'
    const d = new Date(ms + off)
    const p = (n) => String(n).padStart(2, '0')
    return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  }
  return `${fmt(validFrom)} ~ ${fmt(validTo)}`
}

const RANK = { active: 0, soon: 1, upcoming: 2 }
export function sortActiveFirst(items, nowMs) {
  return [...items].sort((a, b) =>
    RANK[deriveTimeState(a.valid_from, a.valid_to, nowMs)] -
    RANK[deriveTimeState(b.valid_from, b.valid_to, nowMs)])
}

export default { deriveTimeState, formatAltitude, formatValidPeriod, sortActiveFirst, NOTAM_CATEGORIES, TIME_STATE, SOON_WINDOW_MS }
