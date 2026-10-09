import 'server-only'
import { db } from '@mde/db'
import { sql } from 'drizzle-orm'

// The staff campaign overview: headline numbers and every post, grouped the way staff think about them.
export const BUCKETS = {
  approved: { label: 'Approved', states: ['approved', 'earning', 'final', 'paid_out'] },
  pending: { label: 'Pending', states: ['checking', 'needs_review', 'needs_info', 'flagged', 'appealed'] },
  rejected: { label: 'Denied', states: ['rejected', 'rejected_auto', 'removed'] },
} as const
export type Bucket = keyof typeof BUCKETS

const inList = (states: readonly string[]) =>
  sql.join(
    states.map((s) => sql`${s}`),
    sql`, `,
  )

export async function campaignOverview(campaignId: string, bucket: Bucket, q?: string) {
  const d = db()
  // Search by creator, account handle or post link (testing report, 2026-10-08).
  const term = q?.trim() ? `%${q.trim()}%` : null
  const [[totals], counts, posts] = await Promise.all([
    d.execute<{ views: string; counted: string; earned: string; creators: string }>(sql`
      select coalesce(sum(latest_views - baseline_views) filter (where state in (${inList(BUCKETS.approved.states)})), 0)::bigint as views,
        coalesce(sum(counted_views), 0)::bigint as counted,
        coalesce(sum(earned_cents), 0)::bigint as earned,
        count(distinct creator_id) filter (where state in (${inList(BUCKETS.approved.states)}))::bigint as creators
      from submissions where campaign_id = ${campaignId}`),
    d.execute<{ state: string; n: string }>(
      sql`select state, count(*)::bigint as n from submissions where campaign_id = ${campaignId} group by state`,
    ),
    d.execute<{
      id: string
      state: string
      platform: string
      post_url: string
      latest_views: string
      baseline_views: string
      counted_views: string
      earned_cents: string
      submitted_at: Date
      reason_code: string | null
      email: string
      name: string | null
      creator_id: string
      handle: string | null
      likes: string | null
      comments: string | null
      shares: string | null
      checked_at: Date | null
    }>(sql`
      select s.id, s.state, s.platform, s.post_url, s.latest_views, s.baseline_views, s.counted_views, s.earned_cents,
        s.submitted_at, s.reason_code, u.email, coalesce(u.username, u.display_name) as name, s.creator_id,
        a.handle, v.likes, v.comments, v.shares, v.taken_at as checked_at
      from submissions s join users u on u.id = s.creator_id
      left join linked_accounts a on a.id = s.linked_account_id
      -- Likes, comments and shares from the post's latest check (it runs every 2 hours).
      left join lateral (
        select likes, comments, shares, taken_at from view_snapshots
        where submission_id = s.id order by taken_at desc limit 1
      ) v on true
      where s.campaign_id = ${campaignId} and s.state in (${inList(BUCKETS[bucket].states)})
        ${
          term
            ? sql`and (u.email ilike ${term} or u.username ilike ${term} or u.display_name ilike ${term}
                or a.handle ilike ${term} or s.post_url ilike ${term})`
            : sql``
        }
      order by ${bucket === 'approved' ? sql`s.counted_views desc` : sql`s.submitted_at desc`}
      limit 500`),
  ])
  const byState = Object.fromEntries(counts.map((r) => [r.state, Number(r.n)])) as Record<string, number>
  const count = (b: Bucket) => BUCKETS[b].states.reduce((n, s) => n + (byState[s] ?? 0), 0)
  return {
    views: Number(totals?.views ?? 0),
    countedViews: Number(totals?.counted ?? 0),
    earnedCents: Number(totals?.earned ?? 0),
    creators: Number(totals?.creators ?? 0),
    counts: { approved: count('approved'), pending: count('pending'), rejected: count('rejected') },
    byState,
    posts: posts.map((p) => ({
      id: p.id,
      state: p.state,
      platform: p.platform,
      postUrl: p.post_url,
      views: Math.max(0, Number(p.latest_views) - Number(p.baseline_views)),
      countedViews: Number(p.counted_views),
      earnedCents: Number(p.earned_cents),
      submittedAt: new Date(p.submitted_at),
      reasonCode: p.reason_code,
      creator: p.name ?? p.email,
      creatorId: p.creator_id,
      handle: p.handle,
      likes: p.likes === null ? null : Number(p.likes),
      comments: p.comments === null ? null : Number(p.comments),
      shares: p.shares === null ? null : Number(p.shares),
      checkedAt: p.checked_at ? new Date(p.checked_at) : null,
    })),
  }
}

/** Everyone who joined the campaign, newest first, with their linked accounts and their posts here. */
export async function campaignCreators(campaignId: string, q?: string) {
  const term = q?.trim() ? `%${q.trim()}%` : null
  const rows = await db().execute<{
    id: string
    email: string
    name: string | null
    joined_at: Date
    status: string
    posts: string
    approved: string
    accounts: { platform: string; handle: string; status: string }[] | null
  }>(sql`
    select u.id, u.email, coalesce(u.username, u.display_name) as name, m.joined_at, u.status,
      (select count(*) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id)::bigint as posts,
      (select count(*) from submissions s where s.campaign_id = m.campaign_id and s.creator_id = u.id
         and s.state in (${inList(BUCKETS.approved.states)}))::bigint as approved,
      (select json_agg(json_build_object('platform', a.platform, 'handle', a.handle, 'status', a.status) order by a.created_at)
         from linked_accounts a where a.creator_id = u.id and a.status <> 'removed') as accounts
    from campaign_members m join users u on u.id = m.creator_id
    where m.campaign_id = ${campaignId}
      ${term ? sql`and (u.email ilike ${term} or u.display_name ilike ${term} or u.username ilike ${term})` : sql``}
    order by m.joined_at desc limit 500`)
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? r.email,
    email: r.email,
    joinedAt: new Date(r.joined_at),
    suspended: r.status === 'suspended',
    posts: Number(r.posts),
    approved: Number(r.approved),
    accounts: r.accounts ?? [],
  }))
}

/** The accounts (pages) posting into the campaign, with followers and how their posts are doing. */
export async function campaignPages(campaignId: string) {
  const rows = await db().execute<{
    id: string
    platform: string
    handle: string
    status: string
    followers: number | null
    creator: string
    creator_id: string
    posts: string
    views: string
    earned: string
  }>(sql`
    select a.id, a.platform, a.handle, a.status, a.followers, coalesce(u.username, u.display_name, u.email) as creator, u.id as creator_id,
      count(s.id)::bigint as posts,
      coalesce(sum(s.latest_views - s.baseline_views) filter (where s.state in (${inList(BUCKETS.approved.states)})), 0)::bigint as views,
      coalesce(sum(s.earned_cents), 0)::bigint as earned
    from linked_accounts a
    join users u on u.id = a.creator_id
    join campaign_members m on m.creator_id = a.creator_id and m.campaign_id = ${campaignId}
    left join submissions s on s.linked_account_id = a.id and s.campaign_id = ${campaignId}
    where a.status <> 'removed'
    group by a.id, u.id order by count(s.id) desc, a.followers desc nulls last limit 500`)
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    handle: r.handle,
    status: r.status,
    followers: r.followers,
    creator: r.creator,
    creatorId: r.creator_id,
    posts: Number(r.posts),
    views: Number(r.views),
    earnedCents: Number(r.earned),
  }))
}

/**
 * Posts and pages per campaign, each split into approved, pending and denied, for the campaigns overview
 * (testing report, 2026-10-08). A page is the account a post came from, or its creator when no account
 * was linked; it counts in every outcome it has a post in.
 */
export async function campaignListCounts() {
  const rows = await db().execute<{
    campaign_id: string
    posts: string
    approved: string
    pending: string
    denied: string
    pages: string
    pages_approved: string
    pages_pending: string
    pages_denied: string
  }>(sql`
    with p as (
      select campaign_id, state, coalesce(linked_account_id, creator_id) as page from submissions
    )
    select campaign_id,
      count(*)::bigint as posts,
      count(*) filter (where state in (${inList(BUCKETS.approved.states)}))::bigint as approved,
      count(*) filter (where state in (${inList(BUCKETS.pending.states)}))::bigint as pending,
      count(*) filter (where state in (${inList(BUCKETS.rejected.states)}))::bigint as denied,
      count(distinct page)::bigint as pages,
      count(distinct page) filter (where state in (${inList(BUCKETS.approved.states)}))::bigint as pages_approved,
      count(distinct page) filter (where state in (${inList(BUCKETS.pending.states)}))::bigint as pages_pending,
      count(distinct page) filter (where state in (${inList(BUCKETS.rejected.states)}))::bigint as pages_denied
    from p group by campaign_id`)
  return new Map(
    rows.map((r) => [
      r.campaign_id,
      {
        posts: {
          total: Number(r.posts),
          approved: Number(r.approved),
          pending: Number(r.pending),
          denied: Number(r.denied),
        },
        pages: {
          total: Number(r.pages),
          approved: Number(r.pages_approved),
          pending: Number(r.pages_pending),
          denied: Number(r.pages_denied),
        },
      },
    ]),
  )
}
