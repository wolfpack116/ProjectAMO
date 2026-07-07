// #13 알림 발송 seam — diff가 적재한 알림(triggered_alerts 행)을 채널로 내보낸다. 얇게: 문구 포맷 + 채널 분기 하나.
// 인앱 = 이미 행 저장(무동작) · 텔레그램 = env 있으면 sendMessage(딥링크 버튼) · Web Push = Phase 2(자리만).
// 과한 추상화 금지(§7): 채널별 클래스/레지스트리 없이 dispatchAlert 한 곳에서 분기.

const TYPE_LABEL = {
  CEIL: '운고', VIS: '시정', CATEGORY: '비행범주',
  ALTERNATE_FLIP: '교체공항 필요', ENROUTE_HAZARD: '경로 위험',
  ENROUTE_ICE_TURB: '경로 착빙/난류', WX: '기상현상', NO_CHANGE_CONFIRM: '이상없음',
}
const SEV_MARK = { CRITICAL: '⛔', HIGH: '⚠️', MEDIUM: '🟡', LOW: 'ℹ️', INFO: 'ℹ️' }
const UNIT = { CEIL: 'ft', VIS: 'm' }

const hhmmZ = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`
}

// 글랜서블 한 줄(ko). alert = triggered_alerts 행/변경객체, route = { name, eta }.
export function formatAlert(alert, route = {}) {
  const mark = SEV_MARK[alert.severity] ?? ''
  const target = alert.target ?? ''
  const eta = route.eta ? ` · ETA ${hhmmZ(route.eta)}` : ''
  switch (alert.type) {
    case 'CEIL':
    case 'VIS':
      return `${mark} ${target} ${TYPE_LABEL[alert.type]} ${alert.to_val ?? alert.to}${UNIT[alert.type]} — 내 미니마 아래${eta}`
    case 'ALTERNATE_FLIP':
      return `${mark} ${target} 교체공항 새로 필요${eta}`
    case 'ENROUTE_HAZARD':
      return `${mark} 경로 신규 위험: ${alert.to_val ?? alert.to ?? target}`
    case 'ENROUTE_ICE_TURB':
      return `${mark} 경로 ${target === 'icing' ? '착빙' : '난류'} ${alert.to_val ?? alert.to}(심)`
    case 'WX':
      return `${mark} ${target} ${alert.to_val ?? alert.to}${eta}`
    default:
      return `${mark} ${target} ${TYPE_LABEL[alert.type] ?? alert.type}`
  }
}

// HIGH/CRITICAL만 즉시 푸시(텔레그램), MEDIUM 이하는 인앱만(§5-4 차등채널).
export function shouldPush(severity) {
  return severity === 'CRITICAL' || severity === 'HIGH'
}

// 텔레그램 sendMessage. env(TELEGRAM_BOT_TOKEN·CHAT_ID) 없으면 skip. 딥링크 = FRONTEND_ORIGIN/?flight=<id>.
export async function sendTelegram(text, { routeId } = {}, { fetchImpl = fetch, env = process.env } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chatId = env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { skipped: 'no_telegram_env' }
  const base = env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173'
  const url = routeId != null ? `${base}/?flight=${routeId}` : base
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: routeId != null ? { inline_keyboard: [[{ text: '비행 브리핑 열기', url }]] } : undefined,
      }),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// 알림 1건 발송 + 행에 결과 기록. 인앱은 행 저장으로 끝, 조건 충족 시 텔레그램.
export async function dispatchAlert(db, alert, route = {}, deps = {}) {
  const text = formatAlert(alert, route)
  const telegram = shouldPush(alert.severity)
    ? await sendTelegram(text, { routeId: route.id ?? alert.route_id }, deps)
    : { skipped: 'in_app_only' }
  const pushed = telegram.ok === true
  if (alert.id && db) {
    db.prepare('UPDATE triggered_alerts SET pushed_at=?, channel_status=? WHERE id=?')
      .run(pushed ? new Date(deps.now ?? Date.now()).toISOString() : null,
        JSON.stringify({ inapp: 'stored', telegram }), alert.id)
  }
  return { text, telegram }
}

export default { formatAlert, shouldPush, sendTelegram, dispatchAlert }
