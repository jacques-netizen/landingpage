// Phase 0 design capture. Loads the live site at mobile and desktop widths,
// saves full page screenshots and dumps computed styles for DESIGN_TOKENS.md.
// Usage: node scripts/capture-design.mjs [url]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'https://maisondelites.com';
const out = path.resolve('docs/reference');
fs.mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath });
const report = {};
for (const width of [390, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: width === 390 ? 2 : 1 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  // Scroll through so lazy content mounts.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `site-${width}.png`), fullPage: true });
  report[width] = await page.evaluate(() => {
    const count = (m, k) => { m[k] = (m[k] || 0) + 1; };
    const colors = {}, bgs = {}, fonts = {}, sizes = {}, radii = {}, weights = {}, borders = {}, transitions = {};
    const els = [...document.querySelectorAll('body *')];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (hasText) {
        count(colors, cs.color);
        count(fonts, cs.fontFamily);
        count(sizes, `${cs.fontSize} / ${cs.lineHeight} / ${cs.fontWeight} / ${cs.letterSpacing} / ${cs.textTransform} / ${cs.fontFamily.split(',')[0]}`);
        count(weights, cs.fontWeight);
      }
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') count(bgs, cs.backgroundColor);
      if (cs.borderRadius !== '0px') count(radii, cs.borderRadius);
      if (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none') count(borders, `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`);
      if (cs.transitionDuration !== '0s') count(transitions, `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`);
    }
    const sort = m => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const buttons = [...document.querySelectorAll('a,button,[role=link],[role=button]')].slice(0, 30).map(el => {
      const cs = getComputedStyle(el);
      return { text: el.textContent.trim().slice(0, 40), bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius, pad: cs.padding, h: cs.height, font: `${cs.fontSize} ${cs.fontWeight} ${cs.fontFamily.split(',')[0]}`, ls: cs.letterSpacing, border: cs.border };
    });
    const headings = [...document.querySelectorAll('h1,h2,h3')].map(el => {
      const cs = getComputedStyle(el);
      return { tag: el.tagName, text: el.textContent.trim().slice(0, 80), size: cs.fontSize, lh: cs.lineHeight, w: cs.fontWeight, ls: cs.letterSpacing, family: cs.fontFamily, color: cs.color, style: cs.fontStyle };
    });
    const fontFaces = [...document.fonts].map(f => `${f.family} ${f.weight} ${f.style} ${f.status}`);
    return { colors: sort(colors), bgs: sort(bgs), fonts: sort(fonts), sizes: sort(sizes), weights: sort(weights), radii: sort(radii), borders: sort(borders), transitions: sort(transitions), buttons, headings, fontFaces: [...new Set(fontFaces)], text: document.body.innerText.slice(0, 20000) };
  });
  await page.close();
}
fs.writeFileSync(path.join(out, 'computed-styles.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log('saved to', out);
