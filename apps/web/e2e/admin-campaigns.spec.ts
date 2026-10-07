import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

// Phase 2 acceptance: a staff user can create, fund and publish a campaign in under 5 minutes.
// This drives the real screens a finance staff member uses, start to finish, and times it.
test('finance staff build a campaign with a new client, uploads and a plain budget, and put it live in one step', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const started = Date.now()
  const stamp = Date.now()
  await signInAs(page, 'finance@seed.invalid')

  await page.goto('/admin/campaigns/new')
  await page.getByRole('link', { name: /Clipping/ }).click()
  await page.getByLabel('Title').fill(`Acceptance campaign ${stamp}`)
  // A new client, added without leaving the builder.
  await page.getByRole('button', { name: '+ New client' }).click()
  await page.getByLabel('Client name').fill(`Acceptance client ${stamp}`)
  await page.getByLabel('Service fee percent').fill('10')
  await page.getByRole('button', { name: 'Add client' }).click()
  await expect(page.getByLabel('Client')).toContainText(`Acceptance client ${stamp}`)
  // A real picture for the card, and a file for creators.
  await page.locator('input[type=file][accept="image/*"]').setInputFiles('public/designed/camp-clip.png')
  await expect(page.getByRole('img', { name: 'Campaign picture' })).toBeVisible()
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'brand-logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not really a png'),
  })
  await expect(page.getByText('Uploaded file: brand-logo.png')).toBeVisible()
  await page.getByLabel('Brief').fill('Cut the best moments from the footage and post them on your own account.')
  await page.getByText('TikTok', { exact: true }).click()
  await page.getByLabel('Budget', { exact: true }).fill('1000')
  await page.getByLabel('Pay per 1,000 views').fill('2')
  await page
    .getByLabel('Rules', { exact: true })
    .fill('Post on your own public account. Keep the post up for 30 days after the campaign closes.')
  await page.getByRole('button', { name: 'Save campaign' }).click()
  await page.waitForURL(/\/admin\/campaigns\/[0-9a-f-]{36}\?saved=1$/)

  // One step: the client paid budget plus fee, and the campaign goes live.
  await expect(page.getByText('Client pays in total')).toBeVisible()
  await page.getByLabel('Invoice or payment reference (optional)').fill(`INV-${stamp}`)
  await page.getByRole('button', { name: 'Client paid $1,100.00: go live' }).click()
  await expect(page.getByText('Live. Creators can see it and join now.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Live', { exact: true })).toBeVisible()

  // Creators see it with its picture, and can open the uploaded file.
  await page.goto('/campaigns')
  await expect(page.getByText(`Acceptance campaign ${stamp}`).first()).toBeVisible()
  const cover = await page.locator(`img[src^="/files/"]`).first().getAttribute('src')
  expect((await page.request.get(cover!)).status()).toBe(200)

  const minutes = (Date.now() - started) / 60_000
  expect(minutes).toBeLessThan(5)
})

test('going live records only what the client still owes', async ({ page }) => {
  const stamp = Date.now()
  await signInAs(page, 'finance@seed.invalid')
  await page.goto('/admin/clients/new')
  await page.getByLabel('Client name').fill(`Partial client ${stamp}`)
  await page.getByLabel('Service fee (percent of the budget)').fill('10')
  await page.getByRole('button', { name: 'Create client' }).click()
  await page.waitForURL(/\/admin\/clients\/[0-9a-f-]{36}$/)
  // Part of the money arrived earlier.
  await page.getByLabel('Amount received').fill('1000')
  await page.getByLabel('Invoice or bank reference').fill(`INV-P-${stamp}`)
  await page.getByRole('button', { name: 'Record funding' }).click()
  await expect(page.getByText('Funding recorded.')).toBeVisible()

  await page.goto('/admin/campaigns/new?type=ugc')
  await page.getByLabel('Title').fill(`Partial campaign ${stamp}`)
  await page.getByLabel('Client').click()
  await page.getByRole('option', { name: `Partial client ${stamp}` }).click()
  await page.getByLabel('Brief').fill('Original content made to the brief.')
  await page.getByText('Instagram', { exact: true }).click()
  await page.getByLabel('Budget', { exact: true }).fill('1k')
  await page.getByLabel('Pay per 1,000 views').fill('2')
  await page.getByLabel('Rules', { exact: true }).fill('Original content only.')
  await page.getByRole('button', { name: 'Save campaign' }).click()
  await page.waitForURL(/\?saved=1$/)

  // No picture yet: it cannot go live.
  await expect(page.getByText(/Before it can go live, add the/)).toBeVisible()
  await page.locator('input[type=file][accept="image/*"]').setInputFiles('public/designed/camp-ugc.png')
  await expect(page.getByRole('img', { name: 'Campaign picture' })).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Already paid in')).toBeVisible()
  await page.getByRole('button', { name: 'Client paid $100.00: go live' }).click()
  await expect(page.getByText('Live. Creators can see it and join now.')).toBeVisible()
})

test('reviewers can see campaigns but cannot create or change them', async ({ page }) => {
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/campaigns')
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New campaign' })).toHaveCount(0)
  const res = await page.goto('/admin/campaigns/new')
  expect(res?.status()).toBe(403)
})

test('staff watch a live campaign on its monitor', async ({ page }) => {
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/campaigns')
  await page.getByRole('link', { name: 'Sample clipping' }).first().click()
  await page.getByRole('link', { name: 'Monitor' }).click()
  await expect(page.getByRole('heading', { name: 'Sample clipping: monitor' })).toBeVisible()
  await expect(page.getByText('$4,800.00')).toBeVisible()
  for (const h of ['Budget', 'Posts by state', 'Flagged posts', 'Top creators', 'Closing'])
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close campaign' })).toBeVisible()
})

test('the campaign overview shows the numbers and every approved, pending and rejected post', async ({ page }) => {
  const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
    max: 1,
    onnotice: () => {},
  })
  const [c] =
    await sql`select id, current_terms_version_id as terms, rate_cents_per_1000 as rate from campaigns where title = 'Sample clipping'`
  const [u] =
    await sql`insert into users (email, display_name) values (${`ov-${Date.now()}@test.invalid`}, 'Overview creator') returning id`
  await sql`insert into campaign_members (campaign_id, creator_id) values (${c!.id}, ${u!.id})`
  const tag = `ov${Date.now()}`
  for (const [i, state] of ['earning', 'needs_review', 'rejected'].entries())
    await sql`
      insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
        rate_cents_per_1000_locked, submitted_at, latest_views, baseline_views)
      values (${c!.id}, ${u!.id}, 'tiktok', ${`https://www.tiktok.com/@${tag}/video/${i}`}, ${`${tag}${i}`}, ${state},
        ${c!.terms}, ${c!.rate}, now(), 5000, 0)`
  await sql.end()

  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}`)
  for (const k of ['Views on approved posts', 'Counted views', 'Approved posts', 'Pending posts', 'Rejected posts'])
    await expect(page.getByText(k, { exact: true })).toBeVisible()
  for (const h of ['Description', 'Campaign rules']) await expect(page.getByRole('heading', { name: h })).toBeVisible()
  const campaignTabs = page.getByRole('navigation', { name: 'Campaign', exact: true })
  await campaignTabs.getByRole('link', { name: 'Creators', exact: true }).click()
  await expect(page.locator(`a[href="/admin/creators/${u!.id}"]`)).toBeVisible()
  await campaignTabs.getByRole('link', { name: 'Pages', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pages' })).toBeVisible()
  await campaignTabs.getByRole('link', { name: 'Submissions', exact: true }).click()
  const tabs = page.getByRole('navigation', { name: 'Posts by outcome' })
  await expect(tabs.getByRole('link', { name: /^Approved \d+$/ })).toBeVisible()
  const postLink = (i: number) => page.locator(`a[href="https://www.tiktok.com/@${tag}/video/${i}"]`)
  await expect(postLink(0)).toBeVisible()
  await tabs.getByRole('link', { name: /^Pending/ }).click()
  await expect(postLink(1)).toBeVisible()
  await expect(postLink(0)).toHaveCount(0)
  await tabs.getByRole('link', { name: /^Rejected/ }).click()
  await expect(postLink(2)).toBeVisible()
})
