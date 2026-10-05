// Captures the owner-approved phone layouts (390px) of the designed screens into the locked
// reference set. The mockups have no phone layout, so these references come from the product.
// Run ONLY when the owner has approved a phone layout in writing (see CLAUDE.md):
//   pnpm build && pnpm start -p 3100   (in another terminal, with the dev database seeded)
//   node scripts/capture-phone-references.mjs --owner-approved
import { chromium } from '@playwright/test'
import path from 'node:path'

if (!process.argv.includes('--owner-approved')) {
  console.error('Refusing to write locked references without --owner-approved.')
  process.exit(1)
}
const OUT = path.resolve(import.meta.dirname, '../../../docs/design/reference-screens')
const BASE = process.env.BASE_URL ?? 'http://localhost:3100'

const browser = await chromium.launch()
async function shot(route, name, tab) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  if (tab) await page.getByText(tab, { exact: true }).first().click()
  await page.evaluate(() => globalThis.document.fonts.ready)
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, `${name}-390.png`), fullPage: true, animations: 'disabled' })
  console.log(`${name}-390.png`)
  await page.close()
}
await shot('/', 'creator-home')
for (const [tab, slug] of [
  ['Walmart', 'walmart'],
  ['Wale', 'wale'],
  ['Kojo Blak', 'kojo-blak'],
  ['Jake & Logan Paul', 'jake-logan-paul'],
]) {
  await shot('/brands', `platform-brands-${slug}`, tab)
}
await browser.close()
