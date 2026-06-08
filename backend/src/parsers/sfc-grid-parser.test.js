import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseSfcAscii, sfcPixelToLatLon, SFC_W, SFC_H } from './sfc-grid-parser.js'

describe('parseSfcAscii', () => {
  it('returns Float32Array of SFC_W * SFC_H', () => {
    const total = SFC_W * SFC_H
    const vals = Array.from({ length: total }, (_, i) => i % 5 === 0 ? -999.0 : 50000.0)
    const text = `  ${SFC_W},  ${SFC_H},=\n${vals.join(',')}\n`
    const result = parseSfcAscii(text)
    assert.ok(result instanceof Float32Array)
    assert.equal(result.length, total)
  })

  it('converts raw 10m units to metres (÷10)', () => {
    const total = SFC_W * SFC_H
    const text = `  ${SFC_W},  ${SFC_H},=\n${Array(total).fill('50000.0').join(',')}\n`
    const result = parseSfcAscii(text)
    assert.ok(Math.abs(result[0] - 5000) < 0.1)
  })

  it('maps fill value (-999) to -1', () => {
    const total = SFC_W * SFC_H
    const text = `  ${SFC_W},  ${SFC_H},=\n${Array(total).fill('-999.0').join(',')}\n`
    const result = parseSfcAscii(text)
    assert.ok(result.every(v => v === -1))
  })
})

describe('sfcPixelToLatLon', () => {
  it('row 0, col 0 → northwest corner', () => {
    const { lat, lon } = sfcPixelToLatLon(0, 0)
    assert.ok(Math.abs(lat - 40.35) < 0.1, `lat=${lat}`)
    assert.ok(Math.abs(lon - 120.67) < 0.1, `lon=${lon}`)
  })

  it('bottom-right pixel → southeast corner', () => {
    const { lat, lon } = sfcPixelToLatLon(SFC_W - 1, SFC_H - 1)
    assert.ok(Math.abs(lat - 30.74) < 0.1, `lat=${lat}`)
    assert.ok(Math.abs(lon - 133.07) < 0.1, `lon=${lon}`)
  })
})
