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

test('an admin changes the featured campaign and its words, and the campaigns screen shows it', async ({ page }) => {
  const [before] = await sql`select value from settings where key = 'content.browse'`
  try {
    await signInAs(page, 'admin@seed.invalid')
    await page.goto('/admin/featured')
    await page.getByLabel('Campaign').click()
    await page.getByRole('option', { name: 'Sample music', exact: true }).click()
    await page.getByLabel('Headline (optional)').fill('New music push')
    await page.getByLabel('Text (optional)').fill('Use the sound in your next clip.')
    await page.getByRole('button', { name: 'Save featured campaign' }).click()
    await expect(page.getByText('Saved. The campaigns screen shows it now.')).toBeVisible()

    await page.goto('/campaigns')
    await expect(page.getByText('New music push')).toBeVisible()
    await expect(page.getByText('Use the sound in your next clip.')).toBeVisible()
    const [audit] = await sql`select action from audit_log where entity = 'settings' order by id desc limit 1`
    expect(audit).toBeTruthy()
  } finally {
    // Put the seeded featured campaign back so later screens are unchanged.
    if (before) await sql`update settings set value = ${sql.json(before.value)} where key = 'content.browse'`
  }
})

test('kymencarter@gmail.com is an admin', async () => {
  const rows =
    await sql`select r.role from staff_roles r join users u on u.id = r.user_id where u.email = 'kymencarter@gmail.com'`
  expect(rows.map((r) => r.role)).toContain('admin')
})
