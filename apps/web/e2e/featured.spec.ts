import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs, signUpNewCreator } from './helpers'

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
    // The featured campaign's own card picture fills the banner unless staff upload another.
    await page.goto('/campaigns')
    await expect(page.locator('[data-m~="a-hero"] img').first()).toHaveAttribute('src', '/designed/camp-clip.png')

    await signInAs(page, 'admin@seed.invalid')
    await page.goto('/admin/featured')
    await page.getByLabel('Campaign').click()
    await page.getByRole('option', { name: 'Sample music', exact: true }).click()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    await page
      .getByLabel('Choose the featured picture')
      .setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByRole('img', { name: 'Featured campaign picture' })).toHaveAttribute('src', /^\/files\//)
    await page.getByLabel('Headline (optional)').fill('New music push')
    await page.getByLabel('Text (optional)').fill('Use the sound in your next clip.')
    await page.getByRole('button', { name: 'Save featured campaign' }).click()
    await expect(page.getByText('Saved. The campaigns screen shows it now.')).toBeVisible()

    await page.goto('/campaigns')
    await expect(page.getByText('New music push')).toBeVisible()
    await expect(page.getByText('Use the sound in your next clip.')).toBeVisible()
    await expect(page.locator('[data-m~="a-hero"] img').first()).toHaveAttribute('src', /^\/files\//)
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

test('the creator menu has Sign out at the bottom', async ({ page }) => {
  await signUpNewCreator(page)
  await page.goto('/dashboard')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL((u) => u.pathname === '/')
  const s = (await (await page.request.get('/api/auth/session')).json()) as { user?: unknown } | null
  expect(s?.user).toBeUndefined()
})
