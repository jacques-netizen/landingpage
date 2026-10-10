import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { writeMockState } from '@mde/platforms'
import { readyCreator, scriptPost, signUpNewCreator } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

test('a creator submits a post and sees every check pass', async ({ page }) => {
  const { handle } = await readyCreator(page, sql)
  await page.getByLabel('Link to your post').fill(scriptPost(handle, 'New sound #mde'))
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText('Submitted.', { exact: true })).toBeVisible()
  const rows = page.getByRole('listitem').filter({ hasText: /Pass|Review|Fail/ })
  await expect(rows).toHaveCount(11)
  await expect(page.getByText('Fail', { exact: true })).toHaveCount(0)
})

test('a rejected submission shows the creator message for its reason code', async ({ page }) => {
  const { handle } = await readyCreator(page, sql)
  await page.getByLabel('Link to your post').fill(scriptPost(handle, 'New sound, no tag'))
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText('Not accepted.')).toBeVisible()
  await expect(page.getByText('A required hashtag is missing. Missing #mde')).toBeVisible()

  // Staff rewording is what the creator sees next time.
  await sql`update reason_codes set creator_message = 'Add every hashtag the campaign lists.' where code = 'missing_hashtag'`
  try {
    await page.getByLabel('Link to your post').fill(scriptPost(handle, 'still no tag'))
    await page.getByRole('button', { name: 'Submit post' }).click()
    await expect(page.getByText('Add every hashtag the campaign lists. Missing #mde')).toBeVisible()
  } finally {
    await sql`update reason_codes set creator_message = 'A required hashtag is missing.' where code = 'missing_hashtag'`
  }
})

test('a link that is not a post is turned away with nothing saved', async ({ page }) => {
  const { campaignId } = await readyCreator(page, sql)
  await page.getByLabel('Link to your post').fill('https://www.tiktok.com/@someone')
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText('Not submitted.')).toBeVisible()
  await expect(page.getByText(/not a post we can read/)).toBeVisible()
  await expect(page.getByLabel('Link to your post')).toHaveValue('https://www.tiktok.com/@someone')
  const [row] =
    await sql`select count(*)::int as n from submissions where campaign_id = ${campaignId} and post_url = 'https://www.tiktok.com/@someone'`
  expect(row!.n).toBe(0)
})

test('with account linking off, a creator submits without linking and a reviewer checks the post', async ({ page }) => {
  await signUpNewCreator(page)
  const [c] = await sql`select id from campaigns where title = 'Sample music'`
  await page.goto(`/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Join campaign' }).click()
  await expect(page.getByRole('button', { name: 'Submit post' })).toBeVisible()
  await expect(page.getByText('Account you posted from')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Accounts' })).toHaveCount(0)
  const link = scriptPost(`unlinked${Date.now() % 1e6}`, 'New sound #mde')
  await page.getByLabel('Link to your post').fill(link)
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText('Submitted.', { exact: true })).toBeVisible()
  const [s] = await sql`select state, linked_account_id from submissions where post_url = ${link}`
  expect(s).toMatchObject({ state: 'needs_review', linked_account_id: null })
})

// Owner request (2026-10-10): clippers were turned away with "We could not reach the platform". Now the
// post is kept for a reviewer, and its stats come with the next check.
test('a post submitted while the platform is unreachable is kept for review, never refused', async ({ page }) => {
  await signUpNewCreator(page)
  const [c] = await sql`select id from campaigns where title = 'Sample music'`
  await page.goto(`/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Join campaign' }).click()
  await expect(page.getByRole('button', { name: 'Submit post' })).toBeVisible()
  const link = scriptPost(`down${Date.now() % 1e6}`, 'New sound #mde')
  writeMockState({ down: true })
  try {
    await page.getByLabel('Link to your post').fill(link)
    await page.getByRole('button', { name: 'Submit post' }).click()
    await expect(page.getByText('Submitted.', { exact: true })).toBeVisible()
    await expect(page.getByText(/could not reach the platform/)).toHaveCount(0)
    await expect(
      page.getByText('The platform could not be reached when this was submitted. A reviewer will check.').first(),
    ).toBeVisible()
  } finally {
    writeMockState({ down: false })
  }
  const [s] = await sql`select state, baseline_views, next_check_at from submissions where post_url = ${link}`
  expect(s).toMatchObject({ state: 'needs_review' })
  expect(Number(s!.baseline_views)).toBe(0)
  expect(s!.next_check_at).not.toBeNull()
})
