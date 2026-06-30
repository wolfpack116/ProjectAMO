import assert from 'node:assert/strict'
import test from 'node:test'

import { skyPtyToIcon, extractHourlySlots } from '../src/processors/ground-forecast-processor.js'

test('skyPtyToIcon: 강수형태(PTY)가 하늘상태(SKY)보다 우선', () => {
  assert.equal(skyPtyToIcon(1, 1), 'rain')   // 맑아도 비 오면 rain
  assert.equal(skyPtyToIcon(4, 3), 'snow')
  assert.equal(skyPtyToIcon(1, 0), 'sunny')
  assert.equal(skyPtyToIcon(3, 0), 'mostly_cloudy')
  assert.equal(skyPtyToIcon(4, 0), 'cloudy')
})

function makeItem(date, time, category, value) {
  return { fcstDate: date, fcstTime: time, category, fcstValue: value }
}

test('extractHourlySlots: 향후 24h를 3시간 간격 8슬롯으로 추출', () => {
  // 기준 시각 2026-06-30 14:00 KST → UTC 05:00
  const now = new Date('2026-06-30T05:00:00Z')
  const items = []
  // 12:00부터 +27h까지 매시간 TMP/POP/SKY/PTY 생성
  for (let h = 12; h <= 39; h += 1) {
    const day = h < 24 ? '20260630' : '20260701'
    const hh = String(h % 24).padStart(2, '0') + '00'
    items.push(makeItem(day, hh, 'TMP', String(20 + (h % 5))))
    items.push(makeItem(day, hh, 'POP', String((h % 6) * 10)))
    items.push(makeItem(day, hh, 'SKY', '1'))
    items.push(makeItem(day, hh, 'PTY', '0'))
  }

  const slots = extractHourlySlots(items, now)
  assert.equal(slots.length, 8)
  // 3의 배수 시각만, 현재(14시) 이후부터: 15,18,21,00,03,06,09 ... 첫 슬롯이 3의 배수이며 >= 13시
  for (const slot of slots) {
    assert.equal(Number(slot.time.slice(0, 2)) % 3, 0)
    assert.ok(Number.isFinite(slot.temp))
    assert.ok(Number.isFinite(slot.rainProb))
    assert.equal(slot.icon, 'sunny')
  }
  // 시간 오름차순
  const hours = slots.map((s) => Number(s.time.slice(0, 2)))
  assert.equal(hours[0], 15)
})

test('extractHourlySlots: 빈 입력은 빈 배열', () => {
  assert.deepEqual(extractHourlySlots([], new Date()), [])
})
