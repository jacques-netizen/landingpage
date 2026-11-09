// Make an A4 PDF of a page in the same dark design (reports, proposals, roadmaps).
//
//   node tools/pdf.mjs <url> <out.pdf> [--break "#s3,#s5"]
//   e.g. node tools/pdf.mjs http://localhost:8765/reports/marrz-final/ reports/marrz-final/Marrz-Final-Report.pdf --break "#s4,#s5"
//
// Serve the repo first (bash tools/serve.sh). What it does:
//  - embeds Archivo and EB Garamond from tools/fonts (no internet needed)
//  - blocks external requests (TikTok/Instagram/YouTube players never load in a PDF)
//  - scrolls the page so every reveal, ring and bar animates, then freezes all
//    count-ups at their final value
//  - renders at desktop width (scale 0.74 on A4), keeps the dark background,
//    keeps links clickable, and avoids splitting cards across pages
//  - --break: sections that start on a new page (CSS selectors, comma-separated)
//  - a page can define window.__pdfPrepare() to expand tabs or steppers first
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const [url, outFile] = process.argv.slice(2);
const bi = process.argv.indexOf('--break');
const breaks = bi > 0 ? process.argv[bi + 1] : '';
if (!url || !outFile) { console.error('usage: node tools/pdf.mjs <url> <out.pdf> [--break "#s3,#s5"]'); process.exit(1); }

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'fonts');
const fonts = JSON.parse(fs.readFileSync(path.join(dir, 'fonts.json'), 'utf8')).map((f) =>
  `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(dir, f.file)).toString('base64')}) format('truetype')}`).join('\n');

const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const p = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
await p.route((u) => !/^http:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), (r) => r.abort());
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.addStyleTag({ content: fonts + `
  @page{size:A4;margin:0}
  html,body{background:#15120D!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body::after{display:none!important}
  *,*:before,*:after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}
  .rv{opacity:1!important;transform:none!important}
  #progress,#dots,.scrollcue{display:none!important}
  .hero{min-height:0!important;padding-bottom:3rem}
  .section{padding-top:2.6rem;padding-bottom:2.6rem}
  .snum,.statement,h3.sub{break-after:avoid}
  .section [class]>div,.vtile,table,tr{break-inside:avoid}
  ${breaks ? breaks + '{break-before:page}' : ''}
` });
// Let scroll-triggered animations fire, then freeze them at their end state.
const H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
await p.waitForTimeout(2500);
await p.evaluate(async () => {
  if (typeof window.__pdfPrepare === 'function') await window.__pdfPrepare();
  window.requestAnimationFrame = () => 0;
  const fmt = (n, el) => (el.dataset.dec ? n.toFixed(+el.dataset.dec) : Math.round(n).toLocaleString('en-US'));
  document.querySelectorAll('.cu[data-target]').forEach((el) => { el.textContent = fmt(parseFloat(el.dataset.target), el); });
  document.querySelectorAll('[data-w]').forEach((el) => { if (!el.style.width) el.style.width = el.dataset.w + '%'; });
  document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
  await document.fonts.ready;
  await Promise.race([Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))), new Promise((r) => setTimeout(r, 8000))]);
  scrollTo(0, 0);
});
await p.waitForTimeout(500);
await p.emulateMedia({ media: 'screen' });
await p.pdf({ path: outFile, format: 'A4', printBackground: true, scale: 0.74, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log('PDF written:', outFile);
