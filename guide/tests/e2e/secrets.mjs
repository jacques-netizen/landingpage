// Walks the interactive guide on a phone sized browser and exercises each interaction.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [base = 'http://localhost:3200', out = '/tmp/secrets'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await p.goto(base + '/secrets', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/01-open.png` });
const checks = {};
// Secret 1: post twice, move the slider
await p.locator('#ceiling').scrollIntoViewIfNeeded();
await p.getByRole('button', { name: 'Post', exact: true }).click();
await p.waitForTimeout(1900);
checks.firstPost = await p.locator('.sx-test').getAttribute('class');
await p.getByRole('button', { name: 'Post again' }).click();
await p.waitForTimeout(1900);
checks.secondPost = await p.locator('.sx-test').getAttribute('class');
await p.getByLabel('Your followers').fill('1000');
checks.followers = await p.locator('#ceiling .cv').innerText();
checks.progress = await p.locator('.sx-progress').innerText().catch(() => 'none');
await p.locator('#ceiling').screenshot({ path: `${out}/02-ceiling.png` });
// Secret 2: reveal a poster, slide to 200 pages
await p.locator('.sx-feed-item').first().click();
checks.reveal = await p.locator('.sx-reveal').first().innerText().catch(() => 'none');
await p.getByLabel('One post or many pages').fill('200');
checks.pagesTotal = await p.locator('#everywhere .o.big .ov').innerText();
checks.posts = await p.locator('#everywhere .sx-post').count();
await p.locator('#everywhere .sx-posts').scrollIntoViewIfNeeded();
await p.waitForTimeout(4000);
checks.postFrames = await p.locator('#everywhere .sx-post iframe').count();
checks.postMeta = await p.locator('#everywhere .sx-post-meta').allInnerTexts();
await p.locator('#everywhere .sx-panel.sx-wide').screenshot({ path: `${out}/02b-same.png` });
// Secret 3: budget, stop spend
await p.locator('#sx-budget').fill('3000');
checks.bars = await p.locator('#ads .sx-bar .v').allInnerTexts();
await p.getByRole('button', { name: /Stop the spend/ }).click();
checks.chartLabels = await p.locator('#ads .sx-chart text.v, #ads .sx-chart text.va').allTextContents();
await p.locator('#ads').screenshot({ path: `${out}/03-ads.png` });
// Secret 4: filter
await p.locator('#everyone').scrollIntoViewIfNeeded();
await p.waitForTimeout(1600);
await p.locator('#everyone .sx-chips button', { hasText: 'Music' }).click();
checks.cardsMusic = await p.locator('#everyone .sx-cards .tile').count();
// Secret 5: preset
await p.getByRole('button', { name: 'Our real clip' }).click();
checks.payout = await p.locator('#results .o.big .ov').innerText();
await p.locator('#results').screenshot({ path: `${out}/05-results.png` });
// Secret 6: drain and the game
await p.getByRole('button', { name: 'Approve a botted clip' }).click();
await p.getByRole('button', { name: 'Approve a botted clip' }).click();
checks.drain = await p.locator('.sx-drain-num').innerText();
for (let i = 0; i < 6; i++) await p.locator('.sx-bot').nth(i).getByRole('button', { name: 'Real' }).click();
checks.score = await p.locator('#bots .callout').first().innerText();
await p.locator('#bots').screenshot({ path: `${out}/06-bots.png` });
// Secret 7: brands lane, two countries, brand tab
await p.locator('#fit .sx-chips button', { hasText: 'Brands' }).first().click();
await p.locator('#fit .sx-chips.sm button', { hasText: 'Ghana' }).click();
checks.fit = (await p.locator('#fit .bullets li').first().innerText()).slice(0, 120);
// Cases: open one
await p.locator('#cases .sx-open-btn').first().click();
checks.caseOpen = (await p.locator('#cases .case dl').first().innerText()).slice(0, 80);
// Self check
await p.locator('#alone input[type=checkbox]').nth(0).check();
await p.locator('#alone input[type=checkbox]').nth(1).check();
checks.selfCheck = await p.locator('#alone .callout').innerText();
await p.locator('.sx-spots').scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
checks.spots = await p.locator('.sx-spots span').innerText();
checks.spotsOn = await p.locator('.sx-spots i.on').count();
checks.slotsHiddenLive = await p.locator('.sx-slot').count();
await p.screenshot({ path: `${out}/99-full.png`, fullPage: true });
await p.goto(base + '/secrets?slots=1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
checks.slotsShownPreview = await p.locator('.sx-slot').count();
console.log(JSON.stringify({ checks, errors }, null, 1));
await b.close();
