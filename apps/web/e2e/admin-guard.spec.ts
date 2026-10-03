import { expect, test } from '@playwright/test'
import { makeUser, signInAs } from './helpers'

test.describe.configure({ mode: 'serial' })

const stamp = Date.now()
const people = {
  creator: `guard-creator-${stamp}@example.com`,
  reviewer: `guard-reviewer-${stamp}@example.com`,
  finance: `guard-finance-${stamp}@example.com`,
  admin: `guard-admin-${stamp}@example.com`,
}

const adminPages = ['/admin', '/admin/settings']
const adminApi = [
  '/api/v1/admin/campaigns',
  '/api/v1/admin/ledger',
  '/api/v1/admin/settings',
  '/api/v1/admin/does-not-exist',
]
const methods = ['GET', 'POST', 'PATCH', 'DELETE'] as const

test.beforeAll(async () => {
  await makeUser(people.creator)
  await makeUser(people.reviewer, 'reviewer')
  await makeUser(people.finance, 'finance')
  await makeUser(people.admin, 'admin')
})

test('anonymous visitors are sent to sign in and the API answers 401', async ({
  page,
  request,
}) => {
  for (const path of adminPages) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/sign-in/)
  }
  for (const path of adminApi) {
    for (const method of methods) {
      const res = await request.fetch(path, { method })
      expect(res.status(), `${method} ${path}`).toBe(401)
    }
  }
})

test('a signed in non staff user gets 403 on every admin page and API route', async ({ page }) => {
  await signInAs(page, people.creator)
  for (const path of adminPages) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(403)
    await expect(page.getByRole('heading', { name: 'You do not have access' })).toBeVisible()
  }
  for (const path of adminApi) {
    for (const method of methods) {
      const res = await page.request.fetch(path, { method })
      expect(res.status(), `${method} ${path}`).toBe(403)
    }
  }
})

test('reviewer and finance reach the dashboard but not settings', async ({ page }) => {
  for (const who of [people.reviewer, people.finance]) {
    await page.context().clearCookies()
    await signInAs(page, who)
    expect((await page.goto('/admin'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    expect((await page.goto('/admin/settings'))?.status()).toBe(403)
    // The API lets staff through the guard, then reports the unknown route.
    expect((await page.request.get('/api/v1/admin/does-not-exist')).status()).toBe(404)
  }
})

test('admin reaches settings', async ({ page }) => {
  await signInAs(page, people.admin)
  expect((await page.goto('/admin/settings'))?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
