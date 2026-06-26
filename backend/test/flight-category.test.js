import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoryFor, levelForCategory } from '../src/briefing/flight-category.js'

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
test('levelForCategory maps to colors', () => {
  assert.equal(levelForCategory('VFR'), 'green')
  assert.equal(levelForCategory('MVFR'), 'amber')
  assert.equal(levelForCategory('IFR'), 'red')
  assert.equal(levelForCategory('LIFR'), 'red')
})
