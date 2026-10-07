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

test('the campaigns screen also shows past campaigns', async ({ page }) => {
  const past = await sql`select title from campaigns where visibility = 'public' and status in ('closing', 'closed')`
  await page.goto('/campaigns')
  if (past.length === 0) {
    await expect(page.getByText('Past campaigns', { exact: true })).toHaveCount(0)
    return
  }
  await expect(page.getByText('Past campaigns', { exact: true })).toBeVisible()
  await expect(page.getByText(past[0]!.title as string, { exact: true }).first()).toBeVisible()
})

test('an admin raises and lowers the budget of a live campaign', async ({ page }) => {
  const [c] = await sql`select id, budget_cents from campaigns where title = 'Sample logo'`
  const left = async () =>
    Number(
      (
        await sql`select coalesce(sum(e.amount_cents), 0)::bigint as b from ledger_entries e
          join ledger_accounts a on a.id = e.account_id where a.kind = 'campaign_budget' and a.owner_id = ${c!.id}`
      )[0]!.b,
    )
  const before = await left()
  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}?tab=edit`)
  const budget = page.getByLabel('Budget', { exact: true })
  await expect(budget).toBeEditable()
  await budget.fill(String(Number(c!.budget_cents) / 100 + 500))
  await page.getByRole('button', { name: /^Save/ }).first().click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  expect(await left()).toBe(before + 50_000)

  await page.reload()
  await page.getByLabel('Budget', { exact: true }).fill(String(Number(c!.budget_cents) / 100))
  await page.getByRole('button', { name: /^Save/ }).first().click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  expect(await left()).toBe(before)
  const [after] = await sql`select budget_cents from campaigns where id = ${c!.id}`
  expect(Number(after!.budget_cents)).toBe(Number(c!.budget_cents))
})
