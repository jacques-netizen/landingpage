import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

/** One post waiting for review on "Sample clipping", with likes and comments from its last check. */
async function seedPost(tag: string) {
  const [c] =
    await sql`select id, current_terms_version_id as terms, rate_cents_per_1000 as rate from campaigns where title = 'Sample clipping'`
  const [u] = await sql`insert into users (email, username) values (${`${tag}@test.invalid`}, ${tag}) returning id`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  const [s] = await sql`
    insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
      rate_cents_per_1000_locked, submitted_at, latest_views)
    values (${c!.id}, ${u!.id}, 'tiktok', ${`https://www.tiktok.com/@${tag}/video/1`}, ${tag},
      'needs_review', ${c!.terms}, ${c!.rate}, now() - interval '3 hours', 4353)
    returning id`
  await sql`insert into view_snapshots (submission_id, taken_at, views, likes, comments, shares)
    values (${s!.id}, now() - interval '1 hour', 4353, 25, 3, 2)`
  return { campaignId: c!.id as string, id: s!.id as string }
}

const state = async (id: string) => (await sql`select state from submissions where id = ${id}`)[0]?.state

// Testing report (2026-10-08), items 1 and 8: each post in a campaign shows its views, likes and
// comments, and staff approve, deny, set to pending or delete it from the row.
test('staff manage a campaign’s posts from its Submissions tab', async ({ page }) => {
  const tag = `sub${Date.now() % 1e9}`
  const { campaignId, id } = await seedPost(tag)
  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${campaignId}?tab=submissions&show=pending`)
  await page.getByLabel('Search posts').fill(tag)
  await page.getByRole('button', { name: 'Search' }).click()
  const row = page.getByRole('row').filter({ hasText: tag })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('4,353')
  await expect(row).toContainText('25 likes')
  await expect(row).toContainText('3 comments')
  await expect(row).toContainText('1h ago')

  // Approve, then back to pending.
  await row.getByRole('button', { name: 'Approve' }).click()
  await expect.poll(() => state(id)).toMatch(/approved|earning/)
  await page.goto(`/admin/campaigns/${campaignId}?tab=submissions&show=approved&q=${tag}`)
  await row.getByRole('button', { name: 'Set to pending' }).click()
  await expect.poll(() => state(id)).toBe('needs_review')

  // Deny needs a reason.
  await page.goto(`/admin/campaigns/${campaignId}?tab=submissions&show=pending&q=${tag}`)
  await row.getByRole('button', { name: 'Deny' }).click()
  await row.getByRole('button', { name: 'Deny post' }).click()
  await expect(row.getByRole('alert')).toHaveText('Choose a reason from the list.')
  await row.getByLabel('Reason').selectOption('not_original')
  await row.getByRole('button', { name: 'Deny post' }).click()
  await expect.poll(() => state(id)).toBe('rejected')

  // Delete, after confirming.
  await page.goto(`/admin/campaigns/${campaignId}?tab=submissions&show=rejected&q=${tag}`)
  await row.getByRole('button', { name: 'Delete' }).click()
  await row.getByRole('button', { name: 'Delete post' }).click()
  await expect.poll(() => state(id)).toBeUndefined()
  const [a] = await sql`select action from audit_log where entity_id = ${id} and action = 'submission.delete'`
  expect(a).toBeTruthy()
})

test('reviewers decide posts but only admins delete them', async ({ page }) => {
  const tag = `rvw${Date.now() % 1e9}`
  const { campaignId } = await seedPost(tag)
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto(`/admin/campaigns/${campaignId}?tab=submissions&show=pending&q=${tag}`)
  const row = page.getByRole('row').filter({ hasText: tag })
  await expect(row.getByRole('button', { name: 'Approve' })).toBeEnabled()
  await expect(row.getByRole('button', { name: 'Delete' })).toHaveCount(0)
})
