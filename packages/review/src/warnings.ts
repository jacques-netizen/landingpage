// Warnings, strikes and suspension (03_SYSTEMS.md section 8). A warning counts as a strike for
// strike_days. At 3 active strikes the system suggests suspension; it never suspends by itself.
import { getSettings, notify, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { ReviewError } from './errors'

const { warnings, users, creatorProfiles, reasonCodes } = tables

export const SUSPENSION_SUGGESTED_AT = 3

export async function activeStrikes(d: DbOrTx, creatorId: string, now = new Date()) {
  const [r] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(warnings)
    .where(and(eq(warnings.creatorId, creatorId), or(isNull(warnings.expiresAt), gt(warnings.expiresAt, now))))
  return r!.n
}

/** Keep the strike count on the creator's profile in step with their active warnings. */
export async function syncStrikes(d: DbOrTx, creatorId: string, now = new Date()) {
  const n = await activeStrikes(d, creatorId, now)
  await d.update(creatorProfiles).set({ strikesActive: n }).where(eq(creatorProfiles.userId, creatorId))
  return n
}

export async function issueWarning(
  db: Db,
  staffId: string,
  creatorId: string,
  input: { reasonCode: string; note?: string | null; submissionId?: string | null },
  now = new Date(),
) {
  const { strike_days } = await getSettings(db)
  const [reason] = await db.select().from(reasonCodes).where(eq(reasonCodes.code, input.reasonCode))
  if (!reason) throw new ReviewError('reason_required', 'Choose a reason from the list.')
  return db.transaction(async (tx) => {
    const [w] = await tx
      .insert(warnings)
      .values({
        creatorId,
        reasonCode: input.reasonCode,
        note: input.note?.trim() || null,
        submissionId: input.submissionId ?? null,
        expiresAt: new Date(now.getTime() + strike_days * 86_400_000),
        createdBy: staffId,
      })
      .returning()
    const strikes = await syncStrikes(tx, creatorId, now)
    await writeAudit(tx, {
      actorId: staffId,
      action: 'warning.issue',
      entity: 'user',
      entityId: creatorId,
      after: { warningId: w!.id, reasonCode: input.reasonCode, strikes },
    })
    await notify(tx, creatorId, 'warning_issued', {
      title: 'You received a warning',
      body: [reason.creatorMessage, input.note?.trim()].filter(Boolean).join(' '),
      link: '/submissions',
    })
    return { warning: w!, strikes, suggestSuspension: strikes >= SUSPENSION_SUGGESTED_AT }
  })
}

/** Clear the strikes that came from one post (an overturned appeal). */
export async function clearWarningsFor(d: DbOrTx, submissionId: string, now = new Date()) {
  const rows = await d
    .update(warnings)
    .set({ expiresAt: now })
    .where(and(eq(warnings.submissionId, submissionId), or(isNull(warnings.expiresAt), gt(warnings.expiresAt, now))))
    .returning({ creatorId: warnings.creatorId })
  for (const creatorId of new Set(rows.map((r) => r.creatorId))) await syncStrikes(d, creatorId, now)
  return rows.length
}

/** Suspension blocks new submissions and withdrawals. Pending earnings are kept. Admin only, with a reason. */
export async function setSuspended(db: Db, adminId: string, creatorId: string, suspended: boolean, reason: string) {
  const text = reason.trim()
  if (!text) throw new ReviewError('note_required', 'Write the reason. It is kept in the audit log.')
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, creatorId)).for('update')
    if (!u) throw new ReviewError('not_found', 'This creator does not exist.')
    const status = suspended ? 'suspended' : 'active'
    if (u.status === 'closed') throw new ReviewError('wrong_state', 'This account is closed.')
    await tx.update(users).set({ status }).where(eq(users.id, creatorId))
    await writeAudit(tx, {
      actorId: adminId,
      action: suspended ? 'user.suspend' : 'user.restore',
      entity: 'user',
      entityId: creatorId,
      before: { status: u.status },
      after: { status, reason: text },
    })
  })
}

/** The strike-expiry job: recount strikes for creators whose warnings have run out. */
export async function expireStrikes(db: Db, now = new Date()) {
  const stale = await db
    .select({ id: creatorProfiles.userId })
    .from(creatorProfiles)
    .where(gt(creatorProfiles.strikesActive, 0))
  let changed = 0
  for (const { id } of stale) {
    const before = (await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, id)))[0]!.strikesActive
    if ((await syncStrikes(db, id, now)) !== before) changed++
  }
  return { checked: stale.length, changed }
}
