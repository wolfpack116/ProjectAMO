// @ts-nocheck
// 연직단면도 가로 스크롤 + 고정 고도축 검증. 긴 해외 노선(RKSS→VHHH)으로 브리핑→단면도 열기.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appUrl = process.env.PROJECTAMO_URL || 'http://127.0.0.1:5173'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
const outDir = path.join(__dirname, `../../artifacts/vprofile-scroll/${stamp}`)

async function pickAirport(page, pickerLabel, icao, regionRe) {
  await page.getByRole('button', { name: new RegExp(pickerLabel) }).first().click()
  await page.waitForTimeout(400)
  if (regionRe) {                                   // 해외: 지역 드릴다운 먼저
    await page.getByRole('button', { name: regionRe }).first().click()
    await page.waitForTimeout(400)
  }
  await page.getByRole('button', { name: new RegExp(icao) }).first().click()  // 이름+ICAO 버튼
  await page.waitForTimeout(300)
}

async function run() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 }).then((c) => c.newPage())
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.map-shell', { timeout: 20000 })
    const cb = page.locator('.updates-modal__close'); if (await cb.count()) { await cb.first().click(); await page.waitForTimeout(300) }
    await page.click('button[aria-label="비행 전 브리핑"]')
    await page.waitForSelector('.route-check-panel', { timeout: 10000 })

    await pickAirport(page, '출발 공항', 'RKSS')            // 한국 기본 지역
    await pickAirport(page, '도착 공항', 'VHHH', /홍콩/)     // 대만·홍콩·마카오·몽골 지역
    await page.locator('.route-check-panel').getByRole('button', { name: /^검색$/ }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === '브리핑 생성'), { timeout: 20000 })
    await page.getByRole('button', { name: '브리핑 생성' }).click()
    await page.waitForSelector('.briefing-view', { timeout: 20000 })

    // 연직단면도 생성 → 열기 (패널 하단, 텍스트 로케이터 + 스크롤)
    const genBtn = page.locator('button').filter({ hasText: /연직단면도/ }).first()
    await genBtn.scrollIntoViewIfNeeded()
    await genBtn.click()
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /연직단면도 열기/.test(b.textContent || '')), { timeout: 20000 }).catch(() => {})
    const openBtn = page.locator('button').filter({ hasText: /연직단면도 열기/ }).first()
    if (await openBtn.count()) { await openBtn.scrollIntoViewIfNeeded(); await openBtn.click() }
    await page.waitForSelector('.vertical-profile-window .vertical-profile-plot-svg', { timeout: 15000 })
    await page.waitForTimeout(600)

    // 측정: 플롯 SVG 실제 픽셀 너비, 오버레이 존재, 스크롤 가능 여부
    const info = await page.evaluate(() => {
      const svg = document.querySelector('.vertical-profile-window .vertical-profile-plot-svg')
      const scroll = document.querySelector('.vertical-profile-window .vertical-profile-plot-scroll')
      const overlay = document.querySelector('.vertical-profile-window .vertical-profile-axis-overlay')
      return {
        svgWidth: svg ? Math.round(svg.getBoundingClientRect().width) : null,
        scrollClientW: scroll ? scroll.clientWidth : null,
        scrollW: scroll ? scroll.scrollWidth : null,
        canScroll: scroll ? scroll.scrollWidth > scroll.clientWidth + 4 : null,
        hasOverlay: !!overlay,
      }
    })
    console.log('측정:', JSON.stringify(info))

    await page.screenshot({ path: path.join(outDir, 'vprofile-left.png') })
    // 오른쪽으로 스크롤해서 고정축 확인
    await page.evaluate(() => { const s = document.querySelector('.vertical-profile-window .vertical-profile-plot-scroll'); if (s) s.scrollLeft = s.scrollWidth })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(outDir, 'vprofile-scrolled-right.png') })
    console.log('outDir:', outDir)
  } finally {
    await browser.close()
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1 })
