import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('hidden Mapbox road color keeps alpha high enough for Standard basemap expressions', () => {
  const source = readFileSync(join(__dirname, 'MapView.jsx'), 'utf8')
  const match = source.match(/const HIDDEN_ROAD_COLOR = 'rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)'/)

  assert.ok(match, 'HIDDEN_ROAD_COLOR should be an rgba literal')
  assert.ok(Number(match[1]) >= 0.2, 'Mapbox Standard subtracts 0.2 from road alpha in derived color expressions')
})
