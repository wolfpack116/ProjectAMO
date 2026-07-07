import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatAlert, shouldPush, sendTelegram, dispatchAlert } from '../src/alerts/sender.js'

const route = { id: 42, name: 'RKSI→RKPC', eta: '2026-07-08T12:10:00Z' }

test('formatAlert: CEIL 글랜서블 문구(공항·값·미니마·ETA)', () => {
  const s = formatAlert({ type: 'CEIL', severity: 'CRITICAL', target: 'RKPC', to_val: '400' }, route)
  assert.match(s, /RKPC/)
  assert.match(s, /운고 400ft/)
  assert.match(s, /미니마 아래/)
  assert.match(s, /12:10Z/)
})

test('formatAlert: 타입별 분기(교체·경로위험·출발TS)', () => {
  assert.match(formatAlert({ type: 'ALTERNATE_FLIP', severity: 'HIGH', target: 'RKPC' }, route), /교체공항 새로 필요/)
  assert.match(formatAlert({ type: 'ENROUTE_HAZARD', severity: 'HIGH', to_val: 'TS' }), /경로 신규 위험: TS/)
  assert.match(formatAlert({ type: 'WX', severity: 'HIGH', target: 'RKSI', to_val: 'TS' }, route), /RKSI TS/)
})

test('shouldPush: HIGH/CRITICAL만 즉시 푸시', () => {
  assert.equal(shouldPush('CRITICAL'), true)
  assert.equal(shouldPush('HIGH'), true)
  assert.equal(shouldPush('MEDIUM'), false)
})

test('sendTelegram: env 없으면 skip', async () => {
  const r = await sendTelegram('hi', { routeId: 1 }, { env: {} })
  assert.equal(r.skipped, 'no_telegram_env')
})

test('sendTelegram: env 있으면 sendMessage POST + 딥링크 버튼', async () => {
  let captured = null
  const fetchImpl = async (url, opts) => { captured = { url, body: JSON.parse(opts.body) }; return { ok: true, status: 200 } }
  const env = { TELEGRAM_BOT_TOKEN: 'TOK', TELEGRAM_CHAT_ID: '999', FRONTEND_ORIGIN: 'https://amo.example' }
  const r = await sendTelegram('경고 문구', { routeId: 42 }, { fetchImpl, env })
  assert.equal(r.ok, true)
  assert.match(captured.url, /botTOK\/sendMessage/)
  assert.equal(captured.body.chat_id, '999')
  assert.equal(captured.body.reply_markup.inline_keyboard[0][0].url, 'https://amo.example/?flight=42')
})

test('dispatchAlert: MEDIUM은 인앱만(텔레그램 미호출)', async () => {
  let called = false
  const fetchImpl = async () => { called = true; return { ok: true, status: 200 } }
  const env = { TELEGRAM_BOT_TOKEN: 'TOK', TELEGRAM_CHAT_ID: '999' }
  const res = await dispatchAlert(null, { type: 'ENROUTE_HAZARD', severity: 'MEDIUM', to_val: 'AIRMET' }, route, { fetchImpl, env })
  assert.equal(res.telegram.skipped, 'in_app_only')
  assert.equal(called, false)
})
