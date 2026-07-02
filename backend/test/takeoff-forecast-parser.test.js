import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, tmFcKstToIso } from '../src/parsers/takeoff-forecast-parser.js'

// 실제 apihub 응답(캡처).
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>00</resultCode><resultMsg>NORMAL_SERVICE</resultMsg></header><body><dataType>XML</dataType><items><item><icaoCode>RKJB</icaoCode><airportName>무안공항</airportName><tmFc>202109120000</tmFc><wd>30</wd><ws>6</ws><ta>24</ta><qnh>2988</qnh></item><item><icaoCode>RKJB</icaoCode><airportName>무안공항</airportName><tmFc>202109120100</tmFc><wd>40</wd><ws>6</ws><ta>16</ta><qnh>2987</qnh></item></items><numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`

test('tmFcKstToIso: KST wall-clock → UTC ISO', () => {
  assert.equal(tmFcKstToIso('202109120000'), '2021-09-11T15:00:00.000Z') // 00KST = 15Z 전날
  assert.equal(tmFcKstToIso('bad'), null)
})

test('parse: fields + qnh inHg×100 → hPa', () => {
  const r = parse(SAMPLE, 'RKJB')
  assert.equal(r.icao, 'RKJB')
  assert.equal(r.airportName, '무안공항')
  assert.equal(r.forecasts.length, 2)
  const f0 = r.forecasts[0]
  assert.equal(f0.time, '2021-09-11T15:00:00.000Z')
  assert.equal(f0.windDir, 30)
  assert.equal(f0.windSpeedKt, 6)
  assert.equal(f0.tempC, 24)
  assert.equal(f0.qnhHpa, Math.round(29.88 * 33.8639)) // 1012
})

test('parse: non-normal resultCode → null', () => {
  assert.equal(parse('<response><header><resultCode>99</resultCode></header></response>', 'RKSI'), null)
})

test('parse: empty items → null', () => {
  assert.equal(parse('<response><header><resultCode>03</resultCode></header><body><items></items></body></response>', 'RKSI'), null)
})
