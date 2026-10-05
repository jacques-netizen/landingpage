// Submitting a post: run the automatic checks in order, stop at the first failure, and store the
// outcome (03_SYSTEMS.md section 4). Checks 1, 2 and 4 failing store nothing (there is no post to
// keep, or it is already in the campaign); every other outcome is kept so it can be appealed.
import { getSettings, tables, type Db } from '@mde/db'
import {
  parsePostUrl,
  ProviderUnavailable,
  type LinkedAccount,
  type Platform,
  type PostData,
  type ProviderRouter,
} from '@mde/platforms'
import { and, eq, isNotNull, ne, notInArray, sql } from 'drizzle-orm'
import {
  checkAccountRules,
  checkAuthor,
  checkCaption,
  checkDuration,
  checkMedia,
  checkNotDuplicate,
  checkOpen,
  checkPlatform,
  checkPostLimit,
  checkPublic,
  checkTiming,
  type CheckResult,
} from './checks'
import { mediaHashFromUrl } from './media-hash'
import { nextCheckAt } from './schedule'

const { campaigns, submissions, linkedAccounts, campaignMembers, viewSnapshots, reviewDecisions, fraudFlags } = tables

export type SubmitOutcome = 'needs_review' | 'approved' | 'flagged' | 'rejected_auto' | 'not_submitted'
export type SubmitResult = {
  outcome: SubmitOutcome
  checks: CheckResult[]
  submissionId?: string
  /** Why nothing was stored, when the checks could not run. */
  message?: string
}

export type SubmitInput = {
  creatorId: string
  campaignId: string
  postUrl: string
  /** The account the creator says they posted from. The post must come from it. */
  linkedAccountId?: string | null
  note?: string | null
}
export type SubmitDeps = {
  router: ProviderRouter
  /** An OAuth access token for an account linked by official login, when there is one. */
  tokenFor?: (account: LinkedAccount) => Promise<string | null>
  http?: typeof fetch
  now?: Date
}

// Posts in these states do not use up an account's posts for the campaign.
const NOT_COUNTED = ['rejected_auto', 'rejected', 'removed']

export async function submitPost(db: Db, input: SubmitInput, deps: SubmitDeps): Promise<SubmitResult> {
  const now = deps.now ?? new Date()
  const checks: CheckResult[] = []
  const stop = (message?: string): SubmitResult => ({ outcome: 'not_submitted', checks, message })

  // A suspended creator cannot submit (03_SYSTEMS.md section 8).
  const [u] = await db
    .select({ status: tables.users.status })
    .from(tables.users)
    .where(eq(tables.users.id, input.creatorId))
  if (u?.status !== 'active')
    return stop('Your account is suspended, so new posts cannot be submitted. Contact support.')
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId))
  if (!c) return stop('This campaign does not exist.')
  const [member] = await db
    .select()
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, c.id), eq(campaignMembers.creatorId, input.creatorId)))
  const rules = { ...c, platforms: c.platforms as string[] }

  // 1 and 2.
  checks.push(checkOpen(rules, !!member, now))
  if (checks.at(-1)!.status === 'fail') return stop()
  const postUrl = input.postUrl.trim()
  const parsed = parsePostUrl(postUrl)
  checks.push(checkPlatform(rules, parsed))
  if (!parsed || checks.at(-1)!.status === 'fail') return stop()
  const platform = parsed.platform as Platform

  // Fetch the post once; checks 3 and 6 to 11 read it.
  const accounts = (
    await db
      .select()
      .from(linkedAccounts)
      .where(and(eq(linkedAccounts.creatorId, input.creatorId), ne(linkedAccounts.status, 'removed')))
  ).filter((a) => !input.linkedAccountId || a.id === input.linkedAccountId)
  const onPlatform = accounts.filter((a) => a.platform === platform && a.status === 'verified')
  const oauth = onPlatform.find((a) => a.linkMethod === 'oauth')
  let post: PostData
  try {
    const token = oauth && deps.tokenFor ? await deps.tokenFor(oauth) : null
    post = await deps.router.fetchPost(oauth && token ? 'oauth' : 'bio_code', {
      platform,
      postUrl,
      platformPostId: parsed.platformPostId,
      token: token ?? undefined,
    })
  } catch (e) {
    if (e instanceof ProviderUnavailable)
      return stop(
        'We could not reach the platform to check this post. Nothing was submitted. Try again in a few minutes.',
      )
    throw e
  }

  // 3.
  const author = checkAuthor(accounts, platform, post, parsed.handle)
  checks.push(author.result)
  const account = author.account

  // 4. A post this creator submitted before and that failed the automatic checks can be checked again.
  const [existing] = await db
    .select({ id: submissions.id, creatorId: submissions.creatorId, state: submissions.state })
    .from(submissions)
    .where(
      and(
        eq(submissions.campaignId, c.id),
        eq(submissions.platform, platform),
        eq(submissions.platformPostId, parsed.platformPostId),
      ),
    )
  const retry =
    existing && existing.creatorId === input.creatorId && existing.state === 'rejected_auto' ? existing : null
  if (retry) {
    const [appeal] = await db.select().from(tables.appeals).where(eq(tables.appeals.submissionId, retry.id))
    if (appeal) {
      checks.push(checkNotDuplicate(true))
      return { ...stop(), submissionId: retry.id }
    }
  }

  const s = await getSettings(db)
  const failedAt = () => checks.find((r) => r.status === 'fail')
  if (author.result.status === 'pass') {
    checks.push(checkNotDuplicate(!!existing && !retry))
    if (checks.at(-1)!.status === 'fail') return stop()
    const [{ n }] = (await db
      .select({ n: sql<number>`count(*)::int` })
      .from(submissions)
      .where(
        and(
          eq(submissions.campaignId, c.id),
          eq(submissions.linkedAccountId, account!.id),
          notInArray(submissions.state, NOT_COUNTED),
        ),
      )) as [{ n: number }]
    for (const run of [
      () => checkPostLimit(rules, n),
      () => checkPublic(post),
      () => checkTiming(rules, post, s.max_post_age_hours, now),
      () => checkAccountRules(rules, account!, now),
      () => checkDuration(rules, post),
      () => checkCaption(rules, post),
    ]) {
      checks.push(run())
      if (failedAt()) break
    }
  } else if (existing && !retry) {
    // Not the creator's account, and already in the campaign: nothing to keep.
    return stop()
  }

  // 11. Only when everything else passed: a close match is a flag for review, not a rejection.
  let mediaHash: string | null = null
  if (!failedAt()) {
    mediaHash = post.mediaHash ?? (post.thumbnailUrl ? await mediaHashFromUrl(post.thumbnailUrl, deps.http) : null)
    const others = mediaHash
      ? (
          await db
            .select({ h: submissions.mediaHash })
            .from(submissions)
            .where(
              and(
                eq(submissions.campaignId, c.id),
                isNotNull(submissions.mediaHash),
                retry ? ne(submissions.id, retry.id) : undefined,
              ),
            )
        ).map((r) => r.h!)
      : []
    checks.push(checkMedia(mediaHash, others))
  }

  const failure = failedAt()
  const duplicateMedia = checks.some((r) => r.check === 11 && r.status === 'review')
  let state: SubmitOutcome = failure ? 'rejected_auto' : duplicateMedia ? 'flagged' : 'needs_review'
  if (state === 'needs_review' && s.auto_approve_clean_creators && !checks.some((r) => r.status === 'review'))
    if (await isClean(db, input.creatorId, now)) state = 'approved'

  const values = {
    campaignId: c.id,
    creatorId: input.creatorId,
    linkedAccountId: account?.id ?? null,
    platform,
    postUrl,
    platformPostId: parsed.platformPostId,
    state,
    reasonCode: failure?.reason ?? null,
    reasonNote: null,
    termsVersionId: c.currentTermsVersionId!,
    rateCentsPer1000Locked: c.rateCentsPer1000,
    publishedAt: post.publishedAt,
    submittedAt: now,
    // The views at submission are the baseline and are never counted (02_DATA_AND_MONEY.md).
    baselineViews: post.views ?? 0,
    latestViews: post.views ?? 0,
    countedViews: 0,
    earnedCents: 0,
    mediaHash,
    checkResults: checks,
    creatorNote: input.note?.trim() || null,
    // The check at submission is the first one; the next follows the interval table.
    nextCheckAt: nextCheckAt({ state, submittedAt: now }, c, s.view_check_intervals, now),
    missingSince: null,
  }

  try {
    const id = await db.transaction(async (tx) => {
      let id: string
      if (retry) {
        await tx.update(submissions).set(values).where(eq(submissions.id, retry.id))
        id = retry.id
      } else {
        const [row] = await tx.insert(submissions).values(values).returning({ id: submissions.id })
        id = row!.id
      }
      // The check at submission is the first view check: keep the snapshot (03_SYSTEMS.md 3.3).
      await tx.insert(viewSnapshots).values({
        submissionId: id,
        takenAt: now,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        isPublic: post.exists && post.isPublic,
        source: post.source ?? null,
        raw: (post.rawRef ?? null) as never,
      })
      if (failure)
        await tx
          .insert(reviewDecisions)
          .values({ submissionId: id, reviewerId: null, outcome: 'reject', reasonCode: failure.reason })
      if (state === 'approved')
        await tx.insert(reviewDecisions).values({ submissionId: id, reviewerId: null, outcome: 'approve' })
      if (duplicateMedia)
        await tx.insert(fraudFlags).values({ submissionId: id, kind: 'duplicate_media', detail: { mediaHash } })
      return id
    })
    return { outcome: state, checks, submissionId: id }
  } catch (e) {
    // The same post was submitted to this campaign a moment ago.
    const code = (e as { code?: string; cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code
    if (code === '23505') {
      checks.splice(3)
      checks.push(checkNotDuplicate(true))
      return stop()
    }
    throw e
  }
}

/** A creator with no active warnings, no active strikes and no confirmed fraud flags. */
async function isClean(db: Db, creatorId: string, now: Date) {
  const rows = await db.execute(sql`
    select
      (select count(*) from warnings w where w.creator_id = ${creatorId}
         and (w.expires_at is null or w.expires_at > ${now.toISOString()}::timestamptz))::int as warnings,
      (select strikes_active from creator_profiles where user_id = ${creatorId}) as strikes,
      (select count(*) from fraud_flags f join submissions s on s.id = f.submission_id
         where s.creator_id = ${creatorId} and f.status in ('open', 'confirmed'))::int as flags`)
  const r = rows[0] as { warnings: number; strikes: number | null; flags: number }
  return r.warnings === 0 && (r.strikes ?? 0) === 0 && r.flags === 0
}
