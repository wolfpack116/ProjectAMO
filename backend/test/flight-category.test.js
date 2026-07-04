import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryFor, categoryDetail, to3Level, levelForCategory } from '../src/briefing/flight-category.js'

test('categoryFor: VFR when vis and ceiling high', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 3000 }), 'VFR')
})
test('categoryFor: MVFR when ceiling 1000-3000', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 1500 }), 'MVFR')
})
test('categoryFor: IFR when vis 1600-5000', () => {
  assert.equal(categoryFor({ visibilityM: 3000, ceilingFt: 5000 }), 'IFR')
})
test('categoryFor: LIFR when ceiling below 500', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: 200 }), 'LIFR')
})
test('categoryFor: takes the worse of vis and ceiling', () => {
  assert.equal(categoryFor({ visibilityM: 800, ceilingFt: 5000 }), 'LIFR')
})
test('categoryFor: null ceiling treated as unlimited', () => {
  assert.equal(categoryFor({ visibilityM: 9999, ceilingFt: null }), 'VFR')
})
test('categoryDetail: driver=ceiling when ceiling is the limiting factor', () => {
  assert.deepEqual(categoryDetail({ visibilityM: 9999, ceilingFt: 200 }), { category: 'LIFR', driver: 'ceiling' })
})
test('categoryDetail: driver=visibility when visibility is the limiting factor', () => {
  assert.deepEqual(categoryDetail({ visibilityM: 800, ceilingFt: 5000 }), { category: 'LIFR', driver: 'visibility' })
})
test('categoryDetail: driver=both when vis and ceiling agree', () => {
  assert.deepEqual(categoryDetail({ visibilityM: 9999, ceilingFt: 3000 }), { category: 'VFR', driver: 'both' })
})
test('categoryDetail: category matches categoryFor', () => {
  assert.equal(categoryDetail({ visibilityM: 3000, ceilingFt: 5000 }).category, categoryFor({ visibilityM: 3000, ceilingFt: 5000 }))
})
test('to3Level: folds MVFR up into VFR, leaves others', () => {
  assert.equal(to3Level('MVFR'), 'VFR')
  assert.equal(to3Level('VFR'), 'VFR')
  assert.equal(to3Level('IFR'), 'IFR')
  assert.equal(to3Level('LIFR'), 'LIFR')
})
test('levelForCategory: VFR/MVFR=green, IFR=amber, LIFR=red', () => {
  assert.equal(levelForCategory('VFR'), 'green')
  assert.equal(levelForCategory('MVFR'), 'green')
  assert.equal(levelForCategory('IFR'), 'amber')
  assert.equal(levelForCategory('LIFR'), 'red')
})
