import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize, deriveScope } from '../src/processors/notam-processor.js'

test('categorize: subject-code → category enum', () => {
  assert.equal(categorize('QRPCA'), 'prohibited')
  assert.equal(categorize('QWMLW'), 'firing')
  assert.equal(categorize('QRDCA'), 'danger')
  assert.equal(categorize('QRTCA'), 'restricted')
  assert.equal(categorize('QRRCA'), 'restricted')
  assert.equal(categorize('QRACA'), 'restricted')
  assert.equal(categorize('QOBCE'), 'obstacle')
  assert.equal(categorize('QPOCH'), 'obstacle')
  assert.equal(categorize('QGAXX'), 'facility') // GNSS facility
  assert.equal(categorize('QMRLC'), 'facility') // runway
  assert.equal(categorize('QZZZZ'), 'other')    // unmapped
  assert.equal(categorize(null), 'other')
})

test('deriveScope: FIR code vs airport', () => {
  assert.equal(deriveScope('RKRR'), 'fir')
  assert.equal(deriveScope('RKSI'), 'airport')
})
