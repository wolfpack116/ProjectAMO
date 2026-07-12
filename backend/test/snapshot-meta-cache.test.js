import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

function writeLatest(root, type, contentHash) {
  const dir = path.join(root, type)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, 'latest.json')
  fs.writeFileSync(
    filePath,
    JSON.stringify({ type, content_hash: contentHash, updated_at: new Date().toISOString() }),
    'utf8',
  )
  return filePath
}

test('getCachedSnapshotMeta reuses cache within TTL and invalidates on source mtime change', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-meta-cache-'))
  process.env.NODE_ENV = 'test'
  process.env.DATA_PATH = root

  const metarPath = writeLatest(root, 'metar', 'hash-1')
  writeLatest(root, 'metar_overseas', 'overseas-hash-1')
  writeLatest(root, 'taf_overseas', 'taf-overseas-hash-1')
  writeLatest(root, 'sigmet_overseas', 'sigmet-overseas-hash-1')
  const { getCachedSnapshotMeta } = await import(`../server.js?snapshot-meta-cache-test=${Date.now()}`)

  const first = getCachedSnapshotMeta(1000)
  const second = getCachedSnapshotMeta(1001)
  assert.equal(second, first)
  assert.equal(second.metar.hash, 'hash-1')
  assert.equal(second.metarOverseas.hash, 'overseas-hash-1')
  assert.equal(second.tafOverseas.hash, 'taf-overseas-hash-1')
  assert.equal(second.sigmetOverseas.hash, 'sigmet-overseas-hash-1')
  // 죽은 별칭 kimWind/kim_wind는 제거됨 (소비처 0건) — 되살아나지 않도록 가드
  assert.equal('kimWind' in second, false)
  assert.equal('kim_wind' in second, false)

  writeLatest(root, 'metar', 'hash-2')
  fs.utimesSync(metarPath, new Date('2099-01-01T00:00:00.000Z'), new Date('2099-01-01T00:00:00.000Z'))

  const third = getCachedSnapshotMeta(1002)
  assert.notEqual(third, first)
  assert.equal(third.metar.hash, 'hash-2')

  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.DATA_PATH
})
