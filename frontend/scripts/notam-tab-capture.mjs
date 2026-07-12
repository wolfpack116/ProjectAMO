// NOTAM 섹션(⑤) 검증용 캡처 — briefing-view까지 자동 진입 후 NOTAM 탭으로 이동해 스크린샷.
// 실행: (dev:serve 기동 후) node frontend/scripts/notam-tab-capture.mjs
//   PROJECTAMO_URL=http://127.0.0.1:5173  PROJECTAMO_CAPTURE_DIR=<dir>  PROJECTAMO_CAPTURE_LABEL=after
//   PROJECTAMO_DEPARTURE=RKSS  PROJECTAMO_ARRIVAL=RKPC
// 주의: Vite가 IPv6(::1)만 바인딩된 경우 127.0.0.1은 ECONNREFUSED → PROJECTAMO_URL=http://localhost:5173 로 재시도.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { reachBriefingResult } from './lib/reachBriefing.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const outDir = process.env.PROJECTAMO_CAPTURE_DIR || path.join(__dirname, '../../artifacts/notam-tab-capture')
const LABEL = process.env.PROJECTAMO_CAPTURE_LABEL || 'after'
const departure = process.env.PROJECTAMO_DEPARTURE || 'RKSS'
const arrival = process.env.PROJECTAMO_ARRIVAL || 'RKPC'

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1536, height: 900 } }).then((c) => c.newPage())
  try {
    await reachBriefingResult(page, appUrl, { departure, arrival })
    await page.getByRole('tab', { name: /NOTAM/ }).click()
    await page.waitForSelector('.notam-cellgrid', { timeout: 10000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(outDir, `notam-tab-${LABEL}.png`) })
    console.log('captured notam-tab', LABEL)
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
