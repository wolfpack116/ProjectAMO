import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRouteFile, extractRoutePaths, simplifyRoute, snapEndpointsToAirports, isWithinKoreaFir } from './routeImport.js'

const GEOJSON_LINE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'RKSS-RKPK VFR sample' },
      geometry: { type: 'LineString', coordinates: [[126.79, 37.5583], [127.4, 37.0], [128.9382, 35.1795]] },
    },
  ],
})

test('parseRouteFile + extractRoutePaths: GeoJSON LineString → 1개 후보', () => {
  const parsed = parseRouteFile('route.geojson', GEOJSON_LINE)
  const candidates = extractRoutePaths(parsed)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].kind, 'route')
  assert.equal(candidates[0].label, 'RKSS-RKPK VFR sample')
  assert.equal(candidates[0].coords.length, 3)
  assert.deepEqual(candidates[0].coords[0], [126.79, 37.5583])
})

test('parseRouteFile: 확장자 .json도 GeoJSON으로 처리', () => {
  const parsed = parseRouteFile('route.json', GEOJSON_LINE)
  assert.equal(extractRoutePaths(parsed).length, 1)
})

test('parseRouteFile: 깨진 GeoJSON은 에러', () => {
  assert.throws(() => parseRouteFile('bad.geojson', '{not json'))
})
