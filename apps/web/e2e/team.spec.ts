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

test('staff upload a large video for the brand site, and it plays in pieces like browsers ask', async ({ page }) => {
  await signInAs(page, 'admin@seed.invalid')
  const big = Buffer.alloc(12 * 1024 * 1024, 7)
  const res = await page.request.post('/api/admin/uploads', {
    data: big,
    headers: { 'x-file-name': 'case-study.mp4', 'content-type': 'video/mp4' },
  })
  expect(res.status()).toBe(200)
  const { url } = (await res.json()) as { url: string }
  const part = await page.request.get(url, { headers: { range: 'bytes=0-99' } })
  expect(part.status()).toBe(206)
  expect(part.headers()['content-range']).toBe(`bytes 0-99/${big.length}`)
  expect((await page.request.get(url)).headers()['content-length']).toBe(String(big.length))

  await page.goto('/admin/brand-site')
  await expect(page.getByRole('heading', { name: 'Brand site' })).toBeVisible()
  await page.getByLabel('Walmart: case study video link').fill(url)
  await page.getByRole('button', { name: 'Save brand site' }).click()
  await expect(page.getByText('Saved. The brand site shows the new videos now.')).toBeVisible()
  await page.goto('/brands')
  await expect(page.locator(`video[src="${url}"]`).first()).toBeAttached()
})
