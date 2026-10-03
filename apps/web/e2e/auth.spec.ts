import { expect, test } from '@playwright/test'
import { latestLink, sql } from './helpers'

test.describe.configure({ mode: 'serial' })

const email = `new-user-${Date.now()}@example.com`

test('sign up needs the age and terms boxes', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('You must be 18 or older to sign up.')).toBeVisible()
  await expect(page.getByText('Accept the terms and the privacy policy to continue.')).toBeVisible()
  const db = sql()
  const rows = await db`select 1 from users where email = ${email}`
  await db.end()
  expect(rows.length).toBe(0)
})

test('sign up, sign out and sign in with an email link', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('I am 18 or older').click()
  await page.getByLabel(/I accept the/).click()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  await page.goto(await latestLink(email))
  await expect(page.getByRole('heading', { name: 'You are signed in' })).toBeVisible()

  const db = sql()
  const [row] =
    await db`select is_adult_confirmed, adult_confirmed_at, terms_accepted_at from users where email = ${email}`
  await db.end()
  expect(row?.is_adult_confirmed).toBe(true)
  expect(row?.adult_confirmed_at).not.toBeNull()
  expect(row?.terms_accepted_at).not.toBeNull()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.goto('/account')
  await expect(page).toHaveURL(/\/sign-in/)

  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await page.goto(await latestLink(email))
  await expect(page.getByRole('heading', { name: 'You are signed in' })).toBeVisible()
})

test('an unknown email gets no link and the same message', async ({ page }) => {
  const unknown = `nobody-${Date.now()}@example.com`
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(unknown)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(
    page.getByText('If that email has an account, a sign in link is on its way.'),
  ).toBeVisible()
  await expect(latestLink(unknown, 1500)).rejects.toThrow()
  const db = sql()
  const rows = await db`select 1 from users where email = ${unknown}`
  await db.end()
  expect(rows.length).toBe(0)
})
