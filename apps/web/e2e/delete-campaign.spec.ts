import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(async () => {
  await sql.end()
})

test('an admin deletes a draft campaign, and it is gone', async ({ page }) => {
  const [c] = await sql`select id, title from campaigns where title = 'Seed draft campaign'`
  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Delete campaign' }).click()
  await expect(page.getByText('It is removed completely. This cannot be undone.')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete campaign' }).click()
  await page.waitForURL('**/admin/campaigns?deleted=removed')
  await expect(page.getByText('Campaign deleted.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: c!.title as string })).toHaveCount(0)
  expect(await sql`select id from campaigns where id = ${c!.id}`).toHaveLength(0)
})

test('only admins see Delete campaign', async ({ page }) => {
  const [c] = await sql`select id from campaigns where title = 'Sample music'`
  await signInAs(page, 'finance@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}`)
  await expect(page.getByRole('button', { name: 'Delete campaign' })).toHaveCount(0)
})
