import { test } from 'node:test'
import assert from 'node:assert/strict'
import { obstacleType, OBSTACLE_TYPES, parseObstacleHeight } from './notamObstacleIcons.js'

test('obstacleType: 실제 NOTAM 본문 키워드 분류', () => {
  assert.equal(obstacleType('TEMP OBST(CRANES) ERECTED'), 'crane')
  assert.equal(obstacleType('TEMPO OBST(CRANE) ERECTED'), 'crane')
  assert.equal(obstacleType('OBST(TOWER CRANE, PILE DRIVER)'), 'crane') // 크레인 우선
  assert.equal(obstacleType('NEW ANTENNA TOWER ERECTED'), 'tower')
  assert.equal(obstacleType('WIND TURBINE INSTALLED'), 'turbine')
  assert.equal(obstacleType('CHIMNEY STACK'), 'chimney')
  assert.equal(obstacleType('NEW BUILDING'), 'building')
  assert.equal(obstacleType('UNKNOWN THING'), 'other')
  assert.equal(obstacleType(null), 'other')
})

test('parseObstacleHeight: 실제 HGT 본문 → FT + 기준면 (altitude 밴드 아님)', () => {
  assert.equal(parseObstacleHeight('... HGT : 20M AGL (65.6FT)'), '66FT AGL')     // 괄호 FT 우선
  assert.equal(parseObstacleHeight('HGT: 28M AGL'), '92FT AGL')                    // FT 없으면 M→FT
  assert.equal(parseObstacleHeight('HGT : 406FT AMSL)'), '406FT AMSL')
  assert.equal(parseObstacleHeight('HGT:22.60M(74.14FT) AMSL'), '74FT AMSL')
  assert.equal(parseObstacleHeight('no height here'), '')
})

test('OBSTACLE_TYPES: 분류 결과가 전부 아이콘 세트에 존재', () => {
  for (const s of ['CRANE', 'TOWER', 'WIND TURBINE', 'MAST', 'CHIMNEY', 'BUILDING', 'X']) {
    assert.ok(OBSTACLE_TYPES.includes(obstacleType(s)), `${s} → 아이콘 있어야`)
  }
})
