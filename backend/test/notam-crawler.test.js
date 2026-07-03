import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isKml } from '../src/notam/notam-crawler.js'

test('isKml: recognizes a KML payload', () => {
  assert.equal(isKml("<?xml version='1.0'?><kml xmlns='...'><Document/></kml>"), true)
  assert.equal(isKml('<html>error page</html>'), false)
  assert.equal(isKml(''), false)
})
