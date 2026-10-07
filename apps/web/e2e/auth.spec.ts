import { expect, test, type Page } from '@playwright/test'
import { latestLink, mailsTo } from './outbox'

// Phase 0 acceptance: sign up, sign in and sign out by email magic link; non-staff get 403 on
// every staff page and staff API route. Google and Discord need real OAuth credentials and are
// covered by the provider configuration test below.

const unique = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`

async function requestLink(page: Page, mode: 'sign-in' | 'sign-up', email: string) {
  await page.goto(`/${mode}`)
  if (mode === 'sign-up') {
    await page.getByRole('checkbox', { name: 'I agree to the terms of use and the privacy policy.' }).check()
  }
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: mode === 'sign-up' ? 'Create account' : 'Email me a sign-in link' }).click()
  await page.waitForURL('**/check-email')
}

/** A new address is signed in at once and lands on the campaigns screen (testing report item 2). */
async function signUp(page: Page, email: string) {
  await page.context().clearCookies()
  await page.goto('/sign-up')
  await page.getByRole('checkbox', { name: 'I agree to the terms of use and the privacy policy.' }).check()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL((u) => u.pathname === '/campaigns')
}

async function signInAs(page: Page, email: string) {
  await requestLink(page, 'sign-in', email)
  await page.goto(await latestLink(email))
  await page.waitForLoadState('networkidle')
}

async function sessionEmail(page: Page) {
  const s = (await (await page.request.get('/api/auth/session')).json()) as { user?: { email?: string } } | null
  return s?.user?.email ?? null
}

test('sign up needs the terms tick, then signs in at once, and sign out ends the session', async ({ page }) => {
  const email = unique('creator')
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Tick to agree to the terms of use and the privacy policy.')).toBeVisible()
  expect(mailsTo(email)).toHaveLength(0)

  await signUp(page, email)
  expect(await sessionEmail(page)).toBe(email)
  // Signed in, the home address opens the campaigns screen.
  await page.goto('/')
  expect(new URL(page.url()).pathname).toBe('/campaigns')

  await page.goto('/sign-out')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL((u) => u.pathname === '/')
  expect(await sessionEmail(page)).toBeNull()

  // Sign in again with the same address: the link lands on the campaigns screen.
  await signInAs(page, email)
  expect(new URL(page.url()).pathname).toBe('/campaigns')
  expect(await sessionEmail(page)).toBe(email)
})

test('signing up with an address that has an account sends a link and signs nobody in', async ({ page }) => {
  const email = unique('again')
  await signUp(page, email)
  await page.context().clearCookies()
  await requestLink(page, 'sign-up', email)
  expect(mailsTo(email).pop()!.subject).toBe('Your sign-in link')
  expect(await sessionEmail(page)).toBeNull()
})

test('the first email link ends sessions started before the address was proven', async ({ browser }) => {
  const email = unique('proven')
  const early = await browser.newPage()
  await signUp(early, email)
  expect(await sessionEmail(early)).toBe(email)

  const owner = await browser.newPage()
  await signInAs(owner, email)
  expect(await sessionEmail(owner)).toBe(email)
  expect(await sessionEmail(early)).toBeNull()
  await early.close()
  await owner.close()
})

test('a magic link works once', async ({ page }) => {
  const email = unique('once')
  await signUp(page, email)
  await page.context().clearCookies()
  await requestLink(page, 'sign-in', email)
  const link = await latestLink(email)
  await page.goto(link)
  await page.waitForLoadState('networkidle')
  await page.context().clearCookies()
  await page.goto(link)
  await expect(page.getByText('This link has expired or was already used.')).toBeVisible()
})

test('signing in with an unknown address does not reveal it and creates no account', async ({ page }) => {
  const email = unique('unknown')
  await requestLink(page, 'sign-in', email)
  const mail = mailsTo(email).pop()!
  expect(mail.text).toContain('there is no account for it yet')
  expect(await sessionEmail(page)).toBeNull()
})

test('the email field explains a bad address', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('name@')
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByText('Enter an email address, like name@example.com.')).toBeVisible()
})

const ADMIN_PAGES = ['/admin', '/admin/campaigns', '/admin/review', '/admin/settings', '/admin/anything/else']
const ADMIN_API = ['/api/v1/admin', '/api/v1/admin/me', '/api/v1/admin/campaigns', '/api/v1/admin/settings']

test('signed-out visitors are sent to the staff sign in and get 401 from the staff API', async ({ page }) => {
  for (const path of ADMIN_PAGES) {
    await page.goto(path)
    expect(new URL(page.url()).pathname).toBe('/staff/sign-in')
  }
  for (const path of ADMIN_API) {
    for (const method of ['GET', 'POST'] as const) {
      const res = await page.request.fetch(path, { method })
      expect(res.status(), `${method} ${path}`).toBe(401)
    }
  }
})

test('a non-staff user gets 403 on every staff page and staff API route', async ({ page }) => {
  await signUp(page, unique('nonstaff'))
  for (const path of ADMIN_PAGES) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(403)
    await expect(page.getByRole('heading', { name: 'You do not have access to this page.' })).toBeVisible()
  }
  for (const path of ADMIN_API) {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
      const res = await page.request.fetch(path, { method })
      expect(res.status(), `${method} ${path}`).toBe(403)
      expect(await res.json()).toEqual({ error: { code: 'forbidden', message: 'You do not have access to this.' } })
    }
  }
})

test('each staff role can open the staff pages', async ({ page }) => {
  for (const role of ['reviewer', 'finance', 'admin']) {
    await page.context().clearCookies()
    await signInAs(page, `${role}@seed.invalid`)
    const res = await page.goto('/admin')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    const me = await page.request.get('/api/v1/admin/me')
    expect(me.status()).toBe(200)
    expect(((await me.json()) as { roles: string[] }).roles).toEqual([role])
  }
})
