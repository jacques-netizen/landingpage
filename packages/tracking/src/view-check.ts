// The view check job (03_SYSTEMS.md 3.3 and 3.4). Safe to run twice: a check first claims the post by
// moving its next check time forward in one update, so a second run of the same slot finds nothing
// due. Earnings are recomputed from total counted views by the money engine, never added up.
import { getSettings, tables, writeAudit, type Db } from '@mde/db'
import { accrueEarnings, createPgStore, reverseEarnings } from '@mde/money'
import {
  ProviderUnavailable,
  type LinkedAccount,
  type Platform,
  type PostData,
  type ProviderRouter,
} from '@mde/platforms'
import { nextCheckAt } from '@mde/submissions'
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm'
import { engagementBelowFloor, viewJump } from './fraud'

const { submissions, campaigns, linkedAccounts, viewSnapshots, fraudFlags, reviewDecisions, warnings } = tables

export type CheckDeps = {
  router: ProviderRouter
  tokenFor?: (account: LinkedAccount) => Promise<string | null>
  now?: Date
}

export type CheckOutcome =
  | { ran: false }
  | {
      ran: true
      result: 'checked' | 'missing' | 'removed' | 'provider_unavailable'
      flags: string[]
      deltaCents: number
    }

// A claimed check that never finishes is retried after this long.
const LEASE_MS = 30 * 60_000
// Posts in these states are paused by a new flag (03_SYSTEMS.md section 6).
const PAUSABLE = ['needs_review', 'needs_info', 'approved', 'earning']
const EARNING = ['approved', 'earning']

export async function runViewCheck(db: Db, submissionId: string, deps: CheckDeps): Promise<CheckOutcome> {
  const now = deps.now ?? new Date()
  const [s] = await db
    .update(submissions)
    .set({ nextCheckAt: new Date(now.getTime() + LEASE_MS) })
    .where(and(eq(submissions.id, submissionId), lte(submissions.nextCheckAt, now)))
    .returning()
  if (!s) return { ran: false }

  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, s.campaignId))
  const [account] = s.linkedAccountId
    ? await db.select().from(linkedAccounts).where(eq(linkedAccounts.id, s.linkedAccountId))
    : []
  const settings = await getSettings(db)
  const schedule = (state: string) =>
    nextCheckAt({ state, submittedAt: s.submittedAt }, c!, settings.view_check_intervals, now)

  // 1. Fetch the post.
  let post: PostData
  try {
    const token = account?.linkMethod === 'oauth' && deps.tokenFor ? await deps.tokenFor(account) : null
    post = await deps.router.fetchPost(token ? 'oauth' : 'bio_code', {
      platform: s.platform as Platform,
      postUrl: s.postUrl,
      platformPostId: s.platformPostId,
      token: token ?? undefined,
    })
  } catch (e) {
    if (!(e instanceof ProviderUnavailable)) throw e
    // 2. A row every time, whatever the result. Nothing else changes; the next slot tries again.
    await db
      .insert(viewSnapshots)
      .values({ submissionId: s.id, takenAt: now, source: 'unavailable', raw: { error: e.message } })
    await db
      .update(submissions)
      .set({ nextCheckAt: schedule(s.state) })
      .where(eq(submissions.id, s.id))
    return { ran: true, result: 'provider_unavailable', flags: [], deltaCents: 0 }
  }

  const visible = post.exists && post.isPublic
  const missingSince = visible ? null : (s.missingSince ?? now)
  const remove = !visible && now.getTime() - missingSince!.getTime() >= settings.deleted_post_grace_hours * 3_600_000

  const previous = await db
    .select({ takenAt: viewSnapshots.takenAt, views: viewSnapshots.views })
    .from(viewSnapshots)
    .where(and(eq(viewSnapshots.submissionId, s.id), isNotNull(viewSnapshots.views)))
    .orderBy(desc(viewSnapshots.takenAt))
    .limit(settings.fraud_thresholds.view_jump_median_checks + 2)

  // 4 and 7. Fraud rules on the new data.
  const newFlags: { kind: string; detail: Record<string, unknown> }[] = []
  if (visible) {
    if (post.authorPlatformUserId && account?.platformUserId && post.authorPlatformUserId !== account.platformUserId)
      newFlags.push({
        kind: 'wrong_author',
        detail: { expected: account.platformUserId, found: post.authorPlatformUserId },
      })
    if (post.views !== null) {
      const series = [...previous].reverse().concat({ takenAt: now, views: post.views })
      const jump = viewJump(series, account?.followers ?? null, settings.fraud_thresholds)
      if (jump) newFlags.push({ kind: 'view_jump', detail: jump })
      const low = engagementBelowFloor(post, c!.minEngagementBps, settings.fraud_thresholds)
      if (low) newFlags.push({ kind: 'engagement_below_floor', detail: low })
    }
  }

  const before = s.state
  const outcome = await db.transaction(async (tx) => {
    // 2. Keep the snapshot.
    await tx.insert(viewSnapshots).values({
      submissionId: s.id,
      takenAt: now,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      isPublic: visible,
      source: post.source ?? null,
      raw: (post.rawRef ?? null) as never,
    })

    // A flag of a kind already open on this post is not raised twice.
    const open = await tx
      .select({ kind: fraudFlags.kind })
      .from(fraudFlags)
      .where(and(eq(fraudFlags.submissionId, s.id), eq(fraudFlags.status, 'open')))
    const raised = newFlags.filter((f) => !open.some((o) => o.kind === f.kind))
    for (const f of raised)
      await tx
        .insert(fraudFlags)
        .values({ submissionId: s.id, kind: f.kind, detail: { ...f.detail, previousState: before } })

    const patch: Partial<typeof submissions.$inferInsert> = { missingSince }
    let state = before
    if (remove) {
      // 3.4: still missing or private after the grace period.
      state = 'removed'
      patch.reasonCode = 'deleted_or_edited_post'
      await tx
        .insert(reviewDecisions)
        .values({ submissionId: s.id, reviewerId: null, outcome: 'remove', reasonCode: 'deleted_or_edited_post' })
    } else if (visible && post.views !== null) {
      // 5 and 6. The first successful check sets the baseline; counted views move only while earning.
      const baseline = previous.length === 0 ? post.views : s.baselineViews
      patch.baselineViews = baseline
      patch.latestViews = post.views
      const counted = Math.max(0, post.views - baseline)
      if (EARNING.includes(before)) patch.countedViews = counted
      // After close, only corrections down (02_DATA_AND_MONEY.md 5.3).
      else if (before === 'final') patch.countedViews = Math.min(s.countedViews, counted)
    }
    if (!remove && raised.length && PAUSABLE.includes(before)) state = 'flagged'
    patch.state = state
    await tx.update(submissions).set(patch).where(eq(submissions.id, s.id))
    return { state, raised: raised.map((f) => f.kind) }
  })

  const store = createPgStore(db)
  let deltaCents = 0
  if (remove) {
    if (before === 'paid_out') {
      // Released money is never clawed back automatically: a warning and a task for staff (5.4 step 5).
      await db
        .insert(warnings)
        .values({ creatorId: s.creatorId, reasonCode: 'deleted_or_edited_post', note: 'Post removed after payout.' })
      await writeAudit(db, {
        actorId: null,
        action: 'submission.removed_after_payout',
        entity: 'submission',
        entityId: s.id,
        after: { earnedCents: s.earnedCents },
      })
    } else {
      deltaCents = -(await reverseEarnings(store, { submissionId: s.id, actorId: null })).reversedCents
    }
  } else if (EARNING.includes(outcome.state) || outcome.state === 'final') {
    // 8. Earnings from the total counted views; the engine moves approved posts to earning.
    deltaCents = (await accrueEarnings(store, { submissionId: s.id })).deltaCents
  }

  // 9. The next check by the interval table.
  const [after] = await db.select({ state: submissions.state }).from(submissions).where(eq(submissions.id, s.id))
  const [campaignNow] = await db.select().from(campaigns).where(eq(campaigns.id, s.campaignId))
  await db
    .update(submissions)
    .set({
      nextCheckAt: nextCheckAt(
        { state: after!.state, submittedAt: s.submittedAt },
        campaignNow!,
        settings.view_check_intervals,
        now,
      ),
    })
    .where(eq(submissions.id, s.id))

  return {
    ran: true,
    result: remove ? 'removed' : visible ? 'checked' : 'missing',
    flags: outcome.raised,
    deltaCents,
  }
}

/** Every due check, oldest first, a few at a time. One post failing never stops the rest. */
export async function runDueViewChecks(
  db: Db,
  deps: CheckDeps,
  opts: { limit?: number; concurrency?: number; log?: (e: Record<string, unknown>) => void } = {},
) {
  const now = deps.now ?? new Date()
  const { limit = 200, concurrency = 5, log = (e) => console.error(JSON.stringify(e)) } = opts
  const due = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(lte(submissions.nextCheckAt, now))
    .orderBy(asc(submissions.nextCheckAt))
    .limit(limit)
  const totals = { due: due.length, checked: 0, removed: 0, flagged: 0, unavailable: 0, failed: 0 }
  let i = 0
  const worker = async () => {
    while (i < due.length) {
      const id = due[i++]!.id
      try {
        const r = await runViewCheck(db, id, { ...deps, now })
        if (!r.ran) continue
        if (r.result === 'removed') totals.removed++
        else if (r.result === 'provider_unavailable') totals.unavailable++
        else totals.checked++
        if (r.flags.length) totals.flagged++
      } catch (e) {
        totals.failed++
        log({ level: 'error', msg: 'view check failed', submissionId: id, err: String(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, worker))
  return totals
}
