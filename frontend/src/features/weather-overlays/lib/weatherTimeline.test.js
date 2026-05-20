import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlaybackDelayMs, shouldUpdateWeatherTimelineSelection } from './weatherTimeline.js'

test('getPlaybackDelayMs converts playback speed to interval delay', () => {
  assert.equal(getPlaybackDelayMs(0.5), 1600)
  assert.equal(getPlaybackDelayMs(1), 800)
  assert.equal(getPlaybackDelayMs(2), 400)
  assert.equal(getPlaybackDelayMs(4), 200)
})

test('weather timeline slider updates selection while dragging', () => {
  assert.equal(shouldUpdateWeatherTimelineSelection('input'), true)
  assert.equal(shouldUpdateWeatherTimelineSelection('change'), true)
  assert.equal(shouldUpdateWeatherTimelineSelection('pointermove'), false)
  assert.equal(shouldUpdateWeatherTimelineSelection('pointerup'), false)
  assert.equal(shouldUpdateWeatherTimelineSelection('blur'), false)
})
