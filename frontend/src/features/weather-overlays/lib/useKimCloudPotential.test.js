import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canRequestKimCloudField,
  getKimCloudFieldForSelection,
  getKimCloudSnapshotHash,
  makeKimCloudSelectionKey,
  selectCloudFallbackSelection,
} from './useKimCloudPotential.js'

const INDEX = {
  latestRun: '2026051900',
  levels: [{ id: '850hPa' }],
  times: [{ hf: 3, validTime: '2026-05-19T03:00:00.000Z' }],
  availability: { '850hPa': { 3: { variables: ['T', 'rh'] } } },
}

test('selectCloudFallbackSelection returns null for empty cloud availability', () => {
  assert.equal(selectCloudFallbackSelection({ latestRun: '2026051900', levels: [], times: [], availability: {} }, null), null)
})

test('selectCloudFallbackSelection keeps available selected pressure level', () => {
  assert.deepEqual(
    selectCloudFallbackSelection(INDEX, { tmfc: 'old', hf: 3, level: '850hPa' }),
    { tmfc: '2026051900', hf: 3, level: '850hPa' },
  )
})

test('cloud cache key includes variable kind', () => {
  assert.equal(makeKimCloudSelectionKey({ tmfc: '2026051900', hf: 3, level: '850hPa' }), '2026051900:3:850hPa:cloud')
})

test('snapshot hash prefers cloud variable hash', () => {
  assert.equal(getKimCloudSnapshotHash({ kimNwp: { hash: 'all', variables: { cloud: { hash: 'cloud' } } } }), 'cloud')
})

test('field selection rejects stale cached field', () => {
  const field = { type: 'kim_nwp_cloud_potential' }
  assert.equal(getKimCloudFieldForSelection(field, '2026051900:6:850hPa:cloud', { tmfc: '2026051900', hf: 3, level: '850hPa' }), null)
})

test('cloud field request waits for a loaded index and available pressure selection', () => {
  assert.equal(canRequestKimCloudField(null, { tmfc: '2026051900', hf: 3, level: '850hPa' }), false)
  assert.equal(canRequestKimCloudField(INDEX, { tmfc: '2026051900', hf: 3, level: '10m' }), false)
  assert.equal(canRequestKimCloudField(INDEX, { tmfc: '2026051900', hf: 3, level: '850hPa' }), true)
})
