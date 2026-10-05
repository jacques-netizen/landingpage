import { expect, type Page } from '@playwright/test'
import { writeMockState } from '@mde/platforms'
import type { Sql } from 'postgres'
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
  await page.getByRole('checkbox', { name: 'I am 18 or older.' }).check()
  await page.getByRole('checkbox', { name: 'I agree to the terms of use and the privacy policy.' }).check()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.waitForURL('**/check-email')
  await page.goto(await latestLink(email))
  await page.waitForLoadState('networkidle')
  return email
}

/** Sign up, link a TikTok account by bio code through the mock, and join "Sample music". */
export async function readyCreator(page: Page, sql: Sql) {
  await signUpNewCreator(page)
  const handle = `clip${Date.now() % 1e8}${Math.floor(Math.random() * 1e3)}`
  await page.goto('/accounts')
  await page.getByLabel('Handle').fill(handle)
  await page.getByRole('button', { name: 'Get a code' }).click()
  const code = (await page.getByText(/^MDE-[A-Z0-9]{4}$/).textContent())!.trim()
  writeMockState({ profiles: { [`tiktok:${handle}`]: { bio: code, followers: 8000 } } })
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()

  const [c] = await sql`select id from campaigns where title = 'Sample music'`
  await page.goto(`/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Join campaign' }).click()
  await expect(page.getByRole('button', { name: 'Submit post' })).toBeVisible()
  return { handle, campaignId: c!.id as string }
}

export function scriptPost(handle: string, caption: string) {
  const id = `74${Date.now()}${Math.floor(Math.random() * 1e4)}`.slice(0, 19)
  writeMockState({
    posts: {
      [`tiktok:${id}`]: {
        authorPlatformUserId: `mock-tiktok-${handle}`,
        publishedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        views: 1500,
        durationSeconds: 28,
        caption,
      },
    },
  })
  return `https://www.tiktok.com/@${handle}/video/${id}`
}
