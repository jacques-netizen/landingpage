import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

async function newCreator(tag: string) {
  const email = `${tag}-${Date.now()}@test.invalid`
  const [u] =
    await sql`insert into users (email, display_name) values (${email}, ${`${tag} ${Date.now()}`}) returning id, display_name`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  return { id: u!.id as string, name: u!.display_name as string, email }
}

async function warn(page: import('@playwright/test').Page, label: string) {
  await page.getByLabel('Reason').first().click()
  // The list is longer than the window; pick with the keyboard, as a keyboard user would.
  await page.getByRole('option', { name: label, exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Reason').first()).toContainText(label)
  await page.getByRole('button', { name: 'Send warning' }).click()
}

test('a reviewer finds a creator, warns them, and is told to consider suspension at 3 strikes', async ({ page }) => {
  const c = await newCreator('warned')
  const [reason] = await sql`select label from reason_codes where code = 'suspected_view_inflation'`
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/creators')
  await page.getByLabel('Search creators').fill(c.email)
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('link', { name: c.name }).click()
  await expect(page.getByRole('heading', { name: c.name })).toBeVisible()
  for (const section of ['Earnings', 'Accounts', 'Submissions', 'Warnings', 'Notes'])
    await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()
  // Reviewers can warn but not suspend.
  await expect(page.getByRole('button', { name: 'Suspend' })).toHaveCount(0)

  await warn(page, reason!.label as string)
  await expect(page.getByText('Warning sent. 1 active strike.')).toBeVisible()
  await warn(page, reason!.label as string)
  await expect(page.getByText('Warning sent. 2 active strikes.')).toBeVisible()
  await warn(page, reason!.label as string)
  await expect(page.getByText('3 active strikes: consider suspending this creator.')).toBeVisible()
  const [p] = await sql`select strikes_active from creator_profiles where user_id = ${c.id}`
  expect(p!.strikes_active).toBe(3)
  const [n] =
    await sql`select count(*)::int as n from notifications where user_id = ${c.id} and kind = 'warning_issued'`
  expect(n!.n).toBe(3)
})

test('an admin suspends and restores a creator with a reason, and staff keep notes', async ({ page }) => {
  const c = await newCreator('suspended')
  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/creators/${c.id}`)
  await page.getByRole('button', { name: 'Suspend' }).click()
  await expect(page.getByText('Write the reason. It is kept in the audit log.')).toBeVisible()
  await page.getByLabel('Reason', { exact: true }).last().fill('Repeated view inflation.')
  await page.getByRole('button', { name: 'Suspend' }).click()
  await expect(page.getByText('Suspended. They cannot submit posts or withdraw.')).toBeVisible()
  expect((await sql`select status from users where id = ${c.id}`)[0]!.status).toBe('suspended')

  await page.reload()
  await page.getByLabel('Reason', { exact: true }).last().fill('Spoke with the creator.')
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Restored.')).toBeVisible()
  expect((await sql`select status from users where id = ${c.id}`)[0]!.status).toBe('active')
  const audits = await sql`select action from audit_log where entity_id = ${c.id} order by created_at`
  expect(audits.map((a) => a.action)).toEqual(['user.suspend', 'user.restore'])

  await page.getByLabel('Staff notes').fill('Prefers email.')
  await page.getByRole('button', { name: 'Save notes' }).click()
  await expect(page.getByText('Notes saved.')).toBeVisible()
  expect((await sql`select staff_notes from creator_profiles where user_id = ${c.id}`)[0]!.staff_notes).toBe(
    'Prefers email.',
  )
})
