import 'server-only'
import { db } from '@mde/db'
import { sql } from 'drizzle-orm'

const APPROVED = sql`('approved', 'earning', 'final', 'paid_out')`

export type CreatorHome = {
  name: string | null
  email: string
  earnedCents: number
  countedViews: number
  submissions: number
  campaignsJoined: number
  accounts: { platform: string; handle: string; status: string }[]
}

/** The signed-in creator's own figures for the Home screen, all from their real records. */
export async function creatorHome(creatorId: string): Promise<CreatorHome> {
  const d = db()
  const [[me], [stats], accounts] = await Promise.all([
    d.execute<{ name: string | null; email: string }>(
      sql`select display_name as name, email from users where id = ${creatorId}`,
    ),
    d.execute<{ earned: string; counted: string; posts: string; joined: string }>(sql`
      select
        coalesce(sum(s.earned_cents) filter (where s.state in ${APPROVED}), 0)::bigint as earned,
        coalesce(sum(s.counted_views) filter (where s.state in ${APPROVED}), 0)::bigint as counted,
        count(s.id) filter (where s.state <> 'rejected_auto') as posts,
        (select count(*) from campaign_members m where m.creator_id = ${creatorId}) as joined
      from submissions s where s.creator_id = ${creatorId}`),
    d.execute<{ platform: string; handle: string; status: string }>(sql`
      select platform, handle, status from linked_accounts
      where creator_id = ${creatorId} and status <> 'removed' order by created_at`),
  ])
  return {
    name: me?.name ?? null,
    email: me?.email ?? '',
    earnedCents: Number(stats?.earned ?? 0),
    countedViews: Number(stats?.counted ?? 0),
    submissions: Number(stats?.posts ?? 0),
    campaignsJoined: Number(stats?.joined ?? 0),
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
    select u.id, u.display_name as name, u.is_private_profile as private,
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
