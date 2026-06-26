import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pointInPolygon, routeIntersectsGeometry, timeWindowsOverlap } from '../src/briefing/geo-time-match.js'

const square = { type: 'Polygon', coordinates: [[[0,0],[10,0],[10,10],[0,10],[0,0]]] }

test('pointInPolygon: inside', () => {
  assert.equal(pointInPolygon([5,5], square.coordinates[0]), true)
})
test('pointInPolygon: outside', () => {
  assert.equal(pointInPolygon([20,20], square.coordinates[0]), false)
})
test('routeIntersectsGeometry: a route sample falls inside', () => {
  const route = { type:'LineString', coordinates: [[-5,-5],[5,5],[20,20]] }
  assert.equal(routeIntersectsGeometry(route, square), true)
})
test('routeIntersectsGeometry: route entirely outside', () => {
  const route = { type:'LineString', coordinates: [[20,20],[30,30]] }
  assert.equal(routeIntersectsGeometry(route, square), false)
})
test('routeIntersectsGeometry: MultiPolygon supported', () => {
  const multi = { type:'MultiPolygon', coordinates: [ square.coordinates ] }
  const route = { type:'LineString', coordinates: [[5,5],[5,6]] }
  assert.equal(routeIntersectsGeometry(route, multi), true)
})
test('timeWindowsOverlap: overlapping', () => {
  assert.equal(timeWindowsOverlap(
    '2026-06-26T09:00:00Z','2026-06-26T10:30:00Z',
    '2026-06-26T10:00:00Z','2026-06-26T14:00:00Z'), true)
})
test('timeWindowsOverlap: disjoint', () => {
  assert.equal(timeWindowsOverlap(
    '2026-06-26T09:00:00Z','2026-06-26T10:00:00Z',
    '2026-06-26T11:00:00Z','2026-06-26T14:00:00Z'), false)
})
