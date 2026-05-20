import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canRequestKimIcingField,
  getKimIcingFieldForSelection,
  getKimIcingSnapshotHash,
  makeKimIcingSelectionKey,
  selectIcingFallbackSelection,
} from './useKimIcing.js'

const INDEX = {
  latestRun: '2026051900',
  levels: [{ id: '850hPa' }],
  times: [{ hf: 3, validTime: '2026-05-19T03:00:00.000Z' }],
  availability: { '850hPa': { 3: { variables: ['T', 'rh_liq', 'w', 'tqc', 'tqi', 'tqr', 'tqs', 'cld'] } } },
}

test('selectIcingFallbackSelection returns null for empty icing availability', () => {
  assert.equal(selectIcingFallbackSelection({ latestRun: '2026051900', levels: [], times: [], availability: {} }, null), null)
})

test('selectIcingFallbackSelection keeps available pressure level', () => {
  assert.deepEqual(
    selectIcingFallbackSelection(INDEX, { tmfc: 'old', hf: 3, level: '850hPa' }),
    { tmfc: '2026051900', hf: 3, level: '850hPa' },
  )
})

test('icing cache key includes variable kind', () => {
  assert.equal(makeKimIcingSelectionKey({ tmfc: '2026051900', hf: 3, level: '850hPa' }), '2026051900:3:850hPa:icing')
})

test('snapshot hash prefers icing variable hash', () => {
  assert.equal(getKimIcingSnapshotHash({ kimNwp: { hash: 'all', variables: { icing: { hash: 'icing' } } } }), 'icing')
})

test('field selection rejects stale cached field', () => {
  const field = { type: 'kim_nwp_icing_potential' }
  assert.equal(getKimIcingFieldForSelection(field, '2026051900:6:850hPa:icing', { tmfc: '2026051900', hf: 3, level: '850hPa' }), null)
})

test('icing field request waits for a loaded index and available pressure selection', () => {
  assert.equal(canRequestKimIcingField(null, { tmfc: '2026051900', hf: 3, level: '850hPa' }), false)
  assert.equal(canRequestKimIcingField(INDEX, { tmfc: '2026051900', hf: 3, level: '10m' }), false)
  assert.equal(canRequestKimIcingField(INDEX, { tmfc: '2026051900', hf: 3, level: '850hPa' }), true)
})
