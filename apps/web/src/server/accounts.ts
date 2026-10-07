import 'server-only'
import { env } from '@mde/config'
import { db, tables } from '@mde/db'
import { cookies } from 'next/headers'
import { sql } from 'drizzle-orm'

/** A creator account with a username and password (owner request, 2026-10-07). */
export async function createPasswordAccount(input: {
  email: string
  username: string
  passwordHash: string
  discordUsername: string | null
  consentAt: Date
}): Promise<{ id: string } | { taken: 'email' | 'username' }> {
  return db().transaction(async (tx) => {
    const [clash] = await tx.execute<{ email: boolean }>(
      sql`select email = ${input.email} as email from users where email = ${input.email} or username = ${input.username} limit 1`,
    )
    if (clash) return { taken: clash.email ? 'email' : 'username' }
    const [created] = await tx
      .insert(tables.users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash: input.passwordHash,
        discordUsername: input.discordUsername,
        termsAcceptedAt: input.consentAt,
      })
      .onConflictDoNothing()
      .returning({ id: tables.users.id })
    if (!created) return { taken: 'email' }
    await tx.insert(tables.creatorProfiles).values({ userId: created.id }).onConflictDoNothing()
    return { id: created.id }
  })
}

/** The account a username or email signs in to. */
export async function findAccount(identifier: string) {
  const v = identifier.trim().replace(/^@/, '')
  if (!v) return null
  const [u] = await db()
    .select({
      id: tables.users.id,
      email: tables.users.email,
      passwordHash: tables.users.passwordHash,
      status: tables.users.status,
    })
    .from(tables.users)
    .where(v.includes('@') ? sql`email = ${v}` : sql`username = ${v}`)
  return u ?? null
}

/** An emailed code proved the inbox: the address counts as proven from now on. */
export async function provenEmail(userId: string) {
  await db()
    .update(tables.users)
    .set({ emailVerified: new Date() })
    .where(sql`id = ${userId} and email_verified_at is null`)
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
