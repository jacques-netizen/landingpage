import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signUpNewCreator } from './helpers'

// Phase 2 acceptance: a visitor sees every rule from 01_PRODUCT.md section 6.3 without signing in.
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

async function campaignId(title: string) {
  const [row] = await sql`select id from campaigns where title = ${title}`
  return row!.id as string
}

test('a signed-out visitor sees every rule before joining', async ({ page }) => {
  await page.goto(`/campaigns/${await campaignId('Sample clipping')}`)
  for (const label of [
    'Rate',
    'Budget',
    'Paid to creators so far',
    'Left in budget',
    'Most one post can earn',
    'Most one creator can earn',
    'Minimum views to earn',
    'Engagement',
    'Platforms',
    'Minimum followers',
    'Minimum account age',
    'Posts per linked account',
    'Languages',
    'Audience regions',
    'Required hashtags',
    'Minimum duration',
    'How posts are checked',
    'Keep the post up',
    'Submissions open',
    'Submissions close',
  ])
    await expect(page.locator('dt', { hasText: new RegExp(`^${label}$`) }).first(), label).toBeVisible()
  await expect(page.getByText('$2.00 per 1,000 counted views')).toBeVisible()
  await expect(page.getByText('$4,800.00').first()).toBeVisible()
  await expect(page.getByText(/Rules in force since/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in to join' })).toBeVisible()
})

test('a creator joins a public campaign', async ({ page }) => {
  await signUpNewCreator(page)
  await page.goto(`/campaigns/${await campaignId('Sample music')}`)
  await page.getByRole('button', { name: 'Join campaign' }).click()
  await expect(page.getByText('You have joined this campaign.')).toBeVisible()
})

test('a private campaign is not listed and needs its access code to join', async ({ page }) => {
  const id = await campaignId('Sample UGC')
  await sql`update campaigns set visibility = 'private', access_code = 'MDE-7K4Q' where id = ${id}`
  try {
    await page.goto('/campaigns')
    await expect(page.getByText('Sample UGC', { exact: true })).toHaveCount(0)
    await signUpNewCreator(page)
    await page.goto(`/campaigns/${id}`)
    await page.getByLabel('Access code').fill('WRONG')
    await page.getByRole('button', { name: 'Join campaign' }).click()
    await expect(page.getByText('That access code is not right.')).toBeVisible()
    await page.getByLabel('Access code').fill('mde-7k4q')
    await page.getByRole('button', { name: 'Join campaign' }).click()
    await expect(page.getByText('You have joined this campaign.')).toBeVisible()
  } finally {
    await sql`update campaigns set visibility = 'public', access_code = null where id = ${id}`
  }
})

test('unpublished and unknown campaigns are not shown to the public', async ({ page }) => {
  const draft = await campaignId('Seed draft campaign')
  expect((await page.goto(`/campaigns/${draft}`))?.status()).toBe(404)
  expect((await page.goto('/campaigns/00000000-0000-0000-0000-000000000000'))?.status()).toBe(404)
  await expect(page.getByText('This campaign is not available.')).toBeVisible()
})

test('an ended campaign shows what was paid out of the budget, not "$0 left"', async ({ page }) => {
  const [c] = await sql`select id, budget_cents from campaigns where title = 'Seed closing campaign'`
  await page.goto('/campaigns')
  const shown = `$${(Number(c!.budget_cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  await expect(page.getByText('Past campaigns')).toBeVisible()
  await page.goto(`/campaigns/${c!.id}`)
  await expect(page.getByText('Budget paid out')).toBeVisible()
  await expect(page.getByText(`/${shown}`).first()).toBeVisible()
})
