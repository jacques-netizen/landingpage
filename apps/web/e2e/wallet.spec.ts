import { expect, test, type Page } from '@playwright/test'
import { createDb } from '@mde/db'
import { MockProvider, ProviderRouter, writeMockState } from '@mde/platforms'
import { runViewCheck } from '@mde/tracking'
import postgres from 'postgres'
import { readyCreator, scriptPost, signInAs, signUpNewCreator } from './helpers'

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

/** An admin credits the creator through the admin page: the money lands in their available balance. */
async function creditThroughAdmin(page: Page, username: string, dollars: string) {
  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/credits')
  await page.getByLabel('Username or email').fill(`@${username}`)
  await page.getByLabel('Amount').fill(dollars)
  await page.getByLabel('Reason').fill('Launch bonus')
  await page.getByRole('button', { name: 'Credit user' }).click()
  await expect(page.getByText(`Credited $${dollars}.00 to @${username}`, { exact: false })).toBeVisible()
}

async function signUpWithUsername(page: Page) {
  const email = await signUpNewCreator(page)
  const [me] = await sql`select id, username from users where email = ${email}`
  return { email, id: me!.id as string, username: me!.username as string }
}

async function signBackIn(page: Page, email: string) {
  await signInAs(page, email)
  await page.goto('/wallet')
  await page.waitForLoadState('networkidle')
}

test('admins credit a user, who withdraws to a crypto wallet set up in three steps; staff verify and pay', async ({
  page,
}) => {
  const me = await signUpWithUsername(page)
  await creditThroughAdmin(page, me.username, '50')
  const notes = await sql`select title from notifications where user_id = ${me.id}`
  expect(notes.map((n) => n.title)).toContain('You received $50.00')

  await signBackIn(page, me.email)
  await page.getByRole('link', { name: /^Add payout method/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add payout method' })
  await expect(dialog.getByLabel('Wallet address')).toBeDisabled()
  await dialog.getByRole('button', { name: 'USDT', exact: true }).click()
  await dialog.getByRole('button', { name: 'Tron (TRC-20)', exact: true }).click()
  await dialog.getByLabel('Wallet address').fill('0x52908400098527886E0F7030069857D2E4169EE7')
  await dialog.getByRole('button', { name: 'Save payout method' }).click()
  await expect(dialog.getByText('That is not an address on this network.', { exact: false })).toBeVisible()
  await dialog.getByLabel('Wallet address').fill('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE')
  await dialog.getByRole('button', { name: 'Save payout method' }).click()
  await expect(page.getByText('USDT on Tron (TRC-20), TQn9Y2…bLSE').first()).toBeVisible()

  await page.getByRole('link', { name: /^Withdraw\s*→/ }).click()
  const w = page.getByRole('dialog', { name: 'Withdraw' })
  await expect(w.getByLabel('Amount in USD')).toHaveValue('50.00')
  await w.getByRole('button', { name: 'Request withdrawal' }).click()
  await expect(page.getByText('Verifying').first()).toBeVisible()
  const [req] = await sql`select id, status, destination, amount_cents from withdrawals where creator_id = ${me.id}`
  expect(req).toMatchObject({ status: 'requested', destination: 'USDT|tron|TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' })
  expect(Number(req!.amount_cents)).toBe(5_000)

  await signInAs(page, 'finance@seed.invalid')
  await page.goto('/admin/payouts')
  const row = page.getByRole('region').filter({ hasText: me.email })
  await expect(row.getByText('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE')).toBeVisible()
  await row.getByRole('button', { name: 'Verify' }).click()
  await expect(row).toHaveCount(0)
  expect((await sql`select status from withdrawals where id = ${req!.id}`)[0]!.status).toBe('approved')
  await page.goto('/admin/payouts?show=send')
  const sendRow = page.getByRole('region').filter({ hasText: me.email })
  await sendRow.getByLabel('Transaction hash').fill('not-a-hash')
  await sendRow.getByRole('button', { name: 'Mark paid' }).click()
  await expect(sendRow.getByText('Paste the transaction hash', { exact: false })).toBeVisible()
  await sendRow.getByLabel('Transaction hash').fill('a'.repeat(64))
  await sendRow.getByRole('button', { name: 'Mark paid' }).click()
  await expect(sendRow).toHaveCount(0)
  const [done] = await sql`select status, partner_reference from withdrawals where id = ${req!.id}`
  expect(done).toMatchObject({ status: 'paid', partner_reference: 'a'.repeat(64) })
  const all = await sql`select title from notifications where user_id = ${me.id} and kind = 'withdrawal_status'`
  expect(all.map((n) => n.title)).toEqual(
    expect.arrayContaining(['Your withdrawal is verified', 'Your withdrawal was sent']),
  )
})

test('a creator withdraws to a bank account; staff pay it with the bank reference', async ({ page }) => {
  const me = await signUpWithUsername(page)
  await creditThroughAdmin(page, me.username, '30')
  await signBackIn(page, me.email)
  await page.getByRole('link', { name: /^Add payout method/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add payout method' })
  await dialog.getByRole('button', { name: 'Bank transfer', exact: true }).click()
  await dialog.getByLabel('Bank name').fill('Chase Bank')
  await dialog.getByLabel('Bank account number').fill('1234 5678 9')
  await dialog.getByLabel('Name on account').fill('Kymen Carter')
  await dialog.getByRole('button', { name: 'Save payout method' }).click()
  await expect(dialog.getByText('Choose the country your bank is in.')).toBeVisible()
  await dialog.getByLabel('Location').selectOption('US')
  await dialog.getByRole('button', { name: 'Save payout method' }).click()
  await expect(page.getByText('Bank transfer, Chase Bank, ending 6789 (United States)').first()).toBeVisible()

  await page.getByRole('link', { name: /^Withdraw\s*→/ }).click()
  await page.getByRole('dialog', { name: 'Withdraw' }).getByRole('button', { name: 'Request withdrawal' }).click()
  await expect(page.getByText('Verifying').first()).toBeVisible()
  const [req] = await sql`select id, method, destination from withdrawals where creator_id = ${me.id}`
  expect(req).toMatchObject({ method: 'bank_transfer', destination: 'BANK|US|Chase Bank|123456789|Kymen Carter' })

  await signInAs(page, 'finance@seed.invalid')
  await page.goto('/admin/payouts')
  const row = page.getByRole('region').filter({ hasText: me.email })
  await expect(row.getByText('Chase Bank')).toBeVisible()
  await row.getByRole('button', { name: 'Verify' }).click()
  await expect(row).toHaveCount(0)
  await page.goto('/admin/payouts?show=send')
  const sendRow = page.getByRole('region').filter({ hasText: me.email })
  await sendRow.getByLabel('Bank reference').fill('WIRE-2026-001')
  await sendRow.getByRole('button', { name: 'Mark paid' }).click()
  await expect(sendRow).toHaveCount(0)
  const [done] = await sql`select status, partner_reference from withdrawals where id = ${req!.id}`
  expect(done).toMatchObject({ status: 'paid', partner_reference: 'WIRE-2026-001' })
})

test('only admins can credit users', async ({ page }) => {
  await signInAs(page, 'finance@seed.invalid')
  const res = await page.goto('/admin/credits')
  expect(res?.status()).toBe(403)
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
