// Appeals (03_SYSTEMS.md section 7). One per submission, on rejected, rejected by the checks, or
// removed posts. Staff reply within appeal_reply_business_days; overturning restores the post so the
// next view check pays it, and clears the strike it caused.
import { getSettings, notify, tables, writeAudit, type Db } from '@mde/db'
import { eq, inArray } from 'drizzle-orm'
import { addBusinessDays } from './business-days'
import { ReviewError } from './errors'
import { clearWarningsFor } from './warnings'

const { appeals, submissions, reviewDecisions, staffRoles } = tables

export const APPEALABLE = ['rejected', 'rejected_auto', 'removed']

export async function openAppeal(
  db: Db,
  creatorId: string,
  submissionId: string,
  input: { message: string; links?: string[] },
  now = new Date(),
) {
  const message = input.message.trim()
  if (!message) throw new ReviewError('note_required', 'Tell us why the decision should change.')
  if (message.length > 1000) throw new ReviewError('note_required', 'Keep the message to 1,000 characters.')
  const links = (input.links ?? [])
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\//.test(l))
    .slice(0, 5)
  const { appeal_reply_business_days } = await getSettings(db)
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(submissions).where(eq(submissions.id, submissionId)).for('update')
    if (!s || s.creatorId !== creatorId) throw new ReviewError('not_found', 'This submission is not yours.')
    const [existing] = await tx.select().from(appeals).where(eq(appeals.submissionId, submissionId))
    if (existing) throw new ReviewError('already_appealed', 'You have already appealed this decision.')
    if (!APPEALABLE.includes(s.state))
      throw new ReviewError('wrong_state', 'Only rejected or removed posts can be appealed.')
    const dueAt = addBusinessDays(now, appeal_reply_business_days)
    const [a] = await tx
      .insert(appeals)
      .values({ submissionId, creatorId, message, links, dueAt, previousState: s.state })
      .returning()
    await tx.update(submissions).set({ state: 'appealed' }).where(eq(submissions.id, submissionId))
    // Every reviewer and admin hears about it, with the deadline.
    const staff = await tx
      .selectDistinct({ id: staffRoles.userId })
      .from(staffRoles)
      .where(inArray(staffRoles.role, ['reviewer', 'admin']))
    for (const { id } of staff)
      await notify(tx, id, 'appeal_opened', {
        title: 'New appeal',
        body: `Reply by ${dueAt.toISOString().slice(0, 10)}.`,
        link: `/admin/appeals/${a!.id}`,
      })
    return a!
  })
}

export async function resolveAppeal(
  db: Db,
  staffId: string,
  appealId: string,
  input: { outcome: 'upheld' | 'overturned'; reply: string },
  now = new Date(),
) {
  const reply = input.reply.trim()
  if (!reply) throw new ReviewError('note_required', 'Write a reply to the creator.')
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(appeals).where(eq(appeals.id, appealId)).for('update')
    if (!a) throw new ReviewError('not_found', 'This appeal does not exist.')
    if (a.status !== 'open') throw new ReviewError('wrong_state', 'This appeal has already been answered.')
    const [s] = await tx.select().from(submissions).where(eq(submissions.id, a.submissionId)).for('update')
    await tx
      .update(appeals)
      .set({ status: input.outcome, reply, reviewerId: staffId, resolvedAt: now })
      .where(eq(appeals.id, a.id))
    let cleared = 0
    if (input.outcome === 'overturned') {
      // Restored: approved, and the next view check pays it from its counted views (02 5.5).
      await tx
        .update(submissions)
        .set({
          state: 'approved',
          reasonCode: null,
          reasonNote: null,
          missingSince: null,
          countedViews: Math.max(0, s!.latestViews - s!.baselineViews),
          nextCheckAt: now,
        })
        .where(eq(submissions.id, s!.id))
      await tx
        .insert(reviewDecisions)
        .values({ submissionId: s!.id, reviewerId: staffId, outcome: 'reverse', note: reply })
      cleared = await clearWarningsFor(tx, s!.id, now)
    } else {
      await tx
        .update(submissions)
        .set({ state: a.previousState ?? 'rejected' })
        .where(eq(submissions.id, s!.id))
    }
    await writeAudit(tx, {
      actorId: staffId,
      action: `appeal.${input.outcome === 'overturned' ? 'overturn' : 'uphold'}`,
      entity: 'appeal',
      entityId: a.id,
      before: { status: 'open', submissionState: s!.state },
      after: { status: input.outcome, reply, strikesCleared: cleared },
    })
    await notify(tx, a.creatorId, 'appeal_reply', {
      title: input.outcome === 'overturned' ? 'Your appeal was accepted' : 'Your appeal was answered',
      body: reply,
      link: `/submissions?open=${s!.id}`,
    })
    return { outcome: input.outcome, strikesCleared: cleared }
  })
}
