import 'server-only'
import { db } from '@mde/db'
import { sql } from 'drizzle-orm'

// The staff campaign overview: headline numbers and every post, grouped the way staff think about them.
export const BUCKETS = {
  approved: { label: 'Approved', states: ['approved', 'earning', 'final', 'paid_out'] },
  pending: { label: 'Pending', states: ['checking', 'needs_review', 'needs_info', 'flagged', 'appealed'] },
  rejected: { label: 'Rejected', states: ['rejected', 'rejected_auto', 'removed'] },
} as const
export type Bucket = keyof typeof BUCKETS

const inList = (states: readonly string[]) =>
  sql.join(
    states.map((s) => sql`${s}`),
    sql`, `,
  )

export async function campaignOverview(campaignId: string, bucket: Bucket) {
  const d = db()
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
    }>(sql`
      select s.id, s.state, s.platform, s.post_url, s.latest_views, s.baseline_views, s.counted_views, s.earned_cents,
        s.submitted_at, s.reason_code, u.email, u.display_name as name, s.creator_id
      from submissions s join users u on u.id = s.creator_id
      where s.campaign_id = ${campaignId} and s.state in (${inList(BUCKETS[bucket].states)})
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
    })),
  }
}

/** Approved, pending and rejected counts and views on approved posts, for every campaign at once. */
export async function campaignPostCounts() {
  const rows = await db().execute<{
    campaign_id: string
    approved: string
    pending: string
    rejected: string
    views: string
  }>(sql`
    select campaign_id,
      count(*) filter (where state in (${inList(BUCKETS.approved.states)}))::bigint as approved,
      count(*) filter (where state in (${inList(BUCKETS.pending.states)}))::bigint as pending,
      count(*) filter (where state in (${inList(BUCKETS.rejected.states)}))::bigint as rejected,
      coalesce(sum(latest_views - baseline_views) filter (where state in (${inList(BUCKETS.approved.states)})), 0)::bigint as views
    from submissions group by campaign_id`)
  return new Map(
    rows.map((r) => [
      r.campaign_id,
      {
        approved: Number(r.approved),
        pending: Number(r.pending),
        rejected: Number(r.rejected),
        views: Number(r.views),
      },
    ]),
  )
}
