import 'server-only'
import { chromium, type Browser } from 'playwright-core'

// The report as a PDF (owner brief, 2026-10-26): headless Chromium prints the report's own page, A4 with
// the dark background kept, every figure at its final value and every plan step written out. One browser
// is kept open and one page is printed at a time. Weekly reports never change, so their PDF is kept;
// a final report's is kept for as long as its figures are (a minute).

let browser: Promise<Browser> | null = null
let queue: Promise<unknown> = Promise.resolve()
const kept = new Map<string, { at: number; pdf: Buffer }>()
const KEEP_MS = 10 * 60_000

function launch() {
  if (!browser) {
    const proxy = process.env.HTTPS_PROXY
    browser = chromium
      .launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
        // Behind an outbound proxy (development containers), fonts come through it; the app itself does not.
        proxy: proxy ? { server: proxy, bypass: '127.0.0.1,localhost' } : undefined,
      })
      .then((b) => {
        b.on('disconnected', () => {
          browser = null
        })
        return b
      })
      .catch((err) => {
        browser = null
        throw err
      })
  }
  return browser
}

/** Where the PDF renderer finds the app's own files (the report's pictures). */
export const internalBase = () => `http://127.0.0.1:${process.env.PORT ?? 3000}/`

async function print(html: string): Promise<Buffer> {
  const b = await launch()
  const page = await b.newPage({ viewport: { width: 1240, height: 1754 } })
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await page.close().catch(() => undefined)
  }
}

export async function reportPdf(cacheKey: string, html: string): Promise<Buffer> {
  const hit = kept.get(cacheKey)
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.pdf
  const job = queue.then(() => print(html))
  queue = job.catch(() => undefined)
  const pdf = await job
  kept.set(cacheKey, { at: Date.now(), pdf })
  for (const [k, v] of kept) if (Date.now() - v.at > KEEP_MS || kept.size > 12) kept.delete(k)
  return pdf
}
