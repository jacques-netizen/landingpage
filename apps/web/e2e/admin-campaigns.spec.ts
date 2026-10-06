import { expect, test } from '@playwright/test'
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
