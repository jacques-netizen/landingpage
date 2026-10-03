// Usage: node scripts/screenshot.mjs <path> <name> [baseUrl]
// Writes docs/screens/<name>-<width>.png at 1440, 1024 and 390 px wide.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [path = '/', name = 'page', base = 'http://localhost:3000'] = process.argv.slice(2)
mkdirSync('docs/screens', { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const width of [1440, 1024, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `docs/screens/${name}-${width}.png`, fullPage: true })
  await page.close()
}
await browser.close()
