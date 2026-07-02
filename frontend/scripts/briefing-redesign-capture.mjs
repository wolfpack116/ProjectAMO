// 브리핑 개편 focused 캡처 — 데스크톱 브리핑 result 뷰(목업이 데스크톱 기준).
// 실행: (dev:serve 기동 후) PROJECTAMO_URL=http://127.0.0.1:5173 node frontend/scripts/briefing-redesign-capture.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { reachBriefingResult } from './lib/reachBriefing.mjs'

const APP_URL = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const LABEL = process.env.PROJECTAMO_SCREENSHOT_LABEL || 'after'
const OUT = new URL(`../../artifacts/responsive-screenshots/briefing-redesign/${LABEL}/`, import.meta.url)

await mkdir(fileURLToPath(OUT), { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1536, height: 900 } })
const page = await ctx.newPage()
const result = { name: 'desktop' }
try {
  await reachBriefingResult(page, APP_URL)
  const png = fileURLToPath(new URL('briefing-desktop.png', OUT))
  await page.screenshot({ path: png, fullPage: true })
  result.ok = true; result.png = png
  result.banner = await page.locator('.bv-banner').count()
  result.bannerText = await page.locator('.bv-banner').first().innerText().catch(() => null)
  console.log(`OK  desktop  banner=${result.banner}`)
  console.log(result.bannerText)
} catch (e) {
  result.ok = false; result.error = String(e).split('\n')[0]
  console.log(`FAIL desktop  ${result.error}`)
} finally { await ctx.close() }
await browser.close()
await writeFile(fileURLToPath(new URL('manifest.json', OUT)), JSON.stringify({ capturedAt: new Date().toISOString(), result }, null, 2), 'utf8')
