// Daily re-check of each verified account (03_SYSTEMS.md 2.4): still public, handle changed,
// follower drop of more than half in a day (flag), account deleted.
import { getSettings, notify, tables, type Db } from '@mde/db'
import {
  isProviderUnavailable,
  normalizeHandle,
  type LinkedAccount,
  type Platform,
  type ProviderRouter,
} from '@mde/platforms'
import { UNTRACKED_STATES } from '@mde/submissions'
import { and, asc, eq, inArray, isNull, lte, notInArray, or } from 'drizzle-orm'
import { followerDrop } from './fraud'

const { linkedAccounts, submissions, fraudFlags } = tables
const DAY = 86_400_000
const PAUSABLE = ['needs_review', 'needs_info', 'approved', 'earning']

export type RecheckResult = 'ok' | 'handle_changed' | 'gone' | 'private' | 'follower_drop' | 'unavailable'

export async function recheckAccount(
  db: Db,
  account: LinkedAccount,
  deps: { router: ProviderRouter; tokenFor?: (a: LinkedAccount) => Promise<string | null>; now?: Date },
): Promise<RecheckResult> {
  const now = deps.now ?? new Date()
  const settings = await getSettings(db)
  let profile
  try {
    const token = account.linkMethod === 'oauth' && deps.tokenFor ? await deps.tokenFor(account) : null
    profile = await deps.router.fetchProfile(token ? 'oauth' : 'bio_code', {
      platform: account.platform as Platform,
      handle: account.handle,
      platformUserId: account.platformUserId ?? undefined,
      token: token ?? undefined,
    })
  } catch (e) {
    if (isProviderUnavailable(e)) return 'unavailable'
    throw e
  }

  // Gone, or now private: the account needs the creator's attention; posts from it keep their own checks.
  if (!profile || (account.platformUserId && profile.platformUserId !== account.platformUserId)) {
    await db
      .update(linkedAccounts)
      .set({ status: 'failed', lastCheckedAt: now })
      .where(eq(linkedAccounts.id, account.id))
    await accountProblem(db, account, 'We could not find it any more. Link it again to keep submitting from it.')
    return 'gone'
  }
  if (!profile.isPublic) {
    await db
      .update(linkedAccounts)
      .set({ status: 'failed', lastCheckedAt: now })
      .where(eq(linkedAccounts.id, account.id))
    await accountProblem(db, account, 'It is now private. Make it public, then verify it again.')
    return 'private'
  }

  const drop = followerDrop(account.followers, profile.followers, settings.fraud_thresholds)
  const handle = normalizeHandle(profile.handle)
  await db
    .update(linkedAccounts)
    .set({ handle, followers: profile.followers ?? account.followers, lastCheckedAt: now })
    .where(eq(linkedAccounts.id, account.id))

  if (drop) {
    // The flag goes on every tracked post from this account; it pauses those still earning.
    const posts = await db
      .select({ id: submissions.id, state: submissions.state })
      .from(submissions)
      .where(and(eq(submissions.linkedAccountId, account.id), notInArray(submissions.state, UNTRACKED_STATES)))
    for (const p of posts) {
      const [open] = await db
        .select({ id: fraudFlags.id })
        .from(fraudFlags)
        .where(
          and(eq(fraudFlags.submissionId, p.id), eq(fraudFlags.kind, 'follower_drop'), eq(fraudFlags.status, 'open')),
        )
      if (open) continue
      await db.transaction(async (tx) => {
        await tx
          .insert(fraudFlags)
          .values({ submissionId: p.id, kind: 'follower_drop', detail: { ...drop, previousState: p.state } })
        if (PAUSABLE.includes(p.state))
          await tx.update(submissions).set({ state: 'flagged' }).where(eq(submissions.id, p.id))
      })
    }
    return 'follower_drop'
  }
  return handle !== account.handle ? 'handle_changed' : 'ok'
}

/** Verified accounts not checked in the last day, oldest first. */
export async function runAccountRechecks(
  db: Db,
  deps: { router: ProviderRouter; tokenFor?: (a: LinkedAccount) => Promise<string | null>; now?: Date },
  opts: { limit?: number; log?: (e: Record<string, unknown>) => void } = {},
) {
  const now = deps.now ?? new Date()
  const { limit = 500, log = (e) => console.error(JSON.stringify(e)) } = opts
  const due = await db
    .select()
    .from(linkedAccounts)
    .where(
      and(
        inArray(linkedAccounts.status, ['verified']),
        or(isNull(linkedAccounts.lastCheckedAt), lte(linkedAccounts.lastCheckedAt, new Date(now.getTime() - DAY))),
      ),
    )
    .orderBy(asc(linkedAccounts.lastCheckedAt))
    .limit(limit)
  const totals: Record<string, number> = { due: due.length, failed: 0 }
  for (const a of due) {
    try {
      const r = await recheckAccount(db, a, { ...deps, now })
      totals[r] = (totals[r] ?? 0) + 1
    } catch (e) {
      totals.failed!++
      log({ level: 'error', msg: 'account recheck failed', accountId: a.id, err: String(e) })
    }
  }
  return totals
}

/** The creator hears when a linked account stops working (03_SYSTEMS.md section 2). */
async function accountProblem(db: Db, account: { creatorId: string; handle: string; platform: string }, body: string) {
  await notify(db, account.creatorId, 'account_status', {
    title: `Your account @${account.handle} needs attention`,
    body,
    link: '/accounts',
  })
}
