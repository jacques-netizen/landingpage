import { expect, test } from '@playwright/test'
import { signUpNewCreator } from './helpers'

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test('a creator sets a username, Discord name and picture, and Home greets them by username', async ({ page }) => {
  await signUpNewCreator(page)
  const name = `pic${Date.now() % 1e8}`
  await page.goto('/profile')
  await page.getByLabel('Username', { exact: true }).fill(name)
  await page.getByLabel('Discord username (optional)').fill('@kymen#1')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Profile saved.')).toBeVisible()

  await page
    .getByLabel('Choose a profile picture')
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('button', { name: 'Change picture' })).toBeVisible()

  // A file that only claims to be a picture is refused.
  const res = await page.request.post('/api/profile/avatar', {
    data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    headers: { 'content-type': 'image/png' },
  })
  expect(res.status()).toBe(400)

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: `Welcome back, ${name}` })).toBeVisible()
  await expect(page.locator('section[aria-label="Profile"] img[src^="/files/"]')).toBeVisible()
  await expect(page.getByText('Join a campaign to get started')).toBeVisible()
})

test('the Support page tells creators to open a Discord ticket', async ({ page }) => {
  // The menu's Support goes to the Discord server when SUPPORT_DISCORD_URL is set, otherwise here.
  await page.goto('/campaigns')
  await page.getByRole('link', { name: 'Support', exact: true }).first().click()
  await page.waitForURL('**/help')
  await expect(page.getByRole('heading', { name: 'Stuck? Open a ticket in our Discord.' })).toBeVisible()
})
