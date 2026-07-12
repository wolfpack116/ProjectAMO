import assert from 'node:assert/strict'
import test from 'node:test'
import { phenomenonKo, phenomenonText } from './phenomenonKo.js'

test('phenomenonKo maps known codes to 한글, null otherwise', () => {
  assert.equal(phenomenonKo('SEV_ICE'), '심한 착빙')
  assert.equal(phenomenonKo('EMBD_TS'), '차폐뇌우')
  assert.equal(phenomenonKo('NOPE'), null)
  assert.equal(phenomenonKo(''), null)
})

test('phenomenonText appends code for known, falls back otherwise', () => {
  assert.equal(phenomenonText('SEV_TURB'), '심한 난기류 (SEV_TURB)')
  assert.equal(phenomenonText('NOPE', 'Some Label'), 'Some Label')
  assert.equal(phenomenonText('MOD_X'), 'MOD X') // 코드 _→공백 폴백
  assert.equal(phenomenonText(''), '')
})
