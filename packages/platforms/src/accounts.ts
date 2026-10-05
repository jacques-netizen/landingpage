// Linking accounts (03_SYSTEMS.md section 2). Bio code now; OAuth adds to the same table.
import { getSettings, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { and, eq, ne, sql } from 'drizzle-orm'
import { bioHasCode, generateBioCode } from './bio-code'
import type { ProviderRouter } from './router'
import { ProviderUnavailable, type Platform } from './types'
import { isValidHandle, normalizeHandle } from './urls'

const { linkedAccounts } = tables

export const CODE_VALID_DAYS = 7

export type AccountErrorCode =
  | 'invalid_handle'
  | 'limit_reached'
  | 'already_added'
  | 'not_found'
  | 'code_expired'
  | 'account_private'
  | 'account_missing'
  | 'code_not_seen'
  | 'linked_elsewhere'
  | 'provider_unavailable'

export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AccountError'
  }
}

export type LinkedAccount = typeof linkedAccounts.$inferSelect

export async function listAccounts(d: DbOrTx, creatorId: string) {
  return d
    .select()
    .from(linkedAccounts)
    .where(and(eq(linkedAccounts.creatorId, creatorId), ne(linkedAccounts.status, 'removed')))
    .orderBy(linkedAccounts.createdAt)
}

async function getOwn(d: DbOrTx, creatorId: string, id: string, lock = false) {
  const q = d
    .select()
    .from(linkedAccounts)
    .where(
      and(eq(linkedAccounts.id, id), eq(linkedAccounts.creatorId, creatorId), ne(linkedAccounts.status, 'removed')),
    )
  const [row] = lock ? await q.for('update') : await q
  if (!row) throw new AccountError('not_found', 'This account is not linked to you.')
  return row
}

const expiry = (now: Date) => new Date(now.getTime() + CODE_VALID_DAYS * 86_400_000)

/** Step 1 and 2 of the bio code method: record the handle and give the creator a code. */
export async function addBioCodeAccount(
  db: Db,
  creatorId: string,
  input: { platform: Platform; handle: string },
  now = new Date(),
): Promise<LinkedAccount> {
  if (!isValidHandle(input.platform, input.handle))
    throw new AccountError('invalid_handle', 'Enter the handle as it appears on your profile, like @yourname.')
  const handle = normalizeHandle(input.handle)
  const s = await getSettings(db)
  return db.transaction(async (tx) => {
    // One creator at a time, so two quick clicks cannot pass the limit together.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'linked_accounts:' + creatorId}))`)
    const current = await listAccounts(tx, creatorId)
    if (current.some((a) => a.platform === input.platform && a.handle === handle))
      throw new AccountError('already_added', 'You have already added this account.')
    if (current.length >= s.max_linked_accounts)
      throw new AccountError(
        'limit_reached',
        `You can link up to ${s.max_linked_accounts} accounts. Remove one to add another.`,
      )
    const [row] = await tx
      .insert(linkedAccounts)
      .values({
        creatorId,
        platform: input.platform,
        handle,
        linkMethod: 'bio_code',
        status: 'pending',
        verificationCode: generateBioCode(s.bio_code_prefix),
        verificationExpiresAt: expiry(now),
      })
      .returning()
    return row!
  })
}

/** A fresh code once the old one has expired. */
export async function renewBioCode(db: Db, creatorId: string, id: string, now = new Date()) {
  const row = await getOwn(db, creatorId, id)
  if (row.status === 'verified') return row
  const { bio_code_prefix } = await getSettings(db)
  const [updated] = await db
    .update(linkedAccounts)
    .set({ verificationCode: generateBioCode(bio_code_prefix), verificationExpiresAt: expiry(now), status: 'pending' })
    .where(eq(linkedAccounts.id, id))
    .returning()
  return updated!
}

/** Steps 3 and 4: look for the code in the public bio. */
export async function verifyBioCode(db: Db, router: ProviderRouter, creatorId: string, id: string, now = new Date()) {
  const row = await getOwn(db, creatorId, id)
  if (row.status === 'verified') return row
  if (!row.verificationCode || !row.verificationExpiresAt || row.verificationExpiresAt <= now)
    throw new AccountError('code_expired', 'This code has expired. Get a new code and put it in your bio.')

  let profile
  try {
    profile = await router.fetchProfile('bio_code', { platform: row.platform as Platform, handle: row.handle })
  } catch (err) {
    if (err instanceof ProviderUnavailable)
      throw new AccountError(
        'provider_unavailable',
        'We could not reach the platform just now. Try again in a few minutes.',
      )
    throw err
  }
  if (!profile) throw new AccountError('account_missing', 'We could not find this account. Check the handle.')
  if (!profile.isPublic)
    throw new AccountError('account_private', 'This account is private. Make it public, then try again.')
  if (!bioHasCode(profile.bio, row.verificationCode))
    throw new AccountError(
      'code_not_seen',
      'We could not see the code yet. It can take a few minutes to show. Try again.',
    )

  const [other] = await db
    .select({ id: linkedAccounts.id, creatorId: linkedAccounts.creatorId })
    .from(linkedAccounts)
    .where(
      and(
        eq(linkedAccounts.platform, row.platform),
        eq(linkedAccounts.platformUserId, profile.platformUserId),
        ne(linkedAccounts.status, 'removed'),
        ne(linkedAccounts.id, row.id),
      ),
    )
  if (other?.creatorId === creatorId)
    throw new AccountError('already_added', 'This account is already linked to you under another handle.')
  if (other) await linkedElsewhere(db, creatorId, row, other.id, profile.platformUserId)

  try {
    const [updated] = await db
      .update(linkedAccounts)
      .set({
        status: 'verified',
        verifiedAt: now,
        platformUserId: profile.platformUserId,
        handle: normalizeHandle(profile.handle),
        followers: profile.followers,
        accountCreatedAt: profile.createdAt,
        lastCheckedAt: now,
        verificationCode: null,
        verificationExpiresAt: null,
      })
      .where(and(eq(linkedAccounts.id, row.id), ne(linkedAccounts.status, 'removed')))
      .returning()
    if (!updated) throw new AccountError('not_found', 'This account is not linked to you.')
    return updated
  } catch (err) {
    // Another creator verified the same platform account at the same moment (unique index).
    const code = (err as { code?: string; cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code
    if (code === '23505') await linkedElsewhere(db, creatorId, row, null, profile.platformUserId)
    throw err
  }
}

const LINKED_ELSEWHERE =
  'This account is already linked to another creator. Our team has been told and will look into it.'

// A platform account belongs to one creator only. The attempt is recorded for staff to follow up
// (03_SYSTEMS.md 2.1, "creates a staff task").
async function linkedElsewhere(
  d: DbOrTx,
  creatorId: string,
  row: LinkedAccount,
  otherId: string | null,
  platformUserId: string,
): Promise<never> {
  await writeAudit(d, {
    actorId: creatorId,
    action: 'linked_account.conflict',
    entity: 'linked_account',
    entityId: row.id,
    after: { platform: row.platform, handle: row.handle, platformUserId, existingAccountId: otherId },
  })
  throw new AccountError('linked_elsewhere', LINKED_ELSEWHERE)
}

export async function removeAccount(db: Db, creatorId: string, id: string) {
  await getOwn(db, creatorId, id)
  await db.update(linkedAccounts).set({ status: 'removed' }).where(eq(linkedAccounts.id, id))
}
