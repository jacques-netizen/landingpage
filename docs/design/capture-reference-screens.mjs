// Usage: node docs/design/capture-reference-screens.mjs [filter]. Needs Playwright with Chromium.
// Renders every screen/state/theme of the two handoff mockups by seeding the
// mockup's own initial state, then screenshots at 1440 and 1024 px.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import crypto from 'node:crypto'; import path from 'node:path'; import http from 'node:http'; import os from 'node:os';

const SRC = '/home/user/landingpage/docs/design/handoff';
const OUT = '/home/user/landingpage/docs/design/reference-screens';
const VAR = path.join(os.tmpdir(), 'mde-reference-variants');
fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(VAR, { recursive: true, force: true }); fs.mkdirSync(VAR);
for (const f of fs.readdirSync(SRC)) if (f !== 'assets') fs.copyFileSync(path.join(SRC, f), path.join(VAR, f));
fs.symlinkSync(path.join(SRC, 'assets'), path.join(VAR, 'assets'));

const files = { platform: 'Platform Mockups.dc.html', creator: 'Creator Site v1.dc.html' };
const views = [];
for (const [key] of Object.entries(files)) {
  views.push([key, 'home', {}]);
  if (key === 'platform') for (const cs of ['Walmart', 'Wale', 'Kojo Blak', 'Jake & Logan Paul'])
    views.push([key, 'brands-' + cs.toLowerCase().replace(/[^a-z0-9]+/g, '-'), { s: 'brands', cs }]);
  for (const th of ['dark', 'light']) {
    for (const bv of ['data', 'loading', 'error']) views.push([key, `browse-${th}-${bv}`, { s: 'browse', th, bv }]);
    views.push([key, `browse-${th}-filtered-clipping`, { s: 'browse', th, bl: 'Clipping' }]);
    views.push([key, `browse-${th}-filtered-tiktok`, { s: 'browse', th, bp: 'TikTok' }]);
    views.push([key, `browse-${th}-empty`, { s: 'browse', th, bl: 'UGC', bp: 'Instagram' }]);
    views.push([key, `wallet-${th}-data-overview`, { s: 'wallet', th }]);
    views.push([key, `wallet-${th}-data-withdrawals`, { s: 'wallet', th, wt: 'wd' }]);
    for (const wv of ['loading', 'empty', 'error']) views.push([key, `wallet-${th}-${wv}`, { s: 'wallet', th, wv }]);
    views.push([key, `wallet-${th}-withdraw-done`, { s: 'wallet', th, done: true }]);
  }
  views.push([key, 'review', { s: 'review' }]);
  views.push([key, 'report', { s: 'report' }]);
}

const server = http.createServer((req, res) => {
  const p = path.join(VAR, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const ext = path.extname(p);
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(8765);

const only = process.argv[2];
// Chromium cannot use the sandbox's HTTPS proxy directly, so external requests
// (React, Babel, Google Fonts) are fetched with curl and cached on disk.
const CACHE = path.join(os.tmpdir(), 'mde-net-cache'); fs.mkdirSync(CACHE, { recursive: true });
async function viaCurl(route) {
  const url = route.request().url(); const h = crypto.createHash('sha1').update(url).digest('hex');
  const body = path.join(CACHE, h), meta = body + '.type';
  if (!fs.existsSync(body)) {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
    const type = execFileSync('curl', ['-sSL', '-A', ua, '-o', body, '-w', '%{content_type}', url]).toString();
    fs.writeFileSync(meta, type);
  }
  await route.fulfill({ status: 200, contentType: fs.readFileSync(meta, 'utf8'), body: fs.readFileSync(body), headers: { 'access-control-allow-origin': '*' } });
}
const browser = await chromium.launch();
for (const [key, name, seed] of views) {
  if (only && !`${key}-${name}`.includes(only)) continue;
  let html = fs.readFileSync(path.join(SRC, files[key]), 'utf8');
  const re = /state = \{ s: 'home',/;
  if (!re.test(html)) throw new Error('state line not found in ' + key);
  const extra = Object.entries(seed).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  // Later keys in an object literal win, so appending overrides the defaults.
  html = html.replace(/(state = \{ s: 'home',[^\n]*?)( \};)/, (m, a, b) => a + (extra ? ', ' + extra : '') + b);
  const vf = `${key}-${name}.dc.html`; fs.writeFileSync(path.join(VAR, vf), html);
  for (const w of [1440, 1024]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.route(/^https:/, viaCurl); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:8765/${encodeURIComponent(vf)}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    const file = path.join(OUT, `${key}-${name}-${w}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    console.log(file.replace(OUT + '/', ''), errs.length ? 'ERR ' + errs.join(' | ') : '');
    await page.close();
  }
}
await browser.close(); server.close();
