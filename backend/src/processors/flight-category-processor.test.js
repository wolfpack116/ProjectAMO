import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyFlightCategory,
  worstCategory,
  CATEGORY_COLORS,
  cthIndexToPixel,
} from './flight-category-processor.js'

describe('classifyFlightCategory', () => {
  it('VFR: vis>=5000 and ceil>=1500ft', () => {
    assert.equal(classifyFlightCategory(5000, 1500), 'VFR')
    assert.equal(classifyFlightCategory(9999, 9999), 'VFR')
  })

  it('IFR: vis 800-4999', () => {
    assert.equal(classifyFlightCategory(800, 9999), 'IFR')
    assert.equal(classifyFlightCategory(4999, 9999), 'IFR')
  })

  it('IFR: ceil 500-1499ft', () => {
    assert.equal(classifyFlightCategory(9999, 500), 'IFR')
    assert.equal(classifyFlightCategory(9999, 1499), 'IFR')
  })

  it('LIFR: vis<800', () => {
    assert.equal(classifyFlightCategory(799, 9999), 'LIFR')
    assert.equal(classifyFlightCategory(0, 9999), 'LIFR')
  })

  it('LIFR: ceil<500ft', () => {
    assert.equal(classifyFlightCategory(9999, 499), 'LIFR')
  })

  it('worst wins: bad vis + high ceil = LIFR', () => {
    assert.equal(classifyFlightCategory(100, 9999), 'LIFR')
  })

  it('fill vis (-1) treated as clear', () => {
    assert.equal(classifyFlightCategory(-1, 9999), 'VFR')
  })

  it('fill ceil (-1) treated as clear', () => {
    assert.equal(classifyFlightCategory(9999, -1), 'VFR')
  })
})

describe('worstCategory', () => {
  it('LIFR > IFR > VFR', () => {
    assert.equal(worstCategory('VFR', 'IFR'), 'IFR')
    assert.equal(worstCategory('IFR', 'LIFR'), 'LIFR')
    assert.equal(worstCategory('VFR', 'LIFR'), 'LIFR')
    assert.equal(worstCategory('VFR', 'VFR'), 'VFR')
    assert.equal(worstCategory('LIFR', 'IFR'), 'LIFR')
  })
})

describe('CATEGORY_COLORS', () => {
  it('has correct colors', () => {
    assert.equal(CATEGORY_COLORS.VFR, '#15803d')
    assert.equal(CATEGORY_COLORS.IFR, '#f97316')
    assert.equal(CATEGORY_COLORS.LIFR, '#dc2626')
  })
})

describe('cthIndexToPixel', () => {
  it('returns valid index for point inside Korea', () => {
    const idx = cthIndexToPixel(37.5, 127.0)
    assert.ok(idx !== null)
    assert.ok(idx >= 0 && idx < 900 * 900)
  })

  it('returns null for point far outside domain', () => {
    assert.equal(cthIndexToPixel(0, 0), null)
    assert.equal(cthIndexToPixel(60, 90), null)
  })
})
