import 'server-only'
import { campaignFigures } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { creatorVerificationStats, isInstagramPost, REJECTIONS_TO_BLOCK } from '@mde/review'
import type { CheckResult } from '@mde/submissions/checks'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { BUCKETS, type Bucket } from './campaign-overview'

// The staff campaign workspace (owner brief, 2026-10-15): every review action lives inside a campaign.
// Review cards, the clips grid, the clippers table and the payouts table all read from here.

const inList = (states: readonly string[]) =>
  sql.join(
    states.map((s) => sql`${s}`),
    sql`, `,
  )
const APPROVED = BUCKETS.approved.states
const n = (v: string | number | null | undefined) => Number(v ?? 0)
const bucketOf = (state: string): Bucket =>
  (Object.keys(BUCKETS) as Bucket[]).find((b) => (BUCKETS[b].states as readonly string[]).includes(state)) ?? 'pending'

const FLAG_LABEL: Record<string, string> = {
  view_jump: 'View jump',
  engagement_below_floor: 'Engagement below the floor',
  duplicate_media: 'Same clip posted before',
  wrong_author: 'Posted from another account',
  follower_drop: 'Follower drop',
}

export type ReviewCard = {
  id: string
  who: string
  creatorId: string
  handle: string
  platform: string
  platformPostId: string
  postUrl: string
  hasVideo: boolean
  hasThumbnail: boolean
  flagged: boolean
  submittedAt: string
  postedAt: string | null
  views: number | null
  likes: number | null
  comments: number | null
  checks: { label: string; status: 'pass' | 'fail' | 'review' }[]
}

/** Posts waiting for a reviewer in the campaign: flagged first, then oldest first. */
export async function campaignReviewQueue(campaignId: string): Promise<ReviewCard[]> {
  const d = db()
  const rows = await d.execute<{
    id: string
    state: string
    creator_id: string
    platform: string
    platform_post_id: string
    post_url: string
    video_url: string | null
    thumbnail_url: string | null
    submitted_at: Date
    published_at: Date | null
    checks: CheckResult[] | null
    email: string
    name: string | null
    handle: string | null
    views: string | null
    likes: string | null
    comments: string | null
  }>(sql`
    select s.id, s.state, s.creator_id, s.platform, s.platform_post_id, s.post_url, s.video_url, s.thumbnail_url,
      s.submitted_at, s.published_at, s.check_results as checks, u.email, coalesce(u.username, u.display_name) as name,
      a.handle, v.views, v.likes, v.comments
    from submissions s
    join users u on u.id = s.creator_id
    left join linked_accounts a on a.id = s.linked_account_id
    left join lateral (
      select views, likes, comments from view_snapshots where submission_id = s.id and views is not null
      order by taken_at desc limit 1
    ) v on true
    where s.campaign_id = ${campaignId} and s.state in ('needs_review', 'flagged')
    order by case when s.state = 'flagged' then 0 else 1 end, s.submitted_at asc
    limit 200`)
  const ids = rows.map((r) => r.id)
  const flags = ids.length
    ? await d
        .select({ submissionId: tables.fraudFlags.submissionId, kind: tables.fraudFlags.kind })
        .from(tables.fraudFlags)
        .where(and(inArray(tables.fraudFlags.submissionId, ids), eq(tables.fraudFlags.status, 'open')))
    : []
  return rows.map((r) => {
    const checks = (r.checks ?? []).map((c) => ({ label: c.label, status: c.status }))
    for (const fl of flags.filter((x) => x.submissionId === r.id))
      if (!checks.some((c) => c.label === FLAG_LABEL[fl.kind]))
        checks.push({ label: FLAG_LABEL[fl.kind] ?? fl.kind, status: 'review' })
    return {
      id: r.id,
      who: r.name ?? r.email,
      creatorId: r.creator_id,
      handle: r.handle ? `@${r.handle}` : (r.name ?? r.email),
      platform: r.platform,
      platformPostId: r.platform_post_id,
      postUrl: r.post_url,
      hasVideo: !!r.video_url,
      hasThumbnail: !!r.thumbnail_url,
      flagged: r.state === 'flagged',
      submittedAt: new Date(r.submitted_at).toISOString(),
      postedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      views: r.views === null ? null : n(r.views),
      likes: r.likes === null ? null : n(r.likes),
      comments: r.comments === null ? null : n(r.comments),
      checks,
    }
  })
}

export type ClipFilters = {
  status?: 'all' | Bucket
  platform?: string
  clipper?: string
  needs?: 'verification'
  sort?: 'newest' | 'most' | 'least'
  q?: string
}

export type ClipRow = {
  id: string
  state: string
  bucket: Bucket
  platform: string
  platformPostId: string
  postUrl: string
  handle: string
  creator: string
  creatorId: string
  hasVideo: boolean
  hasThumbnail: boolean
  views: number
  countedViews: number
  verified: boolean
  verifiedViews: number
  earnedCents: number
  likes: number | null
  comments: number | null
  checkedAt: Date | null
  submittedAt: Date
  postedAt: Date | null
  needsVerification: boolean
}

/** Every clip in the campaign for the grid, filtered and sorted from the page's address. */
export async function campaignClips(campaignId: string, f: ClipFilters = {}): Promise<ClipRow[]> {
  const term = f.q?.trim() ? `%${f.q.trim()}%` : null
  const states = f.status && f.status !== 'all' ? BUCKETS[f.status].states : null
  const order =
    f.sort === 'newest'
      ? sql`s.submitted_at desc`
      : f.sort === 'least'
        ? sql`s.latest_views asc, s.submitted_at desc`
        : sql`s.latest_views desc, s.submitted_at desc`
  const rows = await db().execute<{
    id: string
    state: string
    platform: string
    platform_post_id: string
    post_url: string
    video_url: string | null
    thumbnail_url: string | null
    latest_views: string
    counted_views: string
    verified_views: string
    earned_cents: string
    submitted_at: Date
    published_at: Date | null
    creator_id: string
    email: string
    name: string | null
    handle: string | null
    likes: string | null
    comments: string | null
    checked_at: Date | null
  }>(sql`
    select s.id, s.state, s.platform, s.platform_post_id, s.post_url, s.video_url, s.thumbnail_url,
      s.latest_views, s.counted_views, s.verified_views, s.earned_cents, s.submitted_at, s.published_at,
      s.creator_id, u.email, coalesce(u.username, u.display_name) as name, a.handle,
      v.likes, v.comments, v.taken_at as checked_at
    from submissions s
    join users u on u.id = s.creator_id
    left join linked_accounts a on a.id = s.linked_account_id
    left join lateral (
      select likes, comments, taken_at from view_snapshots where submission_id = s.id
      order by taken_at desc limit 1
    ) v on true
    where s.campaign_id = ${campaignId}
      ${states ? sql`and s.state in (${inList(states)})` : sql``}
      ${f.platform ? sql`and s.platform = ${f.platform}` : sql``}
      ${f.clipper ? sql`and s.creator_id = ${f.clipper}` : sql``}
      ${
        f.needs === 'verification'
          ? sql`and s.platform = 'instagram' and s.post_url ~* 'instagram\\.com/([^/?#]+/)?p/' and s.verified_views = 0
                and s.state in (${inList(APPROVED)})`
          : sql``
      }
      ${
        term
          ? sql`and (u.email ilike ${term} or u.username ilike ${term} or u.display_name ilike ${term}
              or a.handle ilike ${term} or s.post_url ilike ${term})`
          : sql``
      }
    order by ${order}
    limit 600`)
  return rows.map((r) => ({
    id: r.id,
    state: r.state,
    bucket: bucketOf(r.state),
    platform: r.platform,
    platformPostId: r.platform_post_id,
    postUrl: r.post_url,
    handle: r.handle ? `@${r.handle}` : (r.name ?? r.email),
    creator: r.name ?? r.email,
    creatorId: r.creator_id,
    hasVideo: !!r.video_url,
    hasThumbnail: !!r.thumbnail_url,
    views: n(r.latest_views),
    countedViews: n(r.counted_views),
    verifiedViews: n(r.verified_views),
    verified: n(r.verified_views) > 0 && n(r.verified_views) >= n(r.latest_views),
    earnedCents: n(r.earned_cents),
    likes: r.likes === null ? null : n(r.likes),
    comments: r.comments === null ? null : n(r.comments),
    checkedAt: r.checked_at ? new Date(r.checked_at) : null,
    submittedAt: new Date(r.submitted_at),
    postedAt: r.published_at ? new Date(r.published_at) : null,
    needsVerification:
      isInstagramPost(r.platform, r.post_url) && n(r.verified_views) === 0 && APPROVED.includes(r.state as never),
  }))
}

export type ClipperRow = {
  id: string
  name: string
  email: string
  handles: { platform: string; handle: string; status: string }[]
  submissions: number
  approved: number
  rejected: number
  views: number
  earnedCents: number
  pendingVerifications: number
  rejectedVerifications: number
  flags: string[]
  joinedAt: Date
}

/** Everyone who joined the campaign with how their posts, views, earnings and verifications stand. */
export async function campaignClippers(campaignId: string): Promise<ClipperRow[]> {
  const d = db()
  const [rows, stats] = await Promise.all([
    d.execute<{
      id: string
      email: string
      name: string | null
      status: string
      joined_at: Date
      submissions: string
      approved: string
      rejected: string
      views: string
      earned: string
      open_flags: string
      accounts: { platform: string; handle: string; status: string }[] | null
    }>(sql`
      select u.id, u.email, coalesce(u.username, u.display_name) as name, u.status, m.joined_at,
        (select count(*) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id)::bigint as submissions,
        (select count(*) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id
           and s.state in (${inList(APPROVED)}))::bigint as approved,
        (select count(*) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id
           and s.state in (${inList(BUCKETS.rejected.states)}))::bigint as rejected,
        (select coalesce(sum(s.latest_views), 0) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id
           and s.state in (${inList(APPROVED)}))::bigint as views,
        (select coalesce(sum(s.earned_cents), 0) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id)::bigint as earned,
        (select count(*) from fraud_flags f join submissions s on s.id = f.submission_id
           where s.campaign_id = m.campaign_id and s.creator_id = u.id and f.status = 'open')::bigint as open_flags,
        (select json_agg(json_build_object('platform', a.platform, 'handle', a.handle, 'status', a.status) order by a.created_at)
           from linked_accounts a where a.creator_id = u.id and a.status <> 'removed') as accounts
      from campaign_members m join users u on u.id = m.creator_id
      where m.campaign_id = ${campaignId}
      order by (select coalesce(sum(s.earned_cents), 0) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id) desc,
        m.joined_at desc
      limit 1000`),
    creatorVerificationStats(d, campaignId),
  ])
  return rows.map((r) => {
    const v = stats.get(r.id)
    const flags: string[] = []
    if (r.status === 'suspended') flags.push('Suspended')
    if (v?.blocked) flags.push(`Blocked: ${REJECTIONS_TO_BLOCK} rejected verifications`)
    else if (v?.rejected) flags.push(`${v.rejected} rejected verification${v.rejected === 1 ? '' : 's'}`)
    if (n(r.open_flags)) flags.push(`${n(r.open_flags)} open fraud flag${n(r.open_flags) === 1 ? '' : 's'}`)
    return {
      id: r.id,
      name: r.name ?? r.email,
      email: r.email,
      handles: r.accounts ?? [],
      submissions: n(r.submissions),
      approved: n(r.approved),
      rejected: n(r.rejected),
      views: n(r.views),
      earnedCents: n(r.earned),
      pendingVerifications: v?.pending ?? 0,
      rejectedVerifications: v?.rejected ?? 0,
      flags,
      joinedAt: new Date(r.joined_at),
    }
  })
}

export type PayoutStatus = 'reserved' | 'held' | 'paid' | 'returned'
export type PayoutRow = {
  submissionId: string
  creatorId: string
  clipper: string
  handle: string
  platform: string
  postUrl: string
  amountCents: number
  status: PayoutStatus
  at: Date | null
}

/**
 * What each clip has earned and where that money stands: reserved while the post earns, held once the
 * campaign has closed and the review window runs, paid once released, returned when a post lost its
 * earnings. Dates come from the ledger.
 */
export async function campaignPayouts(campaignId: string) {
  const d = db()
  const [rows, figures] = await Promise.all([
    d.execute<{
      id: string
      state: string
      creator_id: string
      platform: string
      post_url: string
      earned_cents: string
      returned_cents: string
      name: string | null
      email: string
      handle: string | null
      at: Date | null
    }>(sql`
      select s.id, s.state, s.creator_id, s.platform, s.post_url, s.earned_cents,
        coalesce((select sum(e.amount_cents) from ledger_transactions t join ledger_entries e on e.transaction_id = t.id
          join ledger_accounts a on a.id = e.account_id
          where t.submission_id = s.id and t.kind = 'earning_reversed' and a.kind = 'campaign_budget' and e.amount_cents > 0), 0) as returned_cents,
        coalesce(u.username, u.display_name) as name, u.email, la.handle,
        (select max(t.created_at) from ledger_transactions t where t.submission_id = s.id) as at
      from submissions s
      join users u on u.id = s.creator_id
      left join linked_accounts la on la.id = s.linked_account_id
      where s.campaign_id = ${campaignId}
        and (s.earned_cents > 0 or s.state = 'paid_out'
          or exists (select 1 from ledger_transactions t where t.submission_id = s.id and t.kind = 'earning_reversed'))
      order by at desc nulls last, s.earned_cents desc
      limit 1000`),
    campaignFigures(d, [campaignId]),
  ])
  const payouts: PayoutRow[] = rows.map((r) => {
    const status: PayoutStatus =
      r.state === 'paid_out'
        ? 'paid'
        : r.state === 'final'
          ? 'held'
          : APPROVED.includes(r.state as never)
            ? 'reserved'
            : 'returned'
    return {
      submissionId: r.id,
      creatorId: r.creator_id,
      clipper: r.name ?? r.email,
      handle: r.handle ? `@${r.handle}` : (r.name ?? r.email),
      platform: r.platform,
      postUrl: r.post_url,
      amountCents: status === 'returned' ? n(r.returned_cents) : n(r.earned_cents),
      status,
      at: r.at ? new Date(r.at) : null,
    }
  })
  const sum = (st: PayoutStatus) => payouts.filter((p) => p.status === st).reduce((a, p) => a + p.amountCents, 0)
  const f = figures.get(campaignId)
  return {
    rows: payouts,
    totals: {
      paidCents: sum('paid'),
      holdCents: sum('reserved') + sum('held'),
      returnedCents: sum('returned'),
      remainingCents: f?.leftCents ?? 0,
    },
  }
}

/** Headline figures for the workspace header: views on approved posts and posts waiting. */
export async function campaignHeadline(campaignId: string) {
  const d = db()
  const [[r], reasons] = await Promise.all([
    d.execute<{ views: string; waiting: string; verifications: string }>(sql`
      select coalesce(sum(latest_views) filter (where state in (${inList(APPROVED)})), 0)::bigint as views,
        count(*) filter (where state in ('needs_review', 'flagged'))::bigint as waiting,
        (select count(*) from view_proofs p join submissions x on x.id = p.submission_id
          where x.campaign_id = ${campaignId} and p.status = 'submitted')::bigint as verifications
      from submissions where campaign_id = ${campaignId}`),
    d
      .select({ code: tables.reasonCodes.code, label: tables.reasonCodes.label })
      .from(tables.reasonCodes)
      .orderBy(asc(tables.reasonCodes.label)),
  ])
  return { views: n(r?.views), waiting: n(r?.waiting), verifications: n(r?.verifications), reasons }
}
