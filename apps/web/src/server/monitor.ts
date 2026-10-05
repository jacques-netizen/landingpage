import 'server-only'
import { db } from '@mde/db'
import { sql } from 'drizzle-orm'

/** What staff watch on a running campaign (01_PRODUCT.md 8.4, campaign monitor). */
export async function campaignMonitor(campaignId: string) {
  const d = db()
  const [states, flags, creators] = await Promise.all([
    d.execute<{ state: string; n: string }>(
      sql`select state, count(*)::bigint as n from submissions where campaign_id = ${campaignId} group by state`,
    ),
    d.execute<{
      id: string
      kind: string
      created_at: Date
      submission_id: string
      post_url: string
      email: string
      state: string
    }>(sql`
      select f.id, f.kind, f.created_at, s.id as submission_id, s.post_url, u.email, s.state
      from fraud_flags f join submissions s on s.id = f.submission_id join users u on u.id = s.creator_id
      where s.campaign_id = ${campaignId} and f.status = 'open' order by f.created_at asc limit 50`),
    d.execute<{
      creator_id: string
      email: string
      name: string | null
      posts: string
      counted: string
      earned: string
    }>(sql`
      select s.creator_id, u.email, u.display_name as name, count(*)::bigint as posts,
        coalesce(sum(s.counted_views), 0)::bigint as counted, coalesce(sum(s.earned_cents), 0)::bigint as earned
      from submissions s join users u on u.id = s.creator_id
      where s.campaign_id = ${campaignId} and s.state not in ('rejected_auto', 'rejected', 'removed')
      group by s.creator_id, u.email, u.display_name order by earned desc, counted desc limit 10`),
  ])
  return {
    byState: Object.fromEntries(states.map((r) => [r.state, Number(r.n)])) as Record<string, number>,
    flags: flags.map((f) => ({ ...f, createdAt: new Date(f.created_at) })),
    topCreators: creators.map((c) => ({
      id: c.creator_id,
      name: c.name ?? c.email,
      posts: Number(c.posts),
      countedViews: Number(c.counted),
      earnedCents: Number(c.earned),
    })),
  }
}
