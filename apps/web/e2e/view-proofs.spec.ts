import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { readyCreator, scriptPost, signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

// Only the first bytes matter to the upload route: an MP4 file header.
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)])

// A creator verifies an Instagram post's views with a recording of their insights (owner brief,
// 2026-10-15); staff approve it inside the campaign and the post earns from the verified count.
test('a creator verifies views with an insights recording and staff approve it inside the campaign', async ({
  page,
  browser,
}) => {
  const { handle } = await readyCreator(page, sql)
  await page.getByLabel('Link to your post').fill(scriptPost(handle, 'Good one #mde'))
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText(/^Submitted\.$/)).toBeVisible()
  const [s] = await sql`select id, campaign_id, baseline_views as baseline from submissions
    where creator_id = (select creator_id from linked_accounts where handle = ${handle}) order by submitted_at desc limit 1`
  // Approved as a video whose scraped count just moved: no verification is offered.
  await sql`update submissions set state = 'approved', media_kind = 'video' where id = ${s!.id}`
  await page.goto('/submissions')
  await expect(page.getByRole('button', { name: 'Verify views' })).toHaveCount(0)
  // As an Instagram picture post it always is.
  await sql`update submissions set platform = 'instagram', post_url = 'https://www.instagram.com/p/C1abcDEF/', media_kind = null where id = ${s!.id}`
  await page.reload()
  await page.getByRole('button', { name: 'Verify views' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText("Posts don't show views publicly.")).toBeVisible()
  await expect(drawer.getByText(/Record your screen: start on your profile/)).toBeVisible()
  await drawer.getByLabel('Screen recording').setInputFiles({ name: 'rec.mp4', mimeType: 'video/mp4', buffer: MP4 })
  await drawer.getByLabel('Views shown in your insights').fill('2,500')
  const send = drawer.getByRole('button', { name: 'Send verification' })
  await expect(send).toBeEnabled()
  await send.click()
  await expect(drawer.getByText('Verification pending')).toBeVisible()
  await expect(drawer.getByText(/You reported 2,500 views/)).toBeVisible()
  const [p] = await sql`select id, status, flag from view_proofs where submission_id = ${s!.id}`
  expect(p!.status).toBe('submitted')
  expect(p!.flag).toBeNull()
  // The row shows it as pending and offers no second one.
  await page.reload()
  await expect(page.getByText('Verification pending')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verify views' })).toHaveCount(0)

  // Staff: the campaign's Verifications tab shows it with the recording; they approve at 2,000.
  const staff = await browser.newContext()
  const admin = await staff.newPage()
  await signInAs(admin, 'reviewer@seed.invalid')
  await admin.goto(`/admin/campaigns/${s!.campaign_id}?tab=verifications`)
  // Oldest first: pick this one from the waiting list.
  await admin.getByRole('complementary', { name: 'Waiting' }).getByRole('button', { name: `@${handle}` }).click()
  const card = admin.getByRole('article', { name: 'Verification' })
  await expect(card.getByRole('heading', { name: `@${handle}` })).toBeVisible()
  await expect(card.locator('video').last()).toHaveAttribute('src', /\/files\//)
  await expect(card.getByText('2,500').first()).toBeVisible()
  await card.getByLabel('Different number of views').fill('2,000')
  await card.getByRole('button', { name: 'Approve with this number' }).click()
  await expect(admin.getByText(/^2,000 views verified\./)).toBeVisible()
  await expect(
    admin
      .getByRole('region', { name: 'Decided' })
      .getByRole('listitem')
      .filter({ hasText: `@${handle}` })
      .getByText(/approved at 2,000 \(claimed 2,500\)/),
  ).toBeVisible()
  await staff.close()

  const [after] =
    await sql`select latest_views, verified_views, counted_views, earned_cents from submissions where id = ${s!.id}`
  expect(Number(after!.latest_views)).toBe(2000)
  expect(Number(after!.verified_views)).toBe(2000)
  expect(Number(after!.counted_views)).toBe(2000 - Number(s!.baseline))
  const [snap] =
    await sql`select views, source from view_snapshots where submission_id = ${s!.id} and source = 'manual'`
  expect(Number(snap!.views)).toBe(2000)
  const [audit] =
    await sql`select action from audit_log where entity_id = ${s!.id} and action = 'submission.views_verified'`
  expect(audit).toBeTruthy()

  // The creator sees the result and the notification, and waits three days before the next one.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Verify views' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sample music' }).click()
  await expect(drawer.getByText('Your verification was approved.')).toBeVisible()
  await expect(drawer.getByText(/2,000 views verified/)).toBeVisible()
  await expect(drawer.getByText(/You can send the next verification after/)).toBeVisible()
  const [n] =
    await sql`select kind, title from notifications where user_id = (select creator_id from submissions where id = ${s!.id}) order by created_at desc limit 1`
  expect(n!.kind).toBe('view_proof')
  expect(n!.title).toBe('Your view verification was approved')
})
