import fs from 'node:fs'
import path from 'node:path'

const ROOT_DIR = 'ktg'

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'))
}

function writeJsonAtomic(fp, payload) {
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(payload)}\n`, 'utf8')
  fs.renameSync(tmp, fp)
}

export function resolveKtgRoot(root) {
  return path.join(root, ROOT_DIR)
}

export function resolveKtgRunDir({ root, tmfc }) {
  return path.join(resolveKtgRoot(root), 'runs', tmfc)
}

export function resolveKtgHfDir({ root, tmfc, hf }) {
  return path.join(resolveKtgRunDir({ root, tmfc }), `hf${String(Number(hf)).padStart(3, '0')}`)
}

export function resolveKtgCoordsPath({ root, tmfc, hf }) {
  return path.join(resolveKtgHfDir({ root, tmfc, hf }), 'coords.json')
}

export function resolveKtgGridPath({ root, tmfc, hf, altFt }) {
  return path.join(resolveKtgHfDir({ root, tmfc, hf }), `${altFt}ft`, 'grid.json')
}

export function writeKtgGrid({ root, grid }) {
  writeJsonAtomic(resolveKtgGridPath({ root, tmfc: grid.tmfc, hf: grid.hf, altFt: grid.altFt }), grid)
}

export function writeKtgCoords({ root, tmfc, hf, coords }) {
  writeJsonAtomic(resolveKtgCoordsPath({ root, tmfc, hf }), coords)
}

export function writeKtgIndex(root, index) {
  writeJsonAtomic(path.join(resolveKtgRoot(root), 'index.json'), index)
}

export function writeKtgLatest(root, latest) {
  writeJsonAtomic(path.join(resolveKtgRoot(root), 'latest.json'), latest)
}

export function readKtgGridSafe({ root, tmfc, hf, altFt }) {
  try {
    return readJson(resolveKtgGridPath({ root, tmfc, hf, altFt }))
  } catch {
    return null
  }
}

export function readKtgCoords({ root, tmfc, hf }) {
  const fp = resolveKtgCoordsPath({ root, tmfc, hf })
  if (!fs.existsSync(fp)) return null
  return readJson(fp)
}

export function readKtgIndex(root) {
  const fp = path.join(resolveKtgRoot(root), 'index.json')
  if (!fs.existsSync(fp)) return null
  return readJson(fp)
}

export function readKtgLatest(root) {
  const fp = path.join(resolveKtgRoot(root), 'latest.json')
  if (!fs.existsSync(fp)) return null
  return readJson(fp)
}

export function listKtgRuns(root) {
  const runsDir = path.join(resolveKtgRoot(root), 'runs')
  if (!fs.existsSync(runsDir)) return []
  return fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a))
}

export function cleanupKtgRuns({ root, maxRuns, latestTmfc }) {
  const limit = Number(maxRuns)
  if (!Number.isFinite(limit) || limit <= 0) return
  const runs = listKtgRuns(root)
  const keep = new Set(runs.slice(0, limit))
  if (latestTmfc) keep.add(latestTmfc)
  const runsDir = path.join(resolveKtgRoot(root), 'runs')
  for (const r of runs) {
    if (keep.has(r)) continue
    fs.rmSync(path.join(runsDir, r), { recursive: true, force: true })
  }
}

export default {
  cleanupKtgRuns,
  listKtgRuns,
  readKtgCoords,
  readKtgGridSafe,
  readKtgIndex,
  readKtgLatest,
  resolveKtgCoordsPath,
  resolveKtgGridPath,
  writeKtgCoords,
  writeKtgGrid,
  writeKtgIndex,
  writeKtgLatest,
}
