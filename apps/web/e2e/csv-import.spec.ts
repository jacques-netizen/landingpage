import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

// Staff add posts to a campaign from a CSV (owner request, 2026-10-30): good rows go in, approved ones
// are approved through the review step, and every other row says why it was left out.
test('staff add posts to a campaign from a CSV', async ({ page }) => {
  const tag = `csv${Date.now() % 1e7}`
  const [c] = await sql`select id from campaigns where title = 'Sample clipping'`
  const [u] = await sql`insert into users (email, username) values (${`${tag}@test.invalid`}, ${tag}) returning id`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  const a = `https://www.tiktok.com/@${tag}/video/7${Date.now() % 1e9}01`
  const b = `https://www.tiktok.com/@${tag}/video/7${Date.now() % 1e9}02`
  const csv = [
    'url,clipper,status',
    `${a},${tag},approved`,
    `${b},${tag}@test.invalid,`,
    `https://example.com/not-a-post,${tag},`,
    `${a},${tag},approved`,
    `https://www.tiktok.com/@x/video/7${Date.now() % 1e9}03,nobody-${tag},`,
  ].join('\n')

  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}?tab=clips`)
  await page.getByRole('button', { name: 'Import a CSV' }).click()
  await page.getByLabel('CSV file').setInputFiles({ name: 'posts.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Add posts' }).click()
  await expect(page.getByText('2 added (1 approved), 1 skipped, 2 with a problem.')).toBeVisible()
  await expect(page.getByText('Not a TikTok, Instagram, YouTube or X post link.')).toBeVisible()
  await expect(page.getByText(`No clipper with the username, email or tiktok handle "nobody-${tag}".`)).toBeVisible()
  await expect(page.getByText('The same post is higher up in the file.')).toBeVisible()

  const rows =
    await sql`select post_url, state, creator_id from submissions where creator_id = ${u!.id} order by post_url`
  expect(rows.map((r) => [r.post_url, r.state])).toEqual([
    [a, 'approved'],
    [b, 'needs_review'],
  ])
  const [audit] =
    await sql`select after from audit_log where action = 'submissions.csv_import' and entity_id = ${c!.id} order by id desc limit 1`
  expect(audit!.after).toMatchObject({ added: 2, approved: 1, skipped: 1, errors: 2 })
})
