// Reviewer decisions (01_PRODUCT.md section 7, 03_SYSTEMS.md sections 5 and 6, 02_DATA_AND_MONEY.md 5.5).
// Every decision writes a review decision, an audit row and a creator notification. Money moves only
// through the engine: approving lets the post earn from the views since submission; rejecting reverses
// everything it earned.
import { getSettings, notify, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { accrueEarnings, createPgStore, reverseEarnings } from '@mde/money'
import { nextCheckAt } from '@mde/submissions'
import { and, eq } from 'drizzle-orm'
import { ReviewError } from './errors'
import { issueWarning } from './warnings'

const { submissions, campaigns, reviewDecisions, fraudFlags, reasonCodes } = tables

const APPROVABLE = ['needs_review', 'needs_info', 'flagged']
const REVERSIBLE = ['rejected', 'rejected_auto', 'removed']
const REJECTABLE = ['needs_review', 'needs_info', 'flagged', 'approved', 'earning', 'final']
// Confirming one of these flags rejects the post with its reason and creates a warning (section 6).
const CONFIRM_REASON: Record<string, string> = {
  view_jump: 'suspected_view_inflation',
  duplicate_media: 'duplicate_post',
}

async function load(d: DbOrTx, id: string, lock = false) {
  const q = d.select().from(submissions).where(eq(submissions.id, id))
  const [s] = lock ? await q.for('update') : await q
  if (!s) throw new ReviewError('not_found', 'This submission does not exist.')
  return s
}

async function openFlags(d: DbOrTx, submissionId: string) {
  return d
    .select()
    .from(fraudFlags)
    .where(and(eq(fraudFlags.submissionId, submissionId), eq(fraudFlags.status, 'open')))
}

const link = (id: string) => `/submissions?open=${id}`

/**
 * Approve a post waiting for review, or reverse an earlier rejection or removal. Open flags on it are
 * cleared, which needs a note. The post then earns from all views since submission.
 */
export async function approve(db: Db, reviewerId: string, id: string, opts: { note?: string | null } = {}) {
  const note = opts.note?.trim() || null
  const settings = await getSettings(db)
  const before = await db.transaction(async (tx) => {
    const s = await load(tx, id, true)
    const reversal = REVERSIBLE.includes(s.state)
    if (!APPROVABLE.includes(s.state) && !reversal)
      throw new ReviewError('wrong_state', `A post that is ${s.state.replace('_', ' ')} cannot be approved here.`)
    const flags = await openFlags(tx, id)
    if (flags.length && !note)
      throw new ReviewError('note_required', 'Add a note to clear the open flags on this post.')
    for (const f of flags)
      await tx
        .update(fraudFlags)
        .set({
          status: 'cleared',
          resolvedAt: new Date(),
          resolvedBy: reviewerId,
          detail: { ...(f.detail as object), note },
        })
        .where(eq(fraudFlags.id, f.id))
    const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, s.campaignId))
    const now = new Date()
    await tx
      .update(submissions)
      .set({
        state: 'approved',
        reasonCode: null,
        reasonNote: null,
        countedViews: Math.max(0, s.latestViews - s.baselineViews),
        nextCheckAt:
          s.nextCheckAt ??
          nextCheckAt({ state: 'approved', submittedAt: s.submittedAt }, c!, settings.view_check_intervals, now),
      })
      .where(eq(submissions.id, id))
    await tx
      .insert(reviewDecisions)
      .values({ submissionId: id, reviewerId, outcome: reversal ? 'reverse' : 'approve', note })
    await writeAudit(tx, {
      actorId: reviewerId,
      action: reversal ? 'submission.reverse' : 'submission.approve',
      entity: 'submission',
      entityId: id,
      before: { state: s.state, flags: flags.map((f) => f.kind) },
      after: { state: 'approved', note },
    })
    await notify(tx, s.creatorId, 'submission_approved', {
      title: 'Your post was approved',
      body: 'It is approved and its views are being counted.',
      link: link(id),
    })
    return s
  })
  // Views since submission count from now; the engine moves it to earning past the minimum.
  const r = await accrueEarnings(createPgStore(db), { submissionId: id })
  return { previousState: before.state, deltaCents: r.deltaCents }
}

/**
 * Reject a post with a reason from the list. Anything it earned is reversed exactly, back to the
 * campaign budget. Released (paid out) posts are not reversed automatically: staff decide.
 */
export async function reject(
  db: Db,
  reviewerId: string,
  id: string,
  opts: { reasonCode: string; note?: string | null; outcome?: 'reject' | 'remove' },
) {
  const note = opts.note?.trim() || null
  const s0 = await load(db, id)
  if (s0.state === 'paid_out')
    throw new ReviewError('paid_out', 'This post was already paid out. Released money is not taken back automatically.')
  if (!REJECTABLE.includes(s0.state))
    throw new ReviewError('wrong_state', `A post that is ${s0.state.replace('_', ' ')} cannot be rejected.`)
  const [reason] = await db.select().from(reasonCodes).where(eq(reasonCodes.code, opts.reasonCode))
  if (!reason) throw new ReviewError('reason_required', 'Choose a reason from the list.')
  if (opts.reasonCode === 'other' && !note)
    throw new ReviewError('note_required', 'Write a note when the reason is Other.')

  const reversed = (await reverseEarnings(createPgStore(db), { submissionId: id, actorId: reviewerId })).reversedCents

  const outcome = opts.outcome ?? 'reject'
  const confirmed = await db.transaction(async (tx) => {
    const s = await load(tx, id, true)
    const flags = await openFlags(tx, id)
    for (const f of flags)
      await tx
        .update(fraudFlags)
        .set({
          status: 'confirmed',
          resolvedAt: new Date(),
          resolvedBy: reviewerId,
          detail: { ...(f.detail as object), note },
        })
        .where(eq(fraudFlags.id, f.id))
    const state = outcome === 'remove' ? 'removed' : 'rejected'
    await tx
      .update(submissions)
      .set({ state, reasonCode: opts.reasonCode, reasonNote: note, nextCheckAt: null })
      .where(eq(submissions.id, id))
    await tx
      .insert(reviewDecisions)
      .values({ submissionId: id, reviewerId, outcome, reasonCode: opts.reasonCode, note })
    await writeAudit(tx, {
      actorId: reviewerId,
      action: `submission.${outcome}`,
      entity: 'submission',
      entityId: id,
      before: { state: s.state, earnedCents: s.earnedCents + reversed },
      after: { state, reasonCode: opts.reasonCode, note, reversedCents: reversed },
    })
    await notify(tx, s.creatorId, outcome === 'remove' ? 'submission_removed' : 'submission_rejected', {
      title: outcome === 'remove' ? 'Your post was removed' : 'Your post was not accepted',
      body: [reason.creatorMessage, note].filter(Boolean).join(' '),
      link: link(id),
    })
    return { s, kinds: flags.map((f) => f.kind) }
  })

  // A confirmed view jump or reused clip is a strike against the creator (03_SYSTEMS.md section 6).
  const strike = confirmed.kinds.find((k) => k in CONFIRM_REASON)
  if (strike)
    await issueWarning(db, reviewerId, confirmed.s.creatorId, {
      reasonCode: CONFIRM_REASON[strike]!,
      note,
      submissionId: id,
    })
  return { reversedCents: reversed, warned: !!strike }
}

/** Ask the creator for something before deciding. The question is the note. */
export async function requestInfo(db: Db, reviewerId: string, id: string, note: string) {
  const text = note.trim()
  if (!text) throw new ReviewError('note_required', 'Write what you need from the creator.')
  await db.transaction(async (tx) => {
    const s = await load(tx, id, true)
    if (!['needs_review', 'flagged'].includes(s.state))
      throw new ReviewError(
        'wrong_state',
        `A post that is ${s.state.replace('_', ' ')} cannot be put on hold for information.`,
      )
    await tx.update(submissions).set({ state: 'needs_info', reasonNote: text }).where(eq(submissions.id, id))
    await tx.insert(reviewDecisions).values({ submissionId: id, reviewerId, outcome: 'request_info', note: text })
    await writeAudit(tx, {
      actorId: reviewerId,
      action: 'submission.request_info',
      entity: 'submission',
      entityId: id,
      before: { state: s.state },
      after: { state: 'needs_info', note: text },
    })
    await notify(tx, s.creatorId, 'needs_info', {
      title: 'A reviewer has a question about your post',
      body: text,
      link: link(id),
    })
  })
}

/** The creator answers a reviewer's question; the post goes back to the review queue with the answer. */
export async function answerInfo(db: Db, creatorId: string, id: string, reply: string) {
  const text = reply.trim()
  if (!text) throw new ReviewError('note_required', 'Write your answer for the reviewer.')
  if (text.length > 1000) throw new ReviewError('note_required', 'Keep the answer to 1,000 characters.')
  await db.transaction(async (tx) => {
    const s = await load(tx, id, true)
    if (s.creatorId !== creatorId) throw new ReviewError('not_found', 'This submission is not yours.')
    if (s.state !== 'needs_info') throw new ReviewError('wrong_state', 'This post is not waiting for an answer.')
    await tx.update(submissions).set({ state: 'needs_review', creatorNote: text }).where(eq(submissions.id, id))
    await writeAudit(tx, {
      actorId: creatorId,
      action: 'submission.info_reply',
      entity: 'submission',
      entityId: id,
      before: { state: s.state, creatorNote: s.creatorNote },
      after: { state: 'needs_review', creatorNote: text },
    })
  })
}

/** Clear one flag with a note. When none are left open, the post goes back to where it was. */
export async function clearFlag(db: Db, reviewerId: string, flagId: string, note: string) {
  const text = note.trim()
  if (!text) throw new ReviewError('note_required', 'Add a note to clear this flag.')
  const id = await db.transaction(async (tx) => {
    const [f] = await tx.select().from(fraudFlags).where(eq(fraudFlags.id, flagId)).for('update')
    if (!f) throw new ReviewError('not_found', 'This flag does not exist.')
    if (f.status !== 'open') throw new ReviewError('wrong_state', 'This flag is already resolved.')
    await tx
      .update(fraudFlags)
      .set({
        status: 'cleared',
        resolvedAt: new Date(),
        resolvedBy: reviewerId,
        detail: { ...(f.detail as object), note: text },
      })
      .where(eq(fraudFlags.id, f.id))
    const s = await load(tx, f.submissionId, true)
    const left = await openFlags(tx, s.id)
    const previous = (f.detail as { previousState?: string } | null)?.previousState
    if (!left.length && s.state === 'flagged' && previous)
      await tx.update(submissions).set({ state: previous }).where(eq(submissions.id, s.id))
    await writeAudit(tx, {
      actorId: reviewerId,
      action: 'fraud_flag.clear',
      entity: 'fraud_flag',
      entityId: f.id,
      before: { status: 'open', kind: f.kind },
      after: { status: 'cleared', note: text },
    })
    return s.id
  })
  // An earning post picks up any views it missed while paused.
  const [s] = await db.select({ state: submissions.state }).from(submissions).where(eq(submissions.id, id))
  if (['approved', 'earning'].includes(s!.state)) await accrueEarnings(createPgStore(db), { submissionId: id })
}
