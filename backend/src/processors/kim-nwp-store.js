import fs from 'node:fs'
import path from 'node:path'

import { KIM_NWP_FORECAST_HOURS, KIM_NWP_LEVELS } from './kim-nwp-model.js'

const ROOT_DIR = 'kim_nwp'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
}

function writeJsonAtomic(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function assertInsideRoot(root, filePath) {
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(filePath)
  const rel = path.relative(resolvedRoot, resolvedPath)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Resolved KIM NWP path escapes root: ${filePath}`)
  }
}

export function buildKimNwpRunId({ model, tmfc }) {
  if (!/^\d{10}$/.test(String(tmfc || ''))) throw new Error('Invalid KIM NWP tmfc')
  return `${safeSegment(model)}_${tmfc}`
}

export function validateKimNwpSelection({ tmfc, hf, levelId }) {
  if (!/^\d{10}$/.test(String(tmfc || ''))) throw new Error('Invalid KIM NWP tmfc')
  if (!KIM_NWP_FORECAST_HOURS.includes(Number(hf))) throw new Error('Invalid KIM NWP forecast hour')
  if (!KIM_NWP_LEVELS.some((level) => level.id === levelId)) throw new Error('Invalid KIM NWP level')
}

export function resolveKimNwpRoot(root) {
  return path.join(root, ROOT_DIR)
}

export function resolveKimNwpRunDir({ root, model, tmfc }) {
  return path.join(resolveKimNwpRoot(root), 'runs', buildKimNwpRunId({ model, tmfc }))
}

export function resolveKimNwpGridPath({ root, model, tmfc, hf, levelId }) {
  validateKimNwpSelection({ tmfc, hf, levelId })
  const filePath = path.join(
    resolveKimNwpRunDir({ root, model, tmfc }),
    'normalized',
    `hf${String(Number(hf)).padStart(3, '0')}`,
    levelId,
    'grid.json',
  )
  assertInsideRoot(resolveKimNwpRoot(root), filePath)
  return filePath
}

function resolveKimNwpManifestPath(root, runId) {
  if (!/^[a-zA-Z0-9_]+_\d{10}$/.test(String(runId || ''))) throw new Error('Invalid KIM NWP run id')
  const filePath = path.join(resolveKimNwpRoot(root), 'runs', runId, 'manifest.json')
  assertInsideRoot(resolveKimNwpRoot(root), filePath)
  return filePath
}

export function writeKimNwpGrid({ root, grid }) {
  const filePath = resolveKimNwpGridPath({
    root,
    model: grid.model,
    tmfc: grid.tmfc,
    hf: grid.hf,
    levelId: grid.level.id,
  })
  writeJsonAtomic(filePath, grid)
  return filePath
}

export function writeKimNwpLatest(root, latest) {
  writeJsonAtomic(path.join(resolveKimNwpRoot(root), 'latest.json'), latest)
}

export function writeKimNwpIndex(root, index) {
  writeJsonAtomic(path.join(resolveKimNwpRoot(root), 'index.json'), index)
}

export function writeKimNwpManifest(root, manifest) {
  const runId = manifest.runId || buildKimNwpRunId({ model: manifest.model, tmfc: manifest.tmfc })
  writeJsonAtomic(resolveKimNwpManifestPath(root, runId), { ...manifest, runId })
}

export function readKimNwpGrid({ root, model, tmfc, hf, levelId }) {
  return readJson(resolveKimNwpGridPath({ root, model, tmfc, hf, levelId }))
}

export function readKimNwpIndex(root) {
  const filePath = path.join(resolveKimNwpRoot(root), 'index.json')
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

export function readKimNwpLatest(root) {
  const filePath = path.join(resolveKimNwpRoot(root), 'latest.json')
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

export function readKimNwpManifest(root, runId) {
  const filePath = resolveKimNwpManifestPath(root, runId)
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

export function listKimNwpRuns(root) {
  const runsDir = path.join(resolveKimNwpRoot(root), 'runs')
  if (!fs.existsSync(runsDir)) return []
  return fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
}

export function cleanupKimNwpRuns({ root, maxRuns, latestRunId }) {
  const limit = Number(maxRuns)
  if (!Number.isFinite(limit) || limit <= 0) return
  const runsDir = path.join(resolveKimNwpRoot(root), 'runs')
  const usableRuns = listKimNwpRuns(root).filter((runId) => readKimNwpManifest(root, runId)?.usable === true)
  const keep = new Set(usableRuns.slice(0, limit))
  if (latestRunId) keep.add(latestRunId)
  for (const runId of listKimNwpRuns(root)) {
    if (keep.has(runId)) continue
    fs.rmSync(path.join(runsDir, runId), { recursive: true, force: true })
  }
}

export default {
  buildKimNwpRunId,
  cleanupKimNwpRuns,
  listKimNwpRuns,
  readKimNwpGrid,
  readKimNwpIndex,
  readKimNwpLatest,
  readKimNwpManifest,
  resolveKimNwpGridPath,
  validateKimNwpSelection,
  writeKimNwpGrid,
  writeKimNwpIndex,
  writeKimNwpLatest,
  writeKimNwpManifest,
}
