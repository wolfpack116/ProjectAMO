// Hardcoded-color guardrail (warning-only). Flags raw color literals in CSS that
// have a design-token equivalent — i.e. cool chrome neutrals, the slate ramp that
// maps to Fluent grey, and forbidden MS-blue accents. Semantic colors (weather
// ramps, advisory identity, warm "paper", dark-navy identity) have no token
// equivalent and are NOT flagged. Exempt an intentional line with a trailing
// `/* color-lint-ignore: reason */` comment (e.g. SIGWX standard-chart blue).
//
//   node scripts/lint-colors.mjs        # warn, always exit 0
//   node scripts/lint-colors.mjs --strict   # exit 1 if any finding (for CI later)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const strict = process.argv.includes('--strict')

// raw hex -> suggested token. Only colors that SHOULD be a token live here.
// (white, semantic level/cat/weather, warm beige, dark-navy identity are omitted.)
const DENY = {
  // Fluent grey neutrals (token values used raw)
  '#242424': '--text-1', '#424242': '--text-2', '#616161': '--text-3',
  '#d1d1d1': '--stroke-1', '#e0e0e0': '--stroke-2',
  '#fafafa': '--bg-2', '#f5f5f5': '--bg-3', '#f0f0f0': '--bg-4', '#ebebeb': '--bg-5',
  '#334155': '--accent',
  // cool slate ramp that maps to Fluent grey
  '#0f172a': '--text-1', '#1e293b': '--text-1', '#111827': '--text-1',
  '#475569': '--text-2', '#4b5563': '--text-2',
  '#64748b': '--text-3', '#94a3b8': '--text-3', '#7b8aa0': '--text-3', '#6b7280': '--text-3',
  '#e2e8f0': '--stroke-2', '#d7dde5': '--stroke-2', '#edf2f7': '--stroke-2',
  '#cbd5e1': '--stroke-1', '#f8fafc': '--bg-2', '#f5f7fa': '--bg-3',
  // forbidden MS blue (constitution §0: accent = slate, no MS blue)
  '#2563eb': '--accent', '#1d4ed8': '--accent', '#1e40af': '--accent',
  '#356eb3': '--accent', '#3b82f6': '--accent', '#38bdf8': '--accent',
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (name.endsWith('.css') && name !== 'tokens.css') yield p
  }
}

const hexRe = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
const norm = (h) => {
  h = h.toLowerCase()
  return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h
}

const findings = []
for (const file of walk(root)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const blockStack = [] // booleans: is this open rule exempt?
  lines.forEach((line, i) => {
    const marker = line.includes('color-lint-ignore') // exempts this line + its rule block
    if (!(marker || blockStack.some(Boolean))) {
      for (const m of line.matchAll(hexRe)) {
        const token = DENY[norm(m[0])]
        if (token) findings.push({ file: path.relative(root, file), line: i + 1, hex: m[0], token })
      }
    }
    for (const ch of line) {
      if (ch === '{') blockStack.push(marker)
      else if (ch === '}') blockStack.pop()
    }
  })
}

if (findings.length === 0) {
  console.log('color guardrail: no hardcoded token-equivalent colors found.')
} else {
  console.log(`color guardrail: ${findings.length} hardcoded color(s) with a token equivalent (use the token, or add /* color-lint-ignore: reason */):\n`)
  for (const f of findings) console.log(`  src/${f.file}:${f.line}  ${f.hex}  ->  var(${f.token})`)
}
process.exit(strict && findings.length ? 1 : 0)
