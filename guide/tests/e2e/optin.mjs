// Walks the opt-in page on a phone sized browser: three steps, then page A or B.
// Usage: node tests/e2e/optin.mjs <baseUrl> <A|B> [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [base = 'http://localhost:3200', page = 'B', out = '/tmp/optin'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const muxIds = [];
p.on('request', (r) => { const m = r.url().match(/stream\.mux\.com\/([A-Za-z0-9]+)/); if (m && muxIds.at(-1) !== m[1]) muxIds.push(m[1]); });
let n = 0;
const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: true }); };

await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
const checks = {};
checks.h1 = await p.locator('h1').innerText();
checks.heroImage = await p.locator('.op-hero-img').evaluate((img) => img.naturalWidth > 0);
await shot('step1');
// Empty submit shows the name error.
await p.locator('.op-btn').click();
checks.nameError = await p.locator('.op-error').innerText().catch(() => '');
await p.fill('#op-first', 'Test');
await p.fill('#op-last', 'Optin');
await p.locator('.op-btn').click();
await p.waitForTimeout(300);
checks.step2 = await p.locator('.op-steps span').first().innerText();
await p.fill('#op-email', `optin+${page.toLowerCase()}${Date.now()}@example.com`);
await p.fill('#op-phone', '470 12 34 56');
await shot('step2');
await p.locator('.op-btn').click();
await p.waitForTimeout(300);
checks.step3 = await p.locator('.op-steps span').first().innerText();
const picks = page === 'B'
  ? { promo: 'brand_product', audience_size: '50k_250k', revenue: '50k_250k', team: '6_20', budget_v2: '25k_100k', decider: 'team', heard: 'under_3m' }
  : { promo: 'music_indie', audience_size: '1k_10k', revenue: 'under_1k', team: 'solo', budget_v2: '1k_3k', decider: 'me', heard: 'just_now' };
for (const [id, value] of Object.entries(picks)) await p.selectOption(`#op-${id}`, value);
await shot('step3');
await p.locator('.op-btn').click();
await p.locator('.op-h1').filter({ hasText: /Congratulations|Check Your Email/ }).waitFor({ timeout: 30000 });
await p.waitForTimeout(1500);
checks.result = await p.locator('.op-h1').first().innerText();
checks.stage = await p.locator('.op-tr.on .op-name, .op-h1 .op-accent').first().innerText().catch(() => null);
checks.sections = await p.locator('section').count();
checks.cases = await p.locator('.op-review').count();
checks.calendar = await p.locator('#booking iframe, .op-slot-cal').count();
checks.film = muxIds.at(-1) ?? null;
await shot('result');
// Refresh lands on the same page.
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
checks.afterReload = (await p.locator('.op-h1').first().innerText()).slice(0, 40);
console.log(JSON.stringify({ page, checks, errors }, null, 1));
await b.close();
