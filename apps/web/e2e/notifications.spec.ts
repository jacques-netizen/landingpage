import { expect, test } from '@playwright/test'
import { createDb } from '@mde/db'
import { deliverPendingEmails } from '@mde/notifications'
import { mailsTo } from './outbox'
import { signUpNewCreator } from './helpers'

const { db, sql } = createDb(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

async function creatorId(email: string) {
  return (await sql`select id from users where email = ${email}`)[0]!.id as string
}

test('a creator reads notifications in the app and turns emails off', async ({ page }) => {
  const email = await signUpNewCreator(page, 'notified')
  const id = await creatorId(email)
  await sql`insert into notifications (user_id, kind, title, body, link)
            values (${id}, 'submission_approved', 'Your post was approved', 'It is being counted now.', '/submissions')`
  await page.goto('/notifications')
  const item = page.getByRole('region', { name: 'Your notifications' }).getByRole('listitem').first()
  await expect(item).toContainText('Your post was approved')
  await expect(item.getByLabel('New')).toBeVisible()
  await page.reload()
  await expect(item.getByLabel('New')).toHaveCount(0)

  await page.getByLabel(/Email me about my account/).uncheck()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  const [u] = await sql`select notify_email, notify_new_campaigns from users where id = ${id}`
  expect(u).toMatchObject({ notify_email: false, notify_new_campaigns: true })
})

test('notification emails have a plain subject, the legal footer, and a one-click preferences link', async ({
  page,
  request,
}) => {
  const email = await signUpNewCreator(page, 'mailed')
  const id = await creatorId(email)
  await sql`insert into notifications (user_id, kind, title, body, link)
            values (${id}, 'earnings_released', 'Earnings released', '$12.50 from Sample music became available.', '/wallet')`
  await deliverPendingEmails(db, { log: () => {} })
  const mail = mailsTo(email).find((m) => m.subject === 'Earnings released to your wallet')!
  expect(mail).toBeTruthy()
  expect(mail.subject).not.toMatch(/\$|\d/)
  expect(mail.text).toContain('$12.50 from Sample music became available.')
  const prefsUrl = mail.text.match(/Change or stop these emails: (\S+)/)![1]!
  const path = new URL(prefsUrl).pathname + new URL(prefsUrl).search

  // The link works without signing in.
  await page.context().clearCookies()
  await page.goto(path)
  await page.getByLabel(/Tell me about new campaigns/).uncheck()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  expect((await sql`select notify_new_campaigns from users where id = ${id}`)[0]!.notify_new_campaigns).toBe(false)

  // Mail clients unsubscribe with one POST; a forged link changes nothing.
  const forged = await request.post(`/api/unsubscribe?u=${id}&t=forged`)
  expect(forged.status()).toBe(400)
  const ok = await request.post(`/api/unsubscribe${new URL(prefsUrl).search}`)
  expect(ok.status()).toBe(200)
  expect((await sql`select notify_email from users where id = ${id}`)[0]!.notify_email).toBe(false)
})

test('a creator answers a reviewer from the link in the notification', async ({ page }) => {
  const email = await signUpNewCreator(page, 'asked')
  const id = await creatorId(email)
  const [c] =
    await sql`select id, current_terms_version_id as terms, rate_cents_per_1000 as rate from campaigns where title = 'Sample clipping'`
  const pid = `asked${Date.now()}`
  const [s] = await sql`
    insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
      rate_cents_per_1000_locked, submitted_at, reason_note)
    values (${c!.id}, ${id}, 'tiktok', ${`https://www.tiktok.com/@asked/video/${pid}`}, ${pid}, 'needs_info', ${c!.terms},
      ${c!.rate}, now(), 'Can you show the sound in the first 5 seconds?')
    returning id`
  await page.goto(`/submissions?open=${s!.id}`)
  await expect(page.getByText('Can you show the sound in the first 5 seconds?')).toBeVisible()
  await page.getByLabel('Your answer').fill('It starts at 0:02, see the pinned comment.')
  await page.getByRole('button', { name: 'Send answer' }).click()
  await expect
    .poll(async () => (await sql`select state from submissions where id = ${s!.id}`)[0]!.state)
    .toBe('needs_review')
})
