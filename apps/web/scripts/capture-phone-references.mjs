// Captures the owner-approved phone layouts (390px) of the designed screens into the locked
// reference set. The mockups have no phone layout, so these references come from the product.
// Run ONLY when the owner has approved a phone layout in writing (see CLAUDE.md):
//   pnpm build && DESIGN_STATES=1 pnpm start -p 3100   (in another terminal, with the dev database seeded)
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
async function shot(route, name, tab, theme) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  if (theme) await page.context().addCookies([{ name: 'mde_theme', value: theme, url: BASE }])
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  for (const t of [tab ?? []].flat()) await page.getByText(t, { exact: true }).first().click()
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
// Campaigns screen, both themes, every state (approved by the owner on 2026-10-05).
const BROWSE_VIEWS = [
  ['data', '/campaigns'],
  ['filtered-clipping', '/campaigns', ['Clipping']],
  ['filtered-tiktok', '/campaigns', ['TikTok']],
  ['empty', '/campaigns', ['UGC', 'Instagram']],
  ['loading', '/design-states/browse?state=loading'],
  ['error', '/design-states/browse?state=error'],
]
for (const theme of ['dark', 'light']) {
  for (const [view, route, filters] of BROWSE_VIEWS) {
    const url = route.includes('?') ? `${route}&theme=${theme}` : route
    await shot(url, `creator-browse-${theme}-${view}`, filters, theme)
  }
}
await browser.close()
