import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

// Phase 2 acceptance: a staff user can create, fund and publish a campaign in under 5 minutes.
// This drives the real screens a finance staff member uses, start to finish, and times it.
test('finance staff create a client, record funding, build, fund and publish a campaign', async ({ page }) => {
  test.setTimeout(300_000)
  const started = Date.now()
  const stamp = Date.now()
  await signInAs(page, 'finance@seed.invalid')

  // Client and funding.
  await page.goto('/admin/clients/new')
  await page.getByLabel('Client name').fill(`Acceptance client ${stamp}`)
  await page.getByLabel('Service fee (percent of the budget)').fill('10')
  await page.getByRole('button', { name: 'Create client' }).click()
  await page.waitForURL(/\/admin\/clients\/[0-9a-f-]{36}$/)
  await page.getByLabel('Amount received').fill('$1,100.00')
  await page.getByLabel('Invoice or bank reference').fill(`INV-${stamp}`)
  await page.getByRole('button', { name: 'Record funding' }).click()
  await expect(page.getByText('Funding recorded.')).toBeVisible()

  // Campaign from the clipping template.
  await page.goto('/admin/campaigns/new')
  await page.getByRole('link', { name: /Clipping/ }).click()
  await page.getByLabel('Title').fill(`Acceptance campaign ${stamp}`)
  await page.getByLabel('Client').click()
  await page.getByRole('option', { name: `Acceptance client ${stamp}` }).click()
  await page.getByLabel('Cover image link').fill('/designed/camp-clip.png')
  await page.getByLabel('Brief').fill('Cut the best moments from the footage and post them on your own account.')
  await page.getByText('TikTok', { exact: true }).click()
  await page.getByLabel('Budget', { exact: true }).fill('$1,000.00')
  await page.getByLabel('Rate per 1,000 counted views').fill('$2.00')
  await page.getByLabel('Minimum views to earn').fill('1000')
  await page
    .getByLabel('Rules', { exact: true })
    .fill('Post on your own public account. Keep the post up for 30 days after the campaign closes.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await page.waitForURL(/\/admin\/campaigns\/[0-9a-f-]{36}\?saved=1$/)
  await expect(page.getByText('Draft saved.')).toBeVisible()

  // Fund from the client's balance, then publish.
  await page.getByRole('button', { name: 'Fund $1,100.00 from client balance' }).click()
  await expect(page.getByText('Funded. Publish it to go live.')).toBeVisible()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published. The campaign is live.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Live', { exact: true })).toBeVisible()

  const minutes = (Date.now() - started) / 60_000
  expect(minutes).toBeLessThan(5)
})

test('a campaign published before funding waits, and partial funding does not make it live', async ({ page }) => {
  const stamp = Date.now()
  await signInAs(page, 'finance@seed.invalid')
  await page.goto('/admin/clients/new')
  await page.getByLabel('Client name').fill(`Partial client ${stamp}`)
  await page.getByLabel('Service fee (percent of the budget)').fill('10')
  await page.getByRole('button', { name: 'Create client' }).click()
  await page.waitForURL(/\/admin\/clients\/[0-9a-f-]{36}$/)
  // Only the budget arrived, not the fee.
  await page.getByLabel('Amount received').fill('$1,000.00')
  await page.getByLabel('Invoice or bank reference').fill(`INV-P-${stamp}`)
  await page.getByRole('button', { name: 'Record funding' }).click()
  await expect(page.getByText('Funding recorded.')).toBeVisible()

  await page.goto('/admin/campaigns/new?type=ugc')
  await page.getByLabel('Title').fill(`Partial campaign ${stamp}`)
  await page.getByLabel('Client').click()
  await page.getByRole('option', { name: `Partial client ${stamp}` }).click()
  await page.getByLabel('Cover image link').fill('/designed/camp-ugc.png')
  await page.getByLabel('Brief').fill('Original content made to the brief.')
  await page.getByText('Instagram', { exact: true }).click()
  await page.getByLabel('Budget', { exact: true }).fill('$1,000.00')
  await page.getByLabel('Rate per 1,000 counted views').fill('$2.00')
  await page.getByLabel('Rules', { exact: true }).fill('Original content only.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await page.waitForURL(/\?saved=1$/)

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published. It goes live as soon as it is funded.')).toBeVisible()
  await page.getByRole('button', { name: 'Fund $1,100.00 from client balance' }).click()
  await expect(page.getByText('The client has not paid enough for this budget and fee yet.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Waiting for funding', { exact: true })).toBeVisible()
})

test('reviewers can see campaigns but cannot create or change them', async ({ page }) => {
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/campaigns')
  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New campaign' })).toHaveCount(0)
  const res = await page.goto('/admin/campaigns/new')
  expect(res?.status()).toBe(403)
})
