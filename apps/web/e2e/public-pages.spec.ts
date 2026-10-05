import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', { max: 1 })
test.afterAll(() => sql.end())

test('the fees page reads its numbers from settings', async ({ page }) => {
  const keys = ['withdrawal_fee_bps', 'withdrawal_fee_min_cents', 'withdrawal_min_cents']
  const before = await sql<{ key: string; value: unknown }[]>`select key, value from settings where key in ${sql(keys)}`
  try {
    await page.goto('/fees')
    await expect(page.getByRole('row', { name: /Withdrawal fee/ })).toContainText('None')
    await expect(page.getByRole('row', { name: /Minimum withdrawal/ })).toContainText('$20.00')

    for (const [key, value] of [
      ['withdrawal_fee_bps', 250],
      ['withdrawal_fee_min_cents', 300],
      ['withdrawal_min_cents', 5000],
    ] as const)
      await sql`insert into settings (key, value) values (${key}, ${sql.json(value)})
        on conflict (key) do update set value = excluded.value`
    await page.reload()
    await expect(page.getByRole('row', { name: /Withdrawal fee/ })).toContainText('2.5% of the amount, at least $3.00')
    await expect(page.getByRole('row', { name: /Minimum withdrawal/ })).toContainText('$50.00')
  } finally {
    for (const row of before)
      await sql`update settings set value = ${sql.json(row.value as never)} where key = ${row.key}`
  }
})

test('the home page How it works button opens the five steps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /How it works/ }).click()
  await expect(page).toHaveURL(/\/how-it-works$/)
  await expect(page.getByRole('listitem')).toHaveCount(5)
  await expect(page.getByText('Review, and appeal if you disagree')).toBeVisible()
})

test('the brand site footer links to the legal pages', async ({ page }) => {
  await page.goto('/brands')
  await page.getByRole('link', { name: 'Privacy Policy' }).click()
  await expect(page).toHaveURL(/\/legal\/privacy$/)
  await expect(page.getByRole('note')).toContainText('Working text')
})

test('legal pages show the version in force and keep earlier versions', async ({ page }) => {
  await sql`delete from legal_documents where slug = 'campaign-rules'`
  try {
    await sql`insert into legal_documents (slug, version, title, body_markdown, effective_at) values
      ('campaign-rules', 1, 'Campaign Rules', 'First text.', '2026-01-10T00:00:00Z'),
      ('campaign-rules', 2, 'Campaign Rules', 'Second text.', '2026-03-01T00:00:00Z'),
      ('campaign-rules', 3, 'Campaign Rules', 'Future text.', '2099-01-01T00:00:00Z')`
    await page.goto('/legal/campaign-rules')
    await expect(page.getByText('Second text.')).toBeVisible()
    await expect(page.getByText('Version 2, in force from March 1, 2026.')).toBeVisible()
    await expect(page.getByText('Future text.')).toHaveCount(0)
    await expect(page.getByRole('note')).toHaveCount(0)
    await page.getByRole('link', { name: 'Version 1, from January 10, 2026' }).click()
    await expect(page.getByText('First text.')).toBeVisible()
  } finally {
    await sql`delete from legal_documents where slug = 'campaign-rules'`
  }
  const res = await page.goto('/legal/not-a-page')
  expect(res?.status()).toBe(404)
})

test('the client enquiry form checks fields and emails staff', async ({ page }) => {
  const name = `Enquiry ${Date.now()}`
  await page.goto('/for-clients')
  await page.getByRole('button', { name: 'Send enquiry' }).click()
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill('client@example.com')
  await page.getByLabel('Company or artist').fill('Example Records')
  await page.getByLabel('What would you like to promote?').fill('A new single out next month.')
  await page.getByRole('button', { name: 'Send enquiry' }).click()
  await expect(page.getByText('Thank you. Your message is with us.')).toBeVisible()
  const outbox = fs.readFileSync(path.join(os.tmpdir(), 'mde-dev-outbox.jsonl'), 'utf8')
  const mail = outbox
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { subject: string; text: string })
    .find((m) => m.text.includes(name))
  expect(mail?.subject).toBe('New client enquiry')
  expect(mail?.text).toContain('A new single out next month.')
})

test('help search narrows the answers', async ({ page }) => {
  await page.goto('/help')
  await page.getByRole('searchbox', { name: 'Search help' }).fill('withdraw')
  await expect(page.getByText('When can I withdraw?')).toBeVisible()
  await expect(page.getByText('How do I link an account?')).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search help' }).fill('zzzz')
  await expect(page.getByText('No answers match.')).toBeVisible()
})
