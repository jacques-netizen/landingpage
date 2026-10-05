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
