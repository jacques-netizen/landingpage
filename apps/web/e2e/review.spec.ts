import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

/** Clean posts waiting for review on "Sample clipping", from a fresh creator. */
async function seedPosts(n: number, tag: string) {
  const [c] =
    await sql`select id, current_terms_version_id as terms, rate_cents_per_1000 as rate from campaigns where title = 'Sample clipping'`
  const [u] =
    await sql`insert into users (email, display_name) values (${`${tag}-${Date.now()}@test.invalid`}, ${tag}) returning id`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const [s] = await sql`
      insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
        rate_cents_per_1000_locked, submitted_at, check_results)
      values (${c!.id}, ${u!.id}, 'tiktok', ${`https://www.tiktok.com/@${tag}/video/${Date.now()}${i}`}, ${`${tag}${Date.now()}${i}`},
        'needs_review', ${c!.terms}, ${c!.rate}, now() - interval '1 day' + ${i} * interval '1 second',
        ${sql.json([{ check: 3, label: 'Posted on a linked account', status: 'pass' }])})
      returning id`
    ids.push(s!.id)
  }
  return { creatorId: u!.id as string, ids }
}

test('a reviewer clears 50 clean posts in under 10 minutes with the keyboard', async ({ page }) => {
  test.setTimeout(11 * 60_000)
  // Only the seeded posts are waiting, oldest first.
  await sql`update submissions set state = 'needs_info' where state in ('needs_review', 'flagged')`
  const { ids } = await seedPosts(50, 'keyboard')
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/review')
  await expect(page.getByText('Oldest first')).toBeVisible()
  await page.waitForLoadState('networkidle')

  const started = Date.now()
  for (let done = 1; done <= 50; done++) {
    await page.keyboard.press('a')
    await expect
      .poll(async () =>
        Number(
          (await sql`select count(*)::int as n from submissions where id = any(${ids}) and state = 'needs_review'`)[0]!
            .n,
        ),
      )
      .toBe(50 - done)
  }
  const minutes = (Date.now() - started) / 60_000
  test.info().annotations.push({ type: 'timing', description: `50 posts in ${minutes.toFixed(2)} minutes` })
  expect(minutes).toBeLessThan(10)
  await expect(page.getByText('Nothing waiting for review.')).toBeVisible()
  const [{ n }] =
    (await sql`select count(*)::int as n from review_decisions where submission_id = any(${ids}) and outcome = 'approve'`) as unknown as [
      { n: number },
    ]
  expect(n).toBe(50)
})

test('a reviewer rejects with a reason using J and R, and the creator sees why', async ({ page }) => {
  await sql`update submissions set state = 'needs_info' where state in ('needs_review', 'flagged')`
  const { ids, creatorId } = await seedPosts(2, 'rejecter')
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/review')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('r')
  await expect(page.getByText('Choose a reason, then reject.').first()).toBeVisible()
  await page.keyboard.press('j') // the second post
  const [label] = await sql`select label from reason_codes where code = 'missing_hashtag'`
  await page.getByText(label!.label as string, { exact: true }).click()
  await page.getByLabel('Note to creator').fill('Add #client to the caption.')
  await page.locator('body').click({ position: { x: 5, y: 890 } }) // leave the note so shortcuts work
  await page.keyboard.press('r')
  await expect(page.getByText('Rejected.').first()).toBeVisible()
  const [s] = await sql`select state, reason_code, reason_note from submissions where id = ${ids[1]!}`
  expect(s).toMatchObject({
    state: 'rejected',
    reason_code: 'missing_hashtag',
    reason_note: 'Add #client to the caption.',
  })
  const [note] =
    await sql`select kind, body from notifications where user_id = ${creatorId} order by created_at desc limit 1`
  expect(note).toMatchObject({
    kind: 'submission_rejected',
    body: 'A required hashtag is missing. Add #client to the caption.',
  })
})

test('staff open the full post detail from the queue', async ({ page }) => {
  await sql`update submissions set state = 'needs_info' where state in ('needs_review', 'flagged')`
  await seedPosts(1, 'detail')
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/review')
  await page.getByText('Post detail', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Post detail' })).toBeVisible()
  for (const h of ['Creator and account', 'Checks', 'Flags', 'Decisions', 'Decide'])
    await expect(page.getByRole('heading', { name: h })).toBeVisible()
})
