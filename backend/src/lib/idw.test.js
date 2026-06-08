import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { idwInterpolate } from './idw.js'

describe('idwInterpolate', () => {
  it('returns Float32Array of gridSize^2', () => {
    const result = idwInterpolate([{ x: 0.5, y: 0.5, value: 1000 }], 4)
    assert.ok(result instanceof Float32Array)
    assert.equal(result.length, 16)
  })

  it('returns source value at exact point location', () => {
    const result = idwInterpolate([{ x: 0, y: 0, value: 3000 }], 4)
    assert.ok(Math.abs(result[0] - 3000) < 1)
  })

  it('midpoint between two equal-distance points averages their values', () => {
    const pts = [{ x: 0, y: 0.5, value: 0 }, { x: 1, y: 0.5, value: 1000 }]
    const result = idwInterpolate(pts, 3)
    const mid = result[1 * 3 + 1]
    assert.ok(Math.abs(mid - 500) < 1, `mid=${mid}`)
  })

  it('fills constant value when all points have same value', () => {
    const pts = [
      { x: 0.2, y: 0.2, value: 2000 },
      { x: 0.8, y: 0.8, value: 2000 },
    ]
    const result = idwInterpolate(pts, 4)
    assert.ok(result.every(v => Math.abs(v - 2000) < 1))
  })
})
