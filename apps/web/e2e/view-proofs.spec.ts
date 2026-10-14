import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { readyCreator, scriptPost, signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

// Only the first bytes matter to the upload route; these are a 1x1 PNG and an MP4 file header.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)])

// A creator proves a post's views with a recording (owner request, 2026-10-14); staff set the views
// from it and the post earns from them.
test('a creator proves views with a recording and staff set the views from it', async ({ page, browser }) => {
  const { handle } = await readyCreator(page, sql)
  await page.getByLabel('Link to your post').fill(scriptPost(handle, 'Good one #mde'))
  await page.getByRole('button', { name: 'Submit post' }).click()
  await expect(page.getByText(/^Submitted\.$/)).toBeVisible()
  const [s] = await sql`select id, baseline_views as baseline from submissions
    where creator_id = (select creator_id from linked_accounts where handle = ${handle}) order by submitted_at desc limit 1`
  // A reviewer approved it. As a video, it never offers a proof: its views come from the hourly check.
  await sql`update submissions set state = 'approved', media_kind = 'video' where id = ${s!.id}`
  await page.goto('/submissions')
  await page.getByRole('button', { name: 'Sample music' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText(/Last updated/)).toBeVisible()
  await expect(drawer.getByText('Update views yourself')).toHaveCount(0)
  await page.keyboard.press('Escape')
  // As a picture post, it does.
  await sql`update submissions set media_kind = 'image' where id = ${s!.id}`
  await page.reload()
  await page.getByRole('button', { name: 'Sample music' }).click()
  await drawer.getByRole('button', { name: 'Update views with a recording' }).click()
  await expect(drawer.getByText('Your code. Show it in the recording.')).toBeVisible()
  const code = (await drawer.getByText(/^MDE-[A-Z0-9]{4}$/).textContent())!.trim()
  await expect(drawer.getByText('Rules for the recording')).toBeVisible()
  await expect(drawer.getByText(/One continuous screen recording/)).toBeVisible()
  await drawer.getByLabel('Screen recording').setInputFiles({ name: 'rec.mp4', mimeType: 'video/mp4', buffer: MP4 })
  await drawer
    .getByLabel('Screenshot of the analytics')
    .setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await drawer.getByLabel('Views shown in your analytics').fill('2,500')
  await drawer.getByLabel('Note').fill('Picture post.')
  const send = drawer.getByRole('button', { name: 'Send proof' })
  await expect(send).toBeEnabled()
  await send.click()
  await expect(drawer.getByText('Your proof was sent and is waiting for review.')).toBeVisible()
  await expect(drawer.getByText('You reported 2,500 views.')).toBeVisible()
  const [p] = await sql`select id, code, status from view_proofs where submission_id = ${s!.id}`
  expect(p!.code).toBe(code)
  expect(p!.status).toBe('submitted')

  // Staff: the proof is waiting, with the recording and screenshot; they set 2,000 (what the recording shows).
  const staff = await browser.newContext()
  const admin = await staff.newPage()
  await signInAs(admin, 'reviewer@seed.invalid')
  await admin.goto('/admin/review/proofs')
  const card = admin.locator('article', { hasText: `@${handle}` })
  await expect(card.getByText('Picture post.')).toBeVisible()
  await expect(card.locator('video')).toHaveAttribute('src', /\/files\//)
  await expect(card.getByText(code)).toBeVisible()
  await card.getByLabel('Views the recording shows').fill('2,000')
  await card.getByRole('button', { name: 'Set views and approve' }).click()
  // Decided: it leaves the waiting list and shows under Decided with the views set.
  await expect(card).toHaveCount(0)
  await admin.goto('/admin/review/proofs?show=decided')
  await expect(
    admin.locator('article', { hasText: `@${handle}` }).getByText(/Approved, views set to 2,000/),
  ).toBeVisible()
  await staff.close()

  const [after] = await sql`select latest_views, counted_views, earned_cents from submissions where id = ${s!.id}`
  expect(Number(after!.latest_views)).toBe(2000)
  expect(Number(after!.counted_views)).toBe(2000 - Number(s!.baseline))
  const [snap] =
    await sql`select views, source from view_snapshots where submission_id = ${s!.id} and source = 'manual'`
  expect(Number(snap!.views)).toBe(2000)
  const [audit] =
    await sql`select action from audit_log where entity_id = ${s!.id} and action = 'submission.views_set_by_proof'`
  expect(audit).toBeTruthy()

  // The creator sees the result and the notification, and cannot send another proof today.
  await page.reload()
  await page.getByRole('button', { name: 'Sample music' }).click()
  await expect(drawer.getByText('Your proof was accepted.')).toBeVisible()
  await expect(drawer.getByText(/Views set to 2,000/)).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Update views with a recording' })).toHaveCount(0)
  const [n] =
    await sql`select kind, title from notifications where user_id = (select creator_id from submissions where id = ${s!.id}) order by created_at desc limit 1`
  expect(n!.kind).toBe('view_proof')
  expect(n!.title).toBe('Your view proof was approved')
})
