import 'server-only'
import { db } from '@mde/db'
import { sql } from 'drizzle-orm'
import { BUCKETS } from './campaign-overview'

const APPROVED = sql`('approved', 'earning', 'final', 'paid_out')`

export type Split = { approved: number; pending: number; rejected: number }

export type CreatorHome = {
  username: string | null
  email: string
  image: string | null
  memberSince: Date
  earnedCents: number
  pendingCents: number
  countedViews: number
  views: Split
  posts: Split
  campaignsJoined: number
  followers: number
  accounts: { platform: string; handle: string; status: string }[]
}

const IN = (states: readonly string[]) =>
  sql.join(
    states.map((s) => sql`${s}`),
    sql`, `,
  )
const A = IN(BUCKETS.approved.states)
const P = IN(BUCKETS.pending.states)
const R = IN(BUCKETS.rejected.states)

/** The signed-in creator's own figures for the Home screen, all from their real records. */
export async function creatorHome(creatorId: string): Promise<CreatorHome> {
  const d = db()
  const [[me], [s], [pending], accounts] = await Promise.all([
    d.execute<{ username: string | null; email: string; image: string | null; created_at: Date }>(
      sql`select username, email, avatar_url as image, created_at from users where id = ${creatorId}`,
    ),
    d.execute<Record<string, string>>(sql`
      select
        coalesce(sum(earned_cents) filter (where state in (${A})), 0)::bigint as earned,
        coalesce(sum(counted_views) filter (where state in (${A})), 0)::bigint as counted,
        coalesce(sum(greatest(latest_views - baseline_views, 0)) filter (where state in (${A})), 0)::bigint as va,
        coalesce(sum(greatest(latest_views - baseline_views, 0)) filter (where state in (${P})), 0)::bigint as vp,
        coalesce(sum(greatest(latest_views - baseline_views, 0)) filter (where state in (${R})), 0)::bigint as vr,
        count(*) filter (where state in (${A})) as pa,
        count(*) filter (where state in (${P})) as pp,
        count(*) filter (where state in (${R})) as pr,
        (select count(*) from campaign_members m where m.creator_id = ${creatorId}) as joined,
        (select coalesce(sum(followers), 0) from linked_accounts l
          where l.creator_id = ${creatorId} and l.status = 'verified') as followers
      from submissions where creator_id = ${creatorId}`),
    d.execute<{ b: string }>(sql`
      select coalesce(sum(e.amount_cents), 0)::bigint as b from ledger_entries e
      join ledger_accounts a on a.id = e.account_id where a.kind = 'creator_pending' and a.owner_id = ${creatorId}`),
    d.execute<{ platform: string; handle: string; status: string }>(sql`
      select platform, handle, status from linked_accounts
      where creator_id = ${creatorId} and status <> 'removed' order by created_at`),
  ])
  const n = (k: string) => Number(s?.[k] ?? 0)
  return {
    username: me?.username ?? null,
    email: me?.email ?? '',
    image: me?.image ?? null,
    memberSince: new Date(me?.created_at ?? Date.now()),
    earnedCents: n('earned'),
    pendingCents: Number(pending?.b ?? 0),
    countedViews: n('counted'),
    views: { approved: n('va'), pending: n('vp'), rejected: n('vr') },
    posts: { approved: n('pa'), pending: n('pp'), rejected: n('pr') },
    campaignsJoined: n('joined'),
    followers: n('followers'),
    accounts: [...accounts],
  }
}

export type LeaderRow = { rank: number; creatorId: string; name: string; views: number; posts: number }

/**
 * Creators ranked by counted views on approved posts, all time. A creator with a private profile is
 * listed without a name. Only creators with at least one approved post appear.
 */
export async function leaderboard(limit = 50): Promise<LeaderRow[]> {
  const rows = await db().execute<{
    id: string
    name: string | null
    private: boolean
    views: string
    posts: string
  }>(sql`
    select u.id, coalesce(u.username, u.display_name) as name, u.is_private_profile as private,
      sum(s.counted_views)::bigint as views, count(*) as posts
    from submissions s join users u on u.id = s.creator_id
    where s.state in ${APPROVED} and u.status = 'active'
    group by u.id
    having sum(s.counted_views) > 0
    order by views desc, min(s.submitted_at) asc
    limit ${limit}`)
  return rows.map((r, i) => ({
    rank: i + 1,
    creatorId: r.id,
    name: r.private ? 'Private creator' : r.name?.trim() || `Creator ${r.id.slice(0, 4).toUpperCase()}`,
    views: Number(r.views),
    posts: Number(r.posts),
  }))
}
