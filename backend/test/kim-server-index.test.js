import assert from 'node:assert/strict'
import test from 'node:test'

process.env.NODE_ENV = 'test'
const {
  filterKimNwpIndexForMap,
  filterKimNwpIndexForMapVariables,
} = await import('../server.js?kim-server-index-test')

const INDEX = {
  type: 'kim_nwp_index',
  model: 'KIMG/NE57',
  latestRun: '2026051900',
  levels: [{ id: '850hPa' }],
  times: [
    { hf: 0, validTime: '2026-05-19T00:00:00.000Z' },
    { hf: 3, validTime: '2026-05-19T03:00:00.000Z' },
    { hf: 6, validTime: '2026-05-19T06:00:00.000Z' },
  ],
  availability: {
    '850hPa': {
      0: { variables: ['u', 'v'], path: 'hf0.json' },
      3: { variables: ['u', 'v'], path: 'hf3.json' },
      6: { variables: ['u', 'v'], path: 'hf6.json' },
    },
  },
}

test('filterKimNwpIndexForMap keeps nearest past time plus future times', () => {
  const filtered = filterKimNwpIndexForMap(INDEX, Date.parse('2026-05-19T03:06:00.000Z'))

  assert.deepEqual(filtered.times.map((time) => time.hf), [3, 6])
  assert.deepEqual(Object.keys(filtered.availability['850hPa']), ['3', '6'])
})

test('filterKimNwpIndexForMap does not keep every older past time', () => {
  const filtered = filterKimNwpIndexForMap(INDEX, Date.parse('2026-05-19T06:06:00.000Z'))

  assert.deepEqual(filtered.times.map((time) => time.hf), [6])
  assert.deepEqual(Object.keys(filtered.availability['850hPa']), ['6'])
})

test('filterKimNwpIndexForMapVariables chooses nearest past time after variable filtering', () => {
  const partialIndex = {
    ...INDEX,
    availability: {
      '850hPa': {
        0: { variables: ['u', 'v', 'T'], path: 'hf0.json' },
        3: { variables: ['u', 'v'], path: 'hf3.json' },
        6: { variables: ['u', 'v', 'T'], path: 'hf6.json' },
      },
    },
  }

  const filtered = filterKimNwpIndexForMapVariables(
    partialIndex,
    ['T'],
    Date.parse('2026-05-19T03:06:00.000Z'),
  )

  assert.deepEqual(filtered.times.map((time) => time.hf), [0, 6])
  assert.deepEqual(Object.keys(filtered.availability['850hPa']), ['0', '6'])
})
