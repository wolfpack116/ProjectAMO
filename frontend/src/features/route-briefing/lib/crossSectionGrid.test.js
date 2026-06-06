import test from 'node:test'
import assert from 'node:assert/strict'
import { msToKt, windBarbFeathers, windDirectionFromUV, isothermSegments } from './crossSectionGrid.js'

test('msToKt converts m/s to knots', () => {
  assert.equal(Math.round(msToKt(10)), 19)
})

test('windDirectionFromUV computes meteorological from-direction', () => {
  assert.equal(Math.round(windDirectionFromUV(5, 0)), 270)
  assert.equal(Math.round(windDirectionFromUV(0, 5)), 180)
})

test('windBarbFeathers builds barb feather counts from knots', () => {
  assert.deepEqual(windBarbFeathers(0), { pennants: 0, full: 0, half: 0 })
  assert.deepEqual(windBarbFeathers(75), { pennants: 1, full: 2, half: 1 })
})

test('isothermSegments finds 0C crossing on 2x2 cell', () => {
  const cells = { nx: 2, ny: 2, values: [-2, 2, -2, 2], xs: [0, 10], ys: [0, 10] }
  const segs = isothermSegments(cells, 0)
  assert.ok(segs.length > 0)
  assert.ok(Math.abs(segs[0][0].x - 5) < 0.01)
})
