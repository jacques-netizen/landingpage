import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)])

// Staff add clips that are no longer online from their video files (owner decision, 2026-11-02): each
// shows on the campaign with the views typed, plays from our storage, and is never checked or paid.
test('staff add a clip that is no longer online from its video file', async ({ page }) => {
  const tag = `gone${Date.now() % 1e7}`
  const [c] = await sql`select id from campaigns where title = 'Sample clipping'`

  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}?tab=clips`)
  await page.getByRole('button', { name: 'Upload videos' }).click()
  await page
    .getByLabel('Video files')
    .setInputFiles({ name: 'VIDEO-2026-07-05-10-55-53.mp4', mimeType: 'video/mp4', buffer: MP4 })
  const row = page.getByLabel('VIDEO-2026-07-05-10-55-53.mp4')
  await expect(row.getByLabel('Posted on')).toHaveValue('2026-07-05')
  await row.getByLabel('Page').fill(`@${tag}`)
  await row.getByLabel('Views').fill('12,400')
  await row.getByLabel('Likes').fill('310')
  await page.getByRole('button', { name: 'Add 1 clip' }).click()
  await expect(row.getByText('Added.')).toBeVisible()

  const [s] = await sql`
    select s.id, s.state, s.archived, s.next_check_at, s.earned_cents, s.rate_cents_per_1000_locked, s.latest_views,
      s.submitted_at, s.video_url, a.handle
    from submissions s join linked_accounts a on a.id = s.linked_account_id
    where a.handle = ${tag}`
  expect(s).toMatchObject({
    state: 'approved',
    archived: true,
    next_check_at: null,
    earned_cents: '0',
    rate_cents_per_1000_locked: 0,
    latest_views: '12400',
  })
  expect(new Date(s!.submitted_at).toISOString().slice(0, 10)).toBe('2026-07-05')
  const [day] = await sql`select views, likes from view_snapshot_days where submission_id = ${s!.id}`
  expect(day).toMatchObject({ views: '12400', likes: '310' })
  // No money moved.
  expect((await sql`select count(*)::int as n from ledger_transactions where submission_id = ${s!.id}`)[0]!.n).toBe(0)

  // It plays from our own storage.
  const media = await page.request.get(`/api/admin/media/${s!.id}?kind=video`)
  expect(media.status()).toBe(200)
  expect(
    Buffer.from(await media.body())
      .subarray(4, 8)
      .toString(),
  ).toBe('ftyp')
})
