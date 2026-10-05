import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { readyCreator, scriptPost } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

test('a creator submits a post and sees every check pass', async ({ page }) => {
  const { handle } = await readyCreator(page, sql)
  await page.getByLabel('Link to your post').fill(scriptPost(handle, 'New sound #ad'))
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
  await expect(page.getByText('A required hashtag is missing. Missing #ad')).toBeVisible()

  // Staff rewording is what the creator sees next time.
  await sql`update reason_codes set creator_message = 'Add every hashtag the campaign lists.' where code = 'missing_hashtag'`
  try {
    await page.getByLabel('Link to your post').fill(scriptPost(handle, 'still no tag'))
    await page.getByRole('button', { name: 'Submit post' }).click()
    await expect(page.getByText('Add every hashtag the campaign lists. Missing #ad')).toBeVisible()
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
