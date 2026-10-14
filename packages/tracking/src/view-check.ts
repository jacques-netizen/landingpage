// The view check job (03_SYSTEMS.md 3.3 and 3.4). Safe to run twice: a check first claims the post by
// moving its next check time forward in one update, so a second run of the same slot finds nothing
// due. Earnings are recomputed from total counted views by the money engine, never added up.
import { getSettings, notify, recordSnapshot, tables, writeAudit, type Db } from '@mde/db'
import { accrueEarnings, createPgStore, reverseEarnings } from '@mde/money'
import {
  isProviderUnavailable,
  type LinkedAccount,
  type Platform,
  type PostData,
  type ProviderRouter,
} from '@mde/platforms'
import { nextCheckAt } from '@mde/submissions'
import { and, asc, desc, eq, isNotNull, lte, sql } from 'drizzle-orm'
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
// A first successful check this long after submission is late (an outage on our side, not the
// creator's): the baseline is then the views at submission, which we never saw, taken as 0, so every
// view counts (owner decision, 2026-10-14). On time, the first check that works sets the baseline.
const LATE_FIRST_MS = 3 * 3_600_000
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
    if (!isProviderUnavailable(e)) throw e
    // 2. A row every time, whatever the result. Nothing else changes; the next slot tries again.
    await recordSnapshot(db, {
      submissionId: s.id,
      takenAt: now,
      views: null,
      source: 'unavailable',
      raw: { error: e.message },
    })
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
    await recordSnapshot(tx, {
      submissionId: s.id,
      takenAt: now,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      isPublic: visible,
      source: post.source ?? null,
      raw: post.rawRef ?? null,
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
      const [reason] = await tx
        .select({ message: tables.reasonCodes.creatorMessage })
        .from(tables.reasonCodes)
        .where(eq(tables.reasonCodes.code, 'deleted_or_edited_post'))
      await notify(tx, s.creatorId, 'submission_removed', {
        title: 'Your post was removed',
        body: [reason?.message, 'You can appeal from your submissions.'].filter(Boolean).join(' '),
        link: `/submissions?open=${s.id}`,
      })
    } else if (visible && post.views !== null) {
      // 5 and 6. The first successful check sets the baseline; counted views move only while earning.
      // A late first check (ours was the outage) sets it to 0 instead, and a baseline that an earlier
      // late check set is corrected the same way, so no creator loses the views of the outage.
      const firstAt = previous.length === 0 ? now : ((await firstViewsAt(db, s.id)) ?? now)
      const late = firstAt.getTime() - s.submittedAt.getTime() > LATE_FIRST_MS
      const baseline = late ? 0 : previous.length === 0 ? post.views : s.baselineViews
      patch.baselineViews = baseline
      // A post the platform could not show at submission gets its published time now.
      if (!s.publishedAt && post.publishedAt) patch.publishedAt = post.publishedAt
      patch.latestViews = post.views
      // The platform's picture and video links expire, so keep the newest ones.
      if (post.thumbnailUrl || post.videoUrl) {
        patch.thumbnailUrl = post.thumbnailUrl ?? s.thumbnailUrl
        patch.videoUrl = post.videoUrl ?? s.videoUrl
        patch.mediaUpdatedAt = now
      }
      if (post.mediaKind) patch.mediaKind = post.mediaKind
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

// Posts in these states are still tracked (everything but rejected and removed).
const TRACKED = ['checking', 'needs_review', 'needs_info', 'flagged', 'approved', 'earning', 'final']
const trackedList = () =>
  sql.join(
    TRACKED.map((t) => sql`${t}`),
    sql`, `,
  )

/**
 * Tracked posts on a live or closing campaign that have no next check scheduled get one now (owner
 * report, 2026-10-14: posts sat on "No check yet" for days). Whatever cleared the schedule, the hourly
 * check must never stop while the campaign runs. Returns how many were put back.
 */
export async function reviveUnscheduled(db: Db, now = new Date()) {
  const rows = await db.execute<{ id: string }>(sql`
    update submissions s set next_check_at = ${now.toISOString()}::timestamptz
    from campaigns c
    where c.id = s.campaign_id and s.next_check_at is null and s.state in (${trackedList()})
      and c.status in ('live', 'closing') and c.deleted_at is null and not c.demo
    returning s.id`)
  return rows.length
}

/** When the post's views were first seen, or null when they never were. */
async function firstViewsAt(db: Db, submissionId: string) {
  const [r] = await db
    .select({ at: viewSnapshots.takenAt })
    .from(viewSnapshots)
    .where(and(eq(viewSnapshots.submissionId, submissionId), isNotNull(viewSnapshots.views)))
    .orderBy(asc(viewSnapshots.takenAt))
    .limit(1)
  return r?.at ?? null
}

/** Every due check, oldest first, a few at a time. One post failing never stops the rest. */
export async function runDueViewChecks(
  db: Db,
  deps: CheckDeps,
  opts: { limit?: number; concurrency?: number; log?: (e: Record<string, unknown>) => void } = {},
) {
  const now = deps.now ?? new Date()
  const { limit = 200, concurrency = 5, log = (e) => console.error(JSON.stringify(e)) } = opts
  const revived = await reviveUnscheduled(db, now)
  if (revived) log({ level: 'warn', msg: 'posts with no check scheduled put back on the hourly check', revived })
  const due = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(lte(submissions.nextCheckAt, now))
    .orderBy(asc(submissions.nextCheckAt))
    .limit(limit)
  const totals = { due: due.length, revived, checked: 0, removed: 0, flagged: 0, unavailable: 0, failed: 0 }
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

/**
 * Live campaigns whose posts have not had a snapshot in a while (owner request, 2026-10-12): every
 * tracked post should be checked hourly, so a campaign with tracked posts and no snapshot for more than
 * `staleHours` means the checks have stopped. Logged as an error by the worker so it shows in Railway.
 */
export async function staleCampaigns(db: Db, now = new Date(), staleHours = 3) {
  const cutoff = new Date(now.getTime() - staleHours * 3_600_000)
  const rows = await db.execute<{ id: string; title: string; last: Date | null; tracked: string }>(sql`
    select c.id, c.title,
      (select max(v.taken_at) from view_snapshots v join submissions x on x.id = v.submission_id where x.campaign_id = c.id) as last,
      count(s.id) as tracked
    from campaigns c
    join submissions s on s.campaign_id = c.id and s.next_check_at is not null and s.submitted_at <= ${cutoff.toISOString()}::timestamptz
    where c.status in ('live', 'closing') and c.deleted_at is null and not c.demo
    group by c.id
    having coalesce(max((select max(v.taken_at) from view_snapshots v where v.submission_id = s.id)), 'epoch'::timestamptz) < ${cutoff.toISOString()}::timestamptz`)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    lastSnapshotAt: r.last ? new Date(r.last).toISOString() : null,
    trackedPosts: Number(r.tracked),
  }))
}

/**
 * Where tracking stands on each live or closing campaign, for the health check and the staff dashboard:
 * how many posts are tracked, how many have no check scheduled, when the next check is due and when the
 * last snapshot was taken.
 */
export async function trackingStatus(db: Db) {
  const rows = await db.execute<{
    id: string
    title: string
    tracked: string
    unscheduled: string
    next_due: Date | null
    last_snapshot: Date | null
    with_views_24h: string
    unavailable_24h: string
    last_error: string | null
  }>(sql`
    select c.id, c.title,
      count(s.id) filter (where s.state in (${trackedList()})) as tracked,
      count(s.id) filter (where s.state in (${trackedList()}) and s.next_check_at is null) as unscheduled,
      min(s.next_check_at) as next_due,
      (select max(v.taken_at) from view_snapshots v join submissions x on x.id = v.submission_id where x.campaign_id = c.id) as last_snapshot,
      (select count(*) from view_snapshots v join submissions x on x.id = v.submission_id
        where x.campaign_id = c.id and v.views is not null and v.taken_at > now() - interval '24 hours') as with_views_24h,
      (select count(*) from view_snapshots v join submissions x on x.id = v.submission_id
        where x.campaign_id = c.id and v.source = 'unavailable' and v.taken_at > now() - interval '24 hours') as unavailable_24h,
      (select left(v.raw->>'error', 300) from view_snapshots v join submissions x on x.id = v.submission_id
        where x.campaign_id = c.id and v.source = 'unavailable' order by v.taken_at desc limit 1) as last_error
    from campaigns c
    left join submissions s on s.campaign_id = c.id
    where c.status in ('live', 'closing') and c.deleted_at is null and not c.demo
    group by c.id
    order by c.title`)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    trackedPosts: Number(r.tracked),
    unscheduledPosts: Number(r.unscheduled),
    nextDueAt: r.next_due ? new Date(r.next_due).toISOString() : null,
    lastSnapshotAt: r.last_snapshot ? new Date(r.last_snapshot).toISOString() : null,
    /** Checks in the last day that got views, and that the provider could not answer, with its last error. */
    checksWithViews24h: Number(r.with_views_24h),
    checksUnavailable24h: Number(r.unavailable_24h),
    lastProviderError: r.last_error,
  }))
}
