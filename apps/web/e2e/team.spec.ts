import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'
import { latestLink } from './outbox'

test('an admin adds a moderator, who signs in at the staff page and sees only what moderators may', async ({
  page,
}) => {
  const email = `mod-${Date.now()}@test.invalid`
  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/team')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Add to team' }).click()
  await expect(page.getByText(/^Added\./)).toBeVisible()
  await expect(page.getByRole('cell', { name: email })).toBeVisible()

  // The new moderator: staff sign in, lands on the dashboard.
  await page.context().clearCookies()
  await page.goto('/admin/review')
  await expect(page).toHaveURL(/\/staff\/sign-in\?next=%2Fadmin%2Freview$/)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.waitForURL('**/check-email')
  await page.goto(await latestLink(email))
  await expect(page).toHaveURL(/\/admin\/review$/)
  expect((await page.goto('/admin/team'))?.status()).toBe(403)

  // Removed again: no more access.
  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/team')
  page.once('dialog', (d) => d.accept())
  await page
    .getByRole('row', { name: new RegExp(email) })
    .getByRole('button', { name: 'Remove' })
    .click()
  await expect(page.getByRole('cell', { name: email })).toHaveCount(0)
})

test('only admins can open the team page', async ({ page }) => {
  await signInAs(page, 'finance@seed.invalid')
  expect((await page.goto('/admin/team'))?.status()).toBe(403)
})
