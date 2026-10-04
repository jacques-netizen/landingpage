import { expect, test, type Page } from '@playwright/test'
import { compareWithReference, settle, type Rect } from './visual'

// Visual tests for every designed screen built so far, at the locked widths.
// References live in docs/design/reference-screens (see CLAUDE.md).
const WIDTHS = [1440, 1024] as const

async function rectsOf(page: Page, selector: string, pick: (r: Rect) => Rect = (r) => r): Promise<Rect[]> {
  const rects = await page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const b = el.getBoundingClientRect()
      return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height }
    }),
  )
  return rects.map(pick)
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('home matches the locked design', async ({ page }) => {
      await page.goto('/')
      await settle(page)
      const result = await compareWithReference(page, `creator-home-${width}`)
      test.info().annotations.push({ type: 'visual', description: result.message })
      expect(result.ok, result.message).toBe(true)
    })

    for (const [tab, slug] of [
      ['Walmart', 'walmart'],
      ['Wale', 'wale'],
      ['Kojo Blak', 'kojo-blak'],
      ['Jake & Logan Paul', 'jake-logan-paul'],
    ] as const) {
      test(`brand site with the ${tab} case study matches the locked design`, async ({ page }) => {
        await page.goto('/brands')
        await page.getByText(tab, { exact: true }).first().click()
        await settle(page)
        const masks = [
          // The case study video box: the mockup shows its image-slot picker and the
          // "Paste link" and "Add video" controls here. Preview tooling, not product.
          ...(await rectsOf(page, 'div[style*="width:300px"][style*="height:500px"]')),
          // "Add clip" pickers on the four frames (bottom left of each frame).
          ...(
            await rectsOf(page, 'img[src^="/designed/story-"][src$="-s.png"]', (r) => ({
              x: r.x + 8,
              y: r.y + r.height - 44,
              width: 96,
              height: 40,
            }))
          ).slice(-4),
          // "Add testimonial video" picker (bottom right of the testimonial).
          ...(
            await rectsOf(page, 'img[src="/designed/proof/poster-kojo-blak.png"]', (r) => ({
              x: r.x + r.width - 200,
              y: r.y + r.height - 52,
              width: 196,
              height: 48,
            }))
          ).slice(-1),
        ]
        const result = await compareWithReference(page, `platform-brands-${slug}-${width}`, masks)
        test.info().annotations.push({ type: 'visual', description: result.message })
        expect(result.ok, result.message).toBe(true)
      })
    }
  })
}
