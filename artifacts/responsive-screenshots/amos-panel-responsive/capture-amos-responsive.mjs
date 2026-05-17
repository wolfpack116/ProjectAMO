import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../../frontend/node_modules/playwright/index.mjs'

const out = path.resolve(process.env.AMOS_OUT)
const appUrl = process.env.PROJECTAMO_URL || 'http://localhost:5173'

const baseAmos = {
  observation: { observed_tm_kst: '202605181230' },
  runways: [
    {
      wind_speed: 1.6,
      wind_direction: 340,
      wind_speed_min: 1.5,
      wind_direction_min: 330,
      wind_speed_max: 1.8,
      wind_direction_max: 350,
      visibility_m: 10000,
      rvr_m: 2000,
    },
    {
      wind_speed: 1.7,
      wind_direction: 330,
      wind_speed_min: 1.2,
      wind_direction_min: 320,
      wind_speed_max: 2.1,
      wind_direction_max: 340,
      visibility_m: 10000,
      rvr_m: 2000,
    },
  ],
  weather: {
    cloud_min_m: null,
    temperature_c: 18.2,
    dewpoint_c: 12.8,
  },
  pressure: {
    qnh_hpa: 1017,
  },
}

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'tablet-landscape', width: 1180, height: 820 },
  { name: 'desktop-fhd', width: 1920, height: 1080 },
  { name: 'panel-560', width: 820, height: 900, panelWidth: 560 },
  { name: 'panel-640', width: 900, height: 900, panelWidth: 640 },
  { name: 'panel-800', width: 1100, height: 900, panelWidth: 800 },
]

await mkdir(path.join(out, 'review'), { recursive: true })

const browser = await chromium.launch({ headless: true })
const log = []

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    })

    await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await page.evaluate(async ({ baseAmos, panelWidth }) => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default
      const ReactDOM = (await import('/node_modules/.vite/deps/react-dom_client.js')).default
      const Amos = (await import('/src/features/airport-panel/tabs/AmosTab.jsx')).default

      document.body.innerHTML = '<main class="amos-capture-shell"><div class="airport-panel-body"><div id="amos-root"></div></div></main>'
      document.body.style.margin = '0'
      document.body.style.background = '#e2e8f0'

      const shell = document.querySelector('.amos-capture-shell')
      shell.style.width = `${panelWidth || window.innerWidth}px`
      shell.style.minHeight = '100vh'
      shell.style.padding = '12px'
      shell.style.boxSizing = 'border-box'

      const body = document.querySelector('.airport-panel-body')
      body.style.padding = panelWidth ? '24px' : '20px 12px'
      body.style.overflow = 'visible'

      ReactDOM.createRoot(document.getElementById('amos-root')).render(
        React.createElement(Amos, {
          amos: baseAmos,
          metar: null,
          airportMeta: { icao: 'RKJB' },
        }),
      )

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }, { baseAmos, panelWidth: viewport.panelWidth || null })

    const screenshot = `${viewport.name}.png`
    await page.screenshot({ path: path.join(out, screenshot), fullPage: true })

    const metrics = await page.evaluate(() => {
      const selectors = [
        '.amos-capture-shell',
        '.airport-panel-body',
        '.ap-amos-priority-summary',
        '.ap-amos-console-board',
        '.ap-amos-console-wind-row',
        '.ap-amos-console-rvr-row',
        '.ap-amos-console-common-grid',
      ]

      const boxes = Object.fromEntries(selectors.map((selector) => {
        const element = document.querySelector(selector)
        if (!element) return [selector, null]
        const rect = element.getBoundingClientRect()
        return [selector, {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          scrollWidth: element.scrollWidth,
        }]
      }))

      return {
        innerWidth,
        innerHeight,
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        boxes,
      }
    })

    log.push({
      name: viewport.name,
      viewport: { width: viewport.width, height: viewport.height },
      panelWidth: viewport.panelWidth || null,
      screenshot,
      metrics,
    })

    await page.close()
  }
} finally {
  await browser.close()
}

await writeFile(path.join(out, 'capture-log.json'), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
await writeFile(
  path.join(out, 'README.md'),
  `# AMOS Panel Responsive Capture

- Capture time: ${new Date().toISOString()}
- App URL: ${appUrl}
- Method: AMOS tab harness rendered with the production React component and CSS.
- Viewports: 390x844, 820x1180, 1180x820, 1920x1080.
- Panel harness widths: 560px, 640px, 800px.
- Verification commands:
  - node --test frontend/src/features/airport-panel/lib/amosViewModel.test.js
  - node --test frontend/src/app/layout/layoutTokens.test.js
  - npm.cmd run build --prefix frontend
  - PROJECTAMO_URL=http://localhost:5173 npm.cmd run smoke:responsive --prefix frontend
- Issue report: review/issues.md
`,
  'utf8',
)

await writeFile(
  path.join(out, 'review', 'issues.md'),
  `# AMOS Responsive Issues

| Severity | Viewport | Screenshot | Problem | Status |
| --- | --- | --- | --- | --- |
| P2 | phone 390x844 | ../phone.png | Manual visual review still required for final text overlap and first-screen comprehension. | needs human review |
| P2 | panel 560 | ../panel-560.png | Verify narrow panel summary-first order and absence of AMOS board-local horizontal dependency. | needs human review |
| P3 | desktop 1920x1080 | ../desktop-fhd.png | Desktop comparator for preserved console layout. | reference |
`,
  'utf8',
)

console.log(out)
