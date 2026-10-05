import type { Page } from '@playwright/test'
import { latestLink } from './outbox'

/** Sign in by magic link as an existing account (seed staff use the seed.invalid domain). */
export async function signInAs(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.waitForURL('**/check-email')
  await page.goto(await latestLink(email))
  await page.waitForLoadState('networkidle')
}

/** Sign up a brand new creator (both consent boxes ticked) and sign in. Returns the email. */
export async function signUpNewCreator(page: Page, prefix = 'creator') {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`
  await page.context().clearCookies()
  await page.goto('/sign-up')
  await page.getByText('I am 18 or older.').click()
  await page.getByText('I agree to the terms of use and the privacy policy.').click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.waitForURL('**/check-email')
  await page.goto(await latestLink(email))
  await page.waitForLoadState('networkidle')
  return email
}
