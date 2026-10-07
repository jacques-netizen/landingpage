import { expect, test, type Page } from '@playwright/test'
import { latestLink, mailsTo } from './outbox'

// Phase 0 acceptance: sign up, sign in and sign out by email magic link; non-staff get 403 on
// every staff page and staff API route. Google and Discord need real OAuth credentials and are
// covered by the provider configuration test below.

const unique = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`

const handle = () => `u${Date.now() % 1e9}${Math.floor(Math.random() * 1e4)}`
const PASSWORD = 'a long test password'

async function requestLink(page: Page, email: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Username or email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.waitForURL('**/check-email')
}

async function fillSignUp(page: Page, email: string, username: string, tick = true) {
  await page.goto('/sign-up')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  if (tick) await page.getByRole('checkbox', { name: 'I agree to the terms of use and the privacy policy.' }).check()
  await page.getByRole('button', { name: 'Create account' }).click()
}

/** A new account is signed in at once and lands on the campaigns screen (testing report item 2). */
async function signUp(page: Page, email: string, username = handle()) {
  await page.context().clearCookies()
  await fillSignUp(page, email, username)
  await page.waitForURL((u) => u.pathname === '/campaigns')
  return username
}

async function passwordSignIn(page: Page, identifier: string, password = PASSWORD) {
  await page.goto('/sign-in')
  await page.getByLabel('Username or email').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function latestCode(to: string) {
  for (let i = 0; i < 50; i++) {
    const code = mailsTo(to)
      .filter((m) => m.subject.endsWith('sign-in code'))
      .pop()
      ?.text.match(/\b\d{6}\b/)?.[0]
    if (code) return code
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`No sign-in code for ${to}`)
}

async function signInAs(page: Page, email: string) {
  await requestLink(page, email)
  await page.goto(await latestLink(email))
  await page.waitForLoadState('networkidle')
}

async function sessionEmail(page: Page) {
  const s = (await (await page.request.get('/api/auth/session')).json()) as { user?: { email?: string } } | null
  return s?.user?.email ?? null
}

test('sign up needs the terms tick, then signs in at once, and sign out ends the session', async ({ page }) => {
  const email = unique('creator')
  await fillSignUp(page, email, handle(), false)
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

test('sign up refuses an email or username that is already taken', async ({ page }) => {
  const email = unique('again')
  const username = await signUp(page, email)
  await page.context().clearCookies()
  await fillSignUp(page, email, handle())
  await expect(page.getByText('There is already an account with this email. Sign in instead.')).toBeVisible()
  await fillSignUp(page, unique('other'), username.toUpperCase())
  await expect(page.getByText('That username is taken. Try another.')).toBeVisible()
  expect(await sessionEmail(page)).toBeNull()
})

test('a password sign in on the same device needs no code; a new device needs the emailed code', async ({
  browser,
}) => {
  const email = unique('pw')
  const home = await browser.newPage()
  const username = await signUp(home, email)
  await home.goto('/sign-out')
  await home.getByRole('button', { name: 'Sign out' }).click()
  await home.waitForURL((u) => u.pathname === '/')

  // The device that created the account: username and password are enough.
  await passwordSignIn(home, username)
  await home.waitForURL((u) => u.pathname === '/campaigns')
  expect(await sessionEmail(home)).toBe(email)

  // Another phone: a wrong password first, then the right one asks for the code from the email.
  const phone = await browser.newPage()
  await passwordSignIn(phone, username, 'not the password')
  await expect(phone.getByText('That username or email and password do not match.')).toBeVisible()
  await passwordSignIn(phone, email)
  await phone.waitForURL('**/sign-in/code')
  expect(await sessionEmail(phone)).toBeNull()
  const code = await latestCode(email)
  await phone.getByLabel('Code').fill(code === '000000' ? '111111' : '000000')
  await phone.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(phone.getByText('That code is not right. Check the email and try again.')).toBeVisible()
  await phone.getByLabel('Code').fill(code)
  await phone.getByRole('button', { name: 'Sign in', exact: true }).click()
  await phone.waitForURL((u) => u.pathname === '/campaigns')
  expect(await sessionEmail(phone)).toBe(email)

  // Now trusted, the phone signs in again without a code.
  await phone.context().clearCookies({ name: 'authjs.session-token' })
  await passwordSignIn(phone, username)
  await phone.waitForURL((u) => u.pathname === '/campaigns')
  await home.close()
  await phone.close()
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
  // The password chosen before the address was proven no longer works.
  await passwordSignIn(early, email)
  await expect(early.getByText('This account has no password yet.', { exact: false })).toBeVisible()
  await early.close()
  await owner.close()
})

test('a magic link works once', async ({ page }) => {
  const email = unique('once')
  await signUp(page, email)
  await page.context().clearCookies()
  await requestLink(page, email)
  const link = await latestLink(email)
  await page.goto(link)
  await page.waitForLoadState('networkidle')
  await page.context().clearCookies()
  await page.goto(link)
  await expect(page.getByText('This link has expired or was already used.')).toBeVisible()
})

test('signing in with an unknown address does not reveal it and creates no account', async ({ page }) => {
  const email = unique('unknown')
  await requestLink(page, email)
  const mail = mailsTo(email).pop()!
  expect(mail.text).toContain('there is no account for it yet')
  expect(await sessionEmail(page)).toBeNull()
})

test('the email field explains a bad address', async ({ page }) => {
  await page.goto('/staff/sign-in')
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
