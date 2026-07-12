import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryFor, categoryDetail, to3Level, levelForCategory } from '../src/briefing/flight-category.js'

// #6: 3단계(VFR/IFR/LIFR) + 공항 기본 미니마. frontend helpers.js classify*Category 미러.
test('categoryFor: VFR when vis and ceiling high', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 3000 }), 'VFR')
})
test('categoryFor: ceiling 1500 is still VFR (no MVFR band)', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 1500 }), 'VFR')
})
test('categoryFor: ceiling <1500 → IFR (패널식 컷, 브리핑 불일치 해소)', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 1400 }), 'IFR')
})
test('categoryFor: IFR when vis 1600-5000', () => {
  assert.equal(categoryFor({ visibilityM: 3000, ceilingFt: 5000 }), 'IFR')
})
test('categoryFor: without airport minima there is no fixed LIFR — low ceiling is IFR', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 200 }), 'IFR')
})
test('categoryFor: takes the worse of vis and ceiling', () => {
  assert.equal(categoryFor({ visibilityM: 800, ceilingFt: 5000 }), 'IFR')
})
test('categoryFor: below airport minima → LIFR (RKSI vis<175m)', () => {
  assert.equal(categoryFor({ visibilityM: 100, ceilingFt: 9999, icao: 'RKSI' }), 'LIFR')
})
test('categoryFor: at/above minima not LIFR (RKSI vis 200m ≥175 → IFR)', () => {
  assert.equal(categoryFor({ visibilityM: 200, ceilingFt: 9999, icao: 'RKSI' }), 'IFR')
})
test('categoryFor: null ceiling treated as unlimited', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: null }), 'VFR')
})
test('categoryDetail: driver=ceiling when ceiling is the limiting factor', () => {
  assert.deepEqual(categoryDetail({ visibilityM: 9999, ceilingFt: 200 }), { category: 'IFR', driver: 'ceiling' })
})
test('categoryDetail: driver=visibility when visibility is the limiting factor', () => {
  assert.deepEqual(categoryDetail({ visibilityM: 800, ceilingFt: 5000 }), { category: 'IFR', driver: 'visibility' })
})
test('categoryDetail: driver=both when vis and ceiling agree', () => {
  assert.deepEqual(categoryDetail({ visibilityM: 9999, ceilingFt: 3000 }), { category: 'VFR', driver: 'both' })
})
test('categoryDetail: category matches categoryFor', () => {
  assert.equal(categoryDetail({ visibilityM: 3000, ceilingFt: 5000 }).category, categoryFor({ visibilityM: 3000, ceilingFt: 5000 }))
})
test('to3Level: folds legacy MVFR up into VFR, leaves others', () => {
  assert.equal(to3Level('MVFR'), 'VFR')
  assert.equal(to3Level('VFR'), 'VFR')
  assert.equal(to3Level('IFR'), 'IFR')
  assert.equal(to3Level('LIFR'), 'LIFR')
})
test('levelForCategory: VFR=green, IFR=amber, LIFR=red', () => {
  assert.equal(levelForCategory('VFR'), 'green')
  assert.equal(levelForCategory('IFR'), 'amber')
  assert.equal(levelForCategory('LIFR'), 'red')
})
