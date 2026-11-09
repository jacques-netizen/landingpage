import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

// The admin's Change log (owner, 2026-11-09): code changes with who asked and who made them, deploys,
// and staff actions on live data.
test('an admin reads the change log: code changes, deploys and staff actions', async ({ page }) => {
  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin')
  await page.getByRole('link', { name: 'Change log' }).click()
  await expect(page.getByRole('heading', { name: 'Change log' })).toBeVisible()
  const code = page.getByRole('table', { name: 'Code changes' })
  await expect(code.getByRole('columnheader', { name: 'Requested by' })).toBeVisible()
  await expect(
    code
      .getByText('Clippers stop earning once the client’s budget is used up')
      .or(code.getByText("Clippers stop earning once the client's budget is used up")),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Deploys' }).click()
  await expect(
    page.getByText('No deploys recorded yet.').or(page.getByRole('table', { name: 'Deploys' })),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Staff actions' }).click()
  const staff = page.getByRole('table', { name: 'Staff actions' })
  await expect(staff.getByRole('row').nth(1)).toBeVisible()

  // The old audit log address leads to the same place.
  await page.goto('/admin/audit-log')
  await expect(page).toHaveURL(/\/admin\/changes\?tab=staff/)
})
