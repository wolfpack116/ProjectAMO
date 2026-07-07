// #13 알림센터 표시 포맷 — 피드 행(type/target/toVal)을 한 줄 문구·심각도 레벨로. 백엔드 sender.formatAlert 미러(ko).
// 피드 API는 수치만 반환(문구 미포함) → 프론트에서 조립(i18n·경량화). 임계 라벨 변경 시 sender.js와 동기화.

const TYPE_LABEL = {
  CEIL: '운고', VIS: '시정', CATEGORY: '비행범주',
  ALTERNATE_FLIP: '교체공항 필요', ENROUTE_HAZARD: '경로 위험',
  ENROUTE_ICE_TURB: '경로 착빙/난류', WX: '기상현상', NO_CHANGE_CONFIRM: '이상없음',
}
const UNIT = { CEIL: 'ft', VIS: 'm' }

export function formatNotification(n) {
  const t = n.target ?? ''
  switch (n.type) {
    case 'CEIL':
    case 'VIS':
      return `${t} ${TYPE_LABEL[n.type]} ${n.toVal}${UNIT[n.type]} — 내 미니마 아래`
    case 'ALTERNATE_FLIP':
      return `${t} 교체공항 새로 필요`
    case 'ENROUTE_HAZARD':
      return `경로 신규 위험: ${n.toVal ?? t}`
    case 'ENROUTE_ICE_TURB':
      return `경로 ${t === 'icing' ? '착빙' : '난류'} ${n.toVal}(심)`
    case 'WX':
      return `${t} ${n.toVal}`
    default:
      return `${t} ${TYPE_LABEL[n.type] ?? n.type}`
  }
}

// 심각도 → 디자인 헌법 레벨색(§5). CRITICAL/HIGH=red, MEDIUM=amber, 그 외=gray.
export function severityLevel(severity) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'red'
  if (severity === 'MEDIUM') return 'amber'
  return 'gray'
}

export function relTime(iso) {
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}
