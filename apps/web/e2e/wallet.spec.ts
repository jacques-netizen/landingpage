import { expect, test } from '@playwright/test'
import { createDb } from '@mde/db'
import { MockProvider, ProviderRouter, writeMockState } from '@mde/platforms'
import { runViewCheck } from '@mde/tracking'
import postgres from 'postgres'
import { readyCreator, scriptPost, signUpNewCreator } from './helpers'

const url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde'
const sql = postgres(url, { max: 1, onnotice: () => {} })
const { db, sql: dbSql } = createDb(url, { max: 2, onnotice: () => {} })
test.afterAll(async () => {
  await sql.end()
  await dbSql.end()
})

test('a new creator sees an empty wallet', async ({ page }) => {
  await signUpNewCreator(page)
  await page.goto('/wallet')
  await expect(page.getByText('No earnings yet.')).toBeVisible()
  await expect(page.getByText('No payout method yet')).toBeVisible()
  await page.getByText('Withdrawals', { exact: true }).click()
  await expect(page.getByText('No withdrawals yet.')).toBeVisible()
})

test('earnings from a view check show in the wallet', async ({ page }) => {
  const { handle } = await readyCreator(page, sql)
  const link = scriptPost(handle, 'New sound #mde')
  await page.getByLabel('Link to your post').fill(link)
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText('Submitted.', { exact: true })).toBeVisible()

  // A reviewer approves it (the review queue arrives in Phase 5), then views rise to 6,500.
  const [s] = await sql`update submissions set state = 'approved' where post_url = ${link} returning id, submitted_at`
  const id = link.split('/').pop()!
  writeMockState({
    posts: {
      [`tiktok:${id}`]: {
        authorPlatformUserId: `mock-tiktok-${handle}`,
        publishedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        views: 6_500,
        likes: 400,
        comments: 30,
        durationSeconds: 28,
        caption: 'New sound #mde',
      },
    },
  })
  const router = new ProviderRouter([new MockProvider()], { backoffMs: 1, attempts: 1, log: () => {} })
  const r = await runViewCheck(db, s!.id as string, {
    router,
    now: new Date((s!.submitted_at as Date).getTime() + 3 * 3_600_000),
  })
  // Sample music pays $1.25 per 1,000: (6,500 - 1,500 baseline) x 125 / 1,000 = 625 cents.
  expect(r).toMatchObject({ ran: true, deltaCents: 625 })

  await page.goto('/wallet')
  await expect(page.getByText('+ $6.25 pending review')).toBeVisible()
  await expect(page.getByText('5,000 views')).toBeVisible()
  await expect(page.getByText('+$6.25')).toBeVisible()
  await expect(page.getByText('TODAY')).toBeVisible()

  // My campaigns shows the same post, views and earnings for the campaign.
  await page.goto('/my-campaigns')
  const row = page.getByRole('row', { name: /Sample music/ })
  await expect(row).toContainText('5,000')
  await expect(row).toContainText('$6.25')
  await page.getByRole('link', { name: 'Closed' }).click()
  await expect(page.getByText('No closed campaigns yet.')).toBeVisible()
})
