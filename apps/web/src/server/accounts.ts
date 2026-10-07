import 'server-only'
import { env } from '@mde/config'
import { db, tables } from '@mde/db'
import { cookies } from 'next/headers'
import { sql } from 'drizzle-orm'

/**
 * Create the account for an email sign-up, with the time both boxes were ticked. An existing account
 * is left unchanged. Returns the new account's id, or null when the address already had one.
 */
export async function createEmailAccount(email: string, consentAt: Date): Promise<string | null> {
  return db().transaction(async (tx) => {
    const [created] = await tx
      .insert(tables.users)
      .values({ email, isAdultConfirmed: true, adultConfirmedAt: consentAt, termsAcceptedAt: consentAt })
      .onConflictDoNothing()
      .returning({ id: tables.users.id })
    if (created) await tx.insert(tables.creatorProfiles).values({ userId: created.id }).onConflictDoNothing()
    return created?.id ?? null
  })
}

export const SESSION_DAYS = 90

/**
 * Signs a brand new account straight in (testing report item 2): the same database session Auth.js
 * creates after an email link, set as its cookie. Only ever for an account created this moment.
 */
export async function startSessionFor(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await db().insert(tables.sessions).values({ sessionToken: token, userId, expires })
  const secure = env().APP_URL.startsWith('https://')
  ;(await cookies()).set(secure ? '__Secure-authjs.session-token' : 'authjs.session-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires,
  })
}

export async function accountExists(email: string) {
  const rows = await db().execute(sql`select 1 from users where email = ${email}`)
  return rows.length > 0
}
