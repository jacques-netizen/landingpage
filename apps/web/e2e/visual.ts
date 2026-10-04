import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

// Locked design screenshots. Never regenerate them unless the owner says so in writing.
export const REFERENCE_DIR = path.resolve(import.meta.dirname, '../../../docs/design/reference-screens')
const OUT_DIR = path.resolve(import.meta.dirname, '../test-results/visual')

// Per-pixel colour tolerance (pixelmatch threshold) and the share of pixels allowed to differ.
// The budget absorbs anti-aliasing noise between machines; a real layout, colour or copy
// change moves far more pixels than this.
export const PIXEL_THRESHOLD = 0.1
export const MAX_DIFF_RATIO = 0.002

export type Rect = { x: number; y: number; width: number; height: number }

export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images)
        .filter((i) => !i.complete)
        .map((i) => new Promise((r) => i.addEventListener('load', r, { once: true }))),
    ),
  )
  await page.waitForTimeout(300)
}

function paint(png: PNG, rects: Rect[]) {
  for (const r of rects) {
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(png.height, Math.ceil(r.y + r.height)); y++) {
      for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(png.width, Math.ceil(r.x + r.width)); x++) {
        const i = (y * png.width + x) * 4
        png.data[i] = 255
        png.data[i + 1] = 0
        png.data[i + 2] = 255
        png.data[i + 3] = 255
      }
    }
  }
}

// Full page screenshot compared with the reference. `masks` cover areas that are mockup preview
// tooling (video pickers, image slots) and so are not part of the product; they are painted the
// same colour in both images before comparing.
export async function compareWithReference(page: Page, name: string, masks: Rect[] = []) {
  const refPath = path.join(REFERENCE_DIR, `${name}.png`)
  if (!fs.existsSync(refPath)) throw new Error(`Missing reference screenshot ${refPath}. Is Git LFS checked out?`)
  const head = fs.readFileSync(refPath).subarray(0, 8)
  if (head.toString('latin1') !== '\x89PNG\r\n\x1a\n') throw new Error(`${refPath} is not a PNG. Run git lfs pull.`)

  const actual = PNG.sync.read(await page.screenshot({ fullPage: true, animations: 'disabled' }))
  const expected = PNG.sync.read(fs.readFileSync(refPath))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, `${name}-actual.png`), PNG.sync.write(actual))

  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      ok: false,
      ratio: 1,
      message: `size differs: actual ${actual.width}x${actual.height}, reference ${expected.width}x${expected.height}`,
    }
  }
  paint(actual, masks)
  paint(expected, masks)
  const diff = new PNG({ width: expected.width, height: expected.height })
  const changed = pixelmatch(actual.data, expected.data, diff.data, expected.width, expected.height, {
    threshold: PIXEL_THRESHOLD,
  })
  fs.writeFileSync(path.join(OUT_DIR, `${name}-diff.png`), PNG.sync.write(diff))
  const ratio = changed / (expected.width * expected.height)
  return {
    ok: ratio <= MAX_DIFF_RATIO,
    ratio,
    message: `${changed} pixels differ (${(ratio * 100).toFixed(3)}%, budget ${(MAX_DIFF_RATIO * 100).toFixed(2)}%)`,
  }
}
