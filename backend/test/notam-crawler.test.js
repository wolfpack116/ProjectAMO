import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isKml, countPlacemarks } from '../src/notam/notam-crawler.js'

test('isKml: recognizes a KML payload', () => {
  assert.equal(isKml("<?xml version='1.0'?><kml xmlns='...'><Document/></kml>"), true)
  assert.equal(isKml('<html>error page</html>'), false)
  assert.equal(isKml(''), false)
})

test('countPlacemarks: distinguishes empty KML from populated (재시도 판정 근거)', () => {
  assert.equal(countPlacemarks('<kml><Document></Document></kml>'), 0) // 유효 KML이지만 빈 것 → 재시도 대상
  assert.equal(countPlacemarks('<kml><Placemark/><Placemark></Placemark></kml>'), 2)
  assert.equal(countPlacemarks(''), 0)
})
