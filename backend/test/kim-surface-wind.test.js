import assert from 'node:assert/strict'
import test from 'node:test'

import { parseKimGridText } from '../src/parsers/kim-grid-parser.js'
import { buildKimGridUrl } from '../src/api-client.js'
import { buildKimSurfaceWindField, resolveKimSurfaceWindCandidates } from '../src/processors/kim-surface-wind-processor.js'

const BOUNDS = {
  lonMin: 119,
  latMin: 30,
  lonMax: 119.166666,
  latMax: 30.166666,
  dx: 0.083333,
  dy: 0.083333,
}

const BOUNDS_2X2 = {
  lonMin: 119,
  latMin: 30,
  lonMax: 119.083333,
  latMax: 30.083333,
  dx: 0.083333,
  dy: 0.083333,
}

test('parseKimGridText parses KIM ASCII j blocks and keeps zero-byte payloads with numeric rows', () => {
  const text = [
    '# variable: u10m',
    '# unit: m/s',
    '# fsize: 0byte',
    '# j = 1',
    '1.0 2.0 3.0',
    '# j = 2',
    '4.0 5.0 6.0',
  ].join('\n')

  const grid = parseKimGridText(text, { variable: 'u10m', level: 0, bounds: BOUNDS })

  assert.equal(grid.variable, 'u10m')
  assert.equal(grid.unit, 'm/s')
  assert.equal(grid.nx, 3)
  assert.equal(grid.ny, 2)
  assert.deepEqual(grid.values, [1, 2, 3, 4, 5, 6])
})

test('parseKimGridText uses KIM i/j dimensions when numeric rows are line-wrapped', () => {
  const text = [
    '# fname: /ARCV/RAWD/MODL/GDPS/NE57/example.nc, fsize: 0byte',
    '# variable = u10m, unit = m/s, level = 0, i = 5, j = 2, map = S',
    '# j = 1',
    '1 2 3',
    '4 5',
    '# j = 2',
    '6 7 8',
    '9 10',
  ].join('\n')

  const grid = parseKimGridText(text, { variable: 'u10m', level: 0, bounds: BOUNDS })

  assert.equal(grid.nx, 5)
  assert.equal(grid.ny, 2)
  assert.deepEqual(grid.values, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('parseKimGridText rejects missing variables even when the HTTP request succeeds', () => {
  assert.throws(
    () => parseKimGridText('Variable not found: v10m', { variable: 'v10m', level: 0, bounds: BOUNDS }),
    /Variable not found/i,
  )
})

test('buildKimSurfaceWindField combines u/v, calculates fixed speed stats, and encodes int16 JSON', () => {
  const uGrid = {
    variable: 'u10m',
    unit: 'm/s',
    level: 0,
    nx: 2,
    ny: 2,
    bounds: BOUNDS_2X2,
    values: [0, 3, 0, 8],
  }
  const vGrid = {
    ...uGrid,
    variable: 'v10m',
    values: [0, 4, 12, 15],
  }

  const field = buildKimSurfaceWindField({
    uGrid,
    vGrid,
    tmfc: '2026051800',
    hf: 3,
    fetchedAt: '2026-05-18T03:05:00.000Z',
  })

  assert.equal(field.type, 'kim_surface_wind')
  assert.equal(field.model, 'KIMG/NE57')
  assert.equal(field.time.validTime, '2026-05-18T03:00:00.000Z')
  assert.equal(field.encoding, 'int16-scaled-json-v1')
  assert.equal(field.scale, 0.01)
  assert.deepEqual(field.u, [0, 300, 0, 800])
  assert.deepEqual(field.v, [0, 400, 1200, 1500])
  assert.equal(field.stats.minSpeed, 0)
  assert.equal(field.stats.maxSpeed, 17)
  assert.equal(field.stats.meanSpeed, 8.5)
})

test('buildKimSurfaceWindField rejects grids that do not match configured bounds', () => {
  const uGrid = {
    variable: 'u10m',
    unit: 'm/s',
    level: 0,
    nx: 2,
    ny: 2,
    bounds: BOUNDS,
    values: [0, 1, 2, 3],
  }
  const vGrid = {
    ...uGrid,
    variable: 'v10m',
    values: [0, 1, 2, 3],
  }

  assert.throws(
    () => buildKimSurfaceWindField({ uGrid, vGrid, tmfc: '2026051800', hf: 0 }),
    /nx mismatch/i,
  )
})

test('resolveKimSurfaceWindCandidates starts with recent synoptic cycles and hf 0', () => {
  const candidates = resolveKimSurfaceWindCandidates(new Date('2026-05-18T05:20:00.000Z'))

  assert.deepEqual(candidates.slice(0, 3), [
    { tmfc: '2026051800', hf: 0 },
    { tmfc: '2026051718', hf: 0 },
    { tmfc: '2026051712', hf: 0 },
  ])
})

test('buildKimGridUrl uses the KMA APIHub KIM cgi endpoint', () => {
  const url = buildKimGridUrl({
    data: 'U',
    name: 'u10m',
    level: 0,
    tmfc: '2026051800',
    hf: 0,
    sub: '1429,1441,1633,1609',
  })

  assert.ok(url.startsWith('https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-kim_nc_xy_txt2?'))
  assert.ok(url.includes('group=KIMG'))
  assert.ok(url.includes('nwp=NE57'))
  assert.ok(url.includes('name=u10m'))
  assert.ok(url.includes('map=S'))
})
