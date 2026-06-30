import test from 'node:test'
import assert from 'node:assert/strict'

import { MET_LAYERS } from '../../weather-overlays/lib/weatherOverlayLayers.js'
import { hazardMapLayers } from './hazardLayers.js'

const briefing = (hazards = [], modelKinds = []) => ({
  sections: {
    adverse: { hazards },
    enroute: { model: { elements: modelKinds.map((kind) => ({ kind })) } },
  },
})

test('뇌우(TS) → 레이더+낙뢰+SIGMET', () => {
  const ids = hazardMapLayers(briefing([{ code: 'EMBD_TS', source: 'SIGMET' }]))
  for (const x of ['radar', 'lightning', 'sigmet']) assert.ok(ids.includes(x), `누락: ${x}`)
})

test('착빙/난류는 코드와 enroute 모델 둘 다에서 잡힌다', () => {
  assert.ok(hazardMapLayers(briefing([{ code: 'SEV_ICE', source: 'AIRMET' }])).includes('icing'))
  assert.ok(hazardMapLayers(briefing([], ['turbulence'])).includes('turbulence'))
})

test('태풍(TC) → 레이더+SIGMET (낙뢰는 아님)', () => {
  const ids = hazardMapLayers(briefing([{ code: 'TC' }]))
  assert.ok(ids.includes('radar') && ids.includes('sigmet'))
  assert.ok(!ids.includes('lightning'))
})

test('룰북은 코드 기준(출처 무관), 룰북 밖 코드는 무시', () => {
  assert.ok(hazardMapLayers(briefing([{ code: 'MOD_ICE', source: 'AIRMET' }])).includes('icing'))
  assert.deepEqual(hazardMapLayers(briefing([{ code: 'VA' }])), []) // VA는 아직 룰북에 없음
})

test('위험 없으면 빈 배열', () => {
  assert.deepEqual(hazardMapLayers(briefing([], [])), [])
  assert.deepEqual(hazardMapLayers(undefined), [])
})

test('반환 id는 모두 실제 MET 레이어 id (드리프트 방지)', () => {
  const valid = new Set(MET_LAYERS.map((l) => l.id))
  const all = hazardMapLayers(briefing(
    [{ code: 'EMBD_TS', source: 'SIGMET' }, { code: 'SEV_ICE', source: 'AIRMET' }, { code: 'MOD_TURB', source: 'SIGMET' }],
    ['icing', 'turbulence'],
  ))
  for (const id of all) assert.ok(valid.has(id), `MET 레이어에 없는 id: ${id}`)
})
