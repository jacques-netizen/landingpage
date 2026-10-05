import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { readyCreator, scriptPost, signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

test('the submissions table lists every post, filters by state, and opens the detail drawer', async ({ page }) => {
  const { handle } = await readyCreator(page, sql)
  for (const caption of ['Good one #ad', 'Forgot it']) {
    await page.getByLabel('Link to your post').fill(scriptPost(handle, caption))
    await page.getByRole('button', { name: 'Submit post' }).click()
    await expect(page.getByText(/^(Submitted|Not accepted)\.$/)).toBeVisible()
  }

  await page.goto('/submissions')
  const rows = page.getByRole('row')
  await expect(rows).toHaveCount(3) // header and two posts
  const table = page.getByLabel('Your submissions')
  await expect(table.getByText('In review', { exact: true })).toBeVisible()
  await expect(table.getByText('A required hashtag is missing.')).toBeVisible()

  await page.getByRole('link', { name: 'Rejected' }).click()
  await expect(page).toHaveURL(/state=rejected/)
  await expect(rows).toHaveCount(2)

  await page.getByRole('button', { name: 'Sample music' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', { name: 'Automatic checks' })).toBeVisible()
  await expect(drawer.getByText('Views over time')).toBeVisible()
  await expect(drawer.getByText('Rejected by the automatic checks: A required hashtag is missing.')).toBeVisible()
  await expect(drawer.getByText(/Last updated/)).toBeVisible()

  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Paid out' }).click()
  await expect(page.getByText('Nothing paid out.')).toBeVisible()
})

test('an admin rewords a reason code; a reviewer cannot open settings', async ({ page }) => {
  await signInAs(page, 'reviewer@seed.invalid')
  expect((await page.goto('/admin/settings'))?.status()).toBe(403)

  await page.context().clearCookies()
  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/settings')
  const message = page.getByLabel('Creator message for missing_audio')
  const original = await message.inputValue()
  try {
    await message.fill('Use the campaign sound, loud enough to hear.')
    await message.locator('xpath=ancestor::form').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()
    const [row] = await sql`select creator_message from reason_codes where code = 'missing_audio'`
    expect(row!.creator_message).toBe('Use the campaign sound, loud enough to hear.')
    const [audit] = await sql`select action from audit_log where entity_id = 'missing_audio' order by id desc limit 1`
    expect(audit!.action).toBe('reason_code.update')
  } finally {
    await sql`update reason_codes set creator_message = ${original} where code = 'missing_audio'`
  }
})
