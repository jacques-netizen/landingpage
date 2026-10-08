// End to end walk through the funnel on a phone sized browser.
// Usage: node tests/e2e/walk.mjs <baseUrl> <path: clipper|creator|brand> [outDir] [--refresh]
// Picks answers per path, fast forwards films, checks refresh resume, fills the
// gate and lands on the result. Screenshots every scene into outDir.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [base = 'http://localhost:3100', path = 'creator', out = '/tmp/walk', ...flags] = process.argv.slice(2);
const refresh = flags.includes('--refresh');
const plain = flags.includes('--plain');
fs.mkdirSync(out, { recursive: true });

const picks = {
  clipper: { role: 'I want to earn by clipping', asset: 'Music', platforms: ['TikTok', 'YouTube Shorts'], goal: 'Some money on the side', timing: 'I’m new to clipping' },
  creator: { role: 'I’m a creator or artist', asset: 'A music release', platforms: ['TikTok', 'Instagram Reels'], goal: 'More streams or listens', timing: 'This month', budget: '$3K to $10K', deciding: 'No, it’s just me' },
  brand: { role: 'I run or represent a brand, label or talent', asset: 'A product or launch', platforms: ['Instagram Reels', 'X'], goal: 'More sales or sign-ups', timing: 'In the next 2 weeks', budget: 'Not sure yet', amount: '4000', deciding: 'Yes' },
  lowbuyer: { role: 'I’m a creator or artist', asset: 'My personal brand', platforms: ['TikTok'], goal: 'More views', timing: 'Just exploring for now', budget: 'Under $3K', deciding: 'No, it’s just me' },
}[path];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let n = 0;
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); };
const tapText = async (t) => { await page.getByRole('radio', { name: t, exact: true }).or(page.getByRole('checkbox', { name: t, exact: true })).first().click(); };
const finishFilm = async (name) => {
  await page.waitForSelector('video', { state: 'attached' });
  await page.waitForTimeout(1500);
  await shot(name);
  await page.evaluate(() => { const v = [...document.querySelectorAll('video')].pop(); if (v && v.duration) v.currentTime = v.duration - 0.3; });
  await page.getByRole('button', { name: /Continue/ }).click({ timeout: 15000 });
};

const q = plain ? '?_v=plain&_p=none' : `?fn=Jacques&src=ig-distribution&mc=123456&_v=full&_p=front_loaded`;
await page.goto(base + '/' + q, { waitUntil: 'domcontentloaded' });

if (plain) {
  await finishFilm('plain-film');
} else {
  await page.getByRole('button', { name: /Start/ }).waitFor();
  await shot('cold-open');
  await page.getByRole('button', { name: /Start/ }).click();
  await shot('q-role');
  await tapText(picks.role);
  await finishFilm('chapter1');
  await shot('q-asset');
  await tapText(picks.asset);
  await shot('q-platforms');
  for (const p of picks.platforms) await tapText(p);
  await page.getByRole('button', { name: /Continue/ }).click();
  if (refresh) {
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await shot('after-refresh');
  }
  await finishFilm('chapter2-end');
  await shot('q-goal');
  await tapText(picks.goal);
  await shot('q-timing');
  await tapText(picks.timing);
  if (picks.budget) {
    await shot('q-budget');
    await tapText(picks.budget);
    if (picks.amount) {
      await page.getByLabel('Roughly how much, in dollars?').fill(picks.amount);
      await shot('q-budget-amount');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
    }
    await shot('q-deciding');
    await tapText(picks.deciding);
  }
  await page.waitForTimeout(3200);
  await shot('chapter3-step1');
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: /^Next/ }).last().click().catch(() => {}); await page.waitForTimeout(300); }
  await shot('chapter3-end');
  await page.getByRole('button', { name: /Get my guide/ }).click();
}

await page.getByRole('button', { name: /Build my guide/ }).waitFor();
await shot('gate');
await page.getByRole('button', { name: /Build my guide/ }).click();
await shot('gate-errors');
if (plain) await page.getByLabel('Which one sounds like you?').selectOption({ label: 'I’m a creator or artist' });
await page.getByLabel('First name', { exact: true }).fill('Test');
await page.getByLabel('Email', { exact: true }).fill(`test+${path}${Date.now()}@example.com`);
await page.getByLabel(/Instagram handle/).fill('@test.handle');
if (await page.getByLabel('Company, label or team name').count()) await page.getByLabel('Company, label or team name').fill('Test Label');
await page.getByRole('checkbox').check();
await page.getByRole('button', { name: /Build my guide/ }).click();
await page.waitForTimeout(1500);
await shot('building');
await page.waitForSelector('h1', { timeout: 15000 });
await page.waitForTimeout(1200);
await shot('result');
await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-result-full.png`, fullPage: true });
const html = await page.content();
console.log(JSON.stringify({ path, url: page.url(), hasCalendarCopy: html.includes('Pick a time'), hasJoin: html.includes('Join the network'), hasSoft: html.includes('Want to talk numbers'), errors }, null, 2));
await browser.close();
