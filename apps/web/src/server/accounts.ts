import 'server-only'
import { db, tables } from '@mde/db'
import { sql } from 'drizzle-orm'

/**
 * Create the account for an email sign-up, with the time both boxes were ticked. The address is
 * unverified until the magic link is used. An existing account is left unchanged.
 */
export async function createEmailAccount(email: string, consentAt: Date) {
  await db().transaction(async (tx) => {
    const [created] = await tx
      .insert(tables.users)
      .values({ email, isAdultConfirmed: true, adultConfirmedAt: consentAt, termsAcceptedAt: consentAt })
      .onConflictDoNothing()
      .returning({ id: tables.users.id })
    if (created) await tx.insert(tables.creatorProfiles).values({ userId: created.id }).onConflictDoNothing()
  })
}

export async function accountExists(email: string) {
  const rows = await db().execute(sql`select 1 from users where email = ${email}`)
  return rows.length > 0
}
