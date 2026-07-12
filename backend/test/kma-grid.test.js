import assert from 'node:assert/strict'
import test from 'node:test'

import { latLonToGrid } from '../src/utils/kma-grid.js'

test('서울시청 좌표는 기상청 격자 60/127로 변환된다', () => {
  const { nx, ny } = latLonToGrid(37.5665, 126.9780)
  assert.equal(nx, 60)
  assert.equal(ny, 127)
})

test('인천국제공항 좌표는 격자 51/124로 변환된다', () => {
  const { nx, ny } = latLonToGrid(37.4602, 126.4407)
  assert.equal(nx, 51)
  assert.equal(ny, 124)
})

test('변환 결과는 항상 한반도 격자 범위 안의 정수다', () => {
  const samples = [[33.5104, 126.4929], [38.0613, 128.6692], [34.9914, 126.3828]]
  for (const [lat, lon] of samples) {
    const { nx, ny } = latLonToGrid(lat, lon)
    assert.ok(Number.isInteger(nx) && nx > 0 && nx < 150, `nx out of range: ${nx}`)
    assert.ok(Number.isInteger(ny) && ny > 0 && ny < 150, `ny out of range: ${ny}`)
  }
})
