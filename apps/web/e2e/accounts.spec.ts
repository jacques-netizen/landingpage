import { expect, test } from '@playwright/test'
import { writeMockState } from '@mde/platforms'
import { signUpNewCreator } from './helpers'

// Phase 3 acceptance: a creator links an account by bio code (with the mock provider).
test('a creator links an account by bio code', async ({ page }) => {
  await signUpNewCreator(page)
  await page.goto('/accounts')
  await expect(page.getByText('No accounts linked yet.')).toBeVisible()

  const handle = `maya${Date.now() % 1e8}`
  await page
    .getByRole('radio', { name: 'TikTok' })
    .or(page.getByRole('button', { name: 'TikTok' }))
    .first()
    .click()
  await page.getByLabel('Handle').fill(`@${handle}`)
  await page.getByRole('button', { name: 'Get a code' }).click()
  await expect(page.getByText('Waiting for the code')).toBeVisible()
  const code = (await page.getByText(/^MDE-[A-Z0-9]{4}$/).textContent())!.trim()

  // Not in the bio yet.
  writeMockState({ profiles: { [`tiktok:${handle}`]: { bio: 'daily clips', followers: 12400 } } })
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText('We could not see the code yet.')).toBeVisible()

  writeMockState({ profiles: { [`tiktok:${handle}`]: { bio: `daily clips ${code}`, followers: 12400 } } })
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()
  await expect(page.getByText('12,400')).toBeVisible()

  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByRole('button', { name: 'Remove account' }).click()
  await expect(page.getByText('No accounts linked yet.')).toBeVisible()
})
