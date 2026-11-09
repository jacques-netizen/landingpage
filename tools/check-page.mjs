// Check a page at phone, tablet and desktop width: page errors, sideways overflow,
// and a full-page screenshot of each.
//
//   node tools/check-page.mjs <url> [outDir]
//   e.g. node tools/check-page.mjs http://localhost:8765/chillblast/ /tmp/shots
//
// Serve the repo first (bash tools/serve.sh). External requests are blocked so the
// check is fast and offline; fonts fall back, which is fine for layout checks.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const url = process.argv[2];
const out = process.argv[3] || '/tmp/page-check';
if (!url) { console.error('usage: node tools/check-page.mjs <url> [outDir]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
let failed = false;
for (const w of [390, 820, 1440]) {
  const ctx = await browser.newContext(w === 390 ? { ...devices['iPhone 13'] } : { viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route((u) => !/^http:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), (r) => r.abort());
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  // Scroll slowly so every reveal and count-up fires.
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(80); }
  await p.waitForTimeout(2500);
  const ov = await p.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    document.querySelectorAll('body *').forEach((e) => {
      const r = e.getBoundingClientRect();
      // Horizontal scroll rows (clip rails) are allowed to run past the edge.
      const rail = e.closest('[class*="rail"],[class*="wall"],.refs');
      if (r.right > W + 1 && r.width > 0 && !rail && !e.closest('.hero') && getComputedStyle(e).position !== 'fixed') bad.push((e.className || e.tagName) + ' @' + Math.round(r.right));
    });
    return { pageWidth: document.documentElement.scrollWidth, viewport: W, overflowing: bad.slice(0, 8) };
  });
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${out}/page-${w}.png`, fullPage: true });
  const ok = ov.pageWidth <= ov.viewport && !errs.length;
  if (!ok) failed = true;
  console.log(`${w}px  ${ok ? 'OK' : 'PROBLEM'}  width ${ov.pageWidth}/${ov.viewport}  errors ${errs.length}`, errs.length ? errs : '', ov.overflowing.length ? ov.overflowing : '');
  await ctx.close();
}
await browser.close();
console.log('screenshots in', out);
process.exit(failed ? 1 : 0);
