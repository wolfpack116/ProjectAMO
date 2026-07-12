import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVfrLegTerrain } from '../src/briefing/profile-composer.js'

// 경유점 3개(0/10/20NM) → leg 2개. 샘플 표고(m)의 구간별 최댓값을 ft로 반환하는지.
const axis = {
  samples: [
    { index: 0, distanceNm: 0 },
    { index: 1, distanceNm: 5 },
    { index: 2, distanceNm: 10 },
    { index: 3, distanceNm: 15 },
    { index: 4, distanceNm: 20 },
  ],
}
const terrainResult = {
  terrain: {
    values: [
      { index: 0, elevationM: 100 },
      { index: 1, elevationM: 300 }, // leg1 최고
      { index: 2, elevationM: 200 },
      { index: 3, elevationM: 500 }, // leg2 최고
      { index: 4, elevationM: 150 },
    ],
  },
}
const waypoints = [
  { id: 'RKSS', distanceNm: 0 },
  { id: 'WP1', distanceNm: 10 },
  { id: 'RKPC', distanceNm: 20 },
]

test('leg별 최고 지형고도를 ft로 계산', () => {
  const legs = buildVfrLegTerrain(waypoints, axis, terrainResult)
  assert.equal(legs.length, 2)
  assert.deepEqual(
    legs.map((l) => [l.fromLabel, l.toLabel, l.maxTerrainFt]),
    [['RKSS', 'WP1', 984], ['WP1', 'RKPC', 1640]], // 300m→984ft, 500m→1640ft
  )
})

test('표고 없는 샘플은 건너뛰고, 전부 없으면 null', () => {
  const legs = buildVfrLegTerrain(waypoints, axis, { terrain: { values: [] } })
  assert.deepEqual(legs.map((l) => l.maxTerrainFt), [null, null])
})

test('경유점 2개 미만이면 빈 배열', () => {
  assert.deepEqual(buildVfrLegTerrain([{ id: 'A', distanceNm: 0 }], axis, terrainResult), [])
})
