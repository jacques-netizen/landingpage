import { readFileSync } from 'node:fs'
import postgres from 'postgres'

export const TEST_DB =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'

/** Latest sign in link sent to an address, read from the dev outbox. */
export async function latestLink(to: string, timeoutMs = 10_000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const lines = readFileSync('/tmp/mde-e2e-outbox.jsonl', 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
      const mails = lines
        .map((l) => JSON.parse(l) as { to: string; text: string })
        .filter((m) => m.to === to)
      const last = mails.at(-1)
      const url = last?.text.match(/https?:\/\/\S+/)?.[0]
      if (url) return url
    } catch {
      // file not written yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`No email for ${to}`)
}

export function sql() {
  return postgres(TEST_DB, { max: 1, onnotice: () => {} })
}

import type { Page } from '@playwright/test'

/** Creates a confirmed user (and optional staff role) directly in the test database. */
export async function makeUser(email: string, role?: 'reviewer' | 'finance' | 'admin') {
  const db = sql()
  const [u] = await db`
    insert into users (email, is_adult_confirmed, adult_confirmed_at, terms_accepted_at)
    values (${email}, true, now(), now()) returning id`
  if (role) await db`insert into staff_roles (user_id, role) values (${u!.id}, ${role})`
  await db.end()
}

/** Signs in through the real form and the emailed link. */
export async function signInAs(page: Page, email: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  await page.goto(await latestLink(email))
  await page.getByRole('heading', { name: 'You are signed in' }).waitFor()
}
