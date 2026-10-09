import 'server-only'
import { db } from '@mde/db'
import { sql } from 'drizzle-orm'

export type MyCampaign = {
  id: string
  title: string
  status: string
  rateCentsPer1000: number
  /** The campaign's card picture, or null for the screen's own. */
  img: string | null
  posts: number
  countedViews: number
  earnedCents: number
  joinedAt: Date
}

/** Campaigns the creator joined, with their posts, counted views and earnings in each. */
export async function myCampaigns(creatorId: string): Promise<MyCampaign[]> {
  const rows = await db().execute<{
    id: string
    title: string
    status: string
    rate: number
    img: string | null
    posts: string
    counted: string
    earned: string
    joined_at: Date
  }>(sql`
    select c.id, c.title, c.status, c.rate_cents_per_1000 as rate, c.cover_image_url as img, m.joined_at,
      count(s.id) filter (where s.state <> 'rejected_auto') as posts,
      coalesce(sum(s.counted_views), 0)::bigint as counted,
      coalesce(sum(s.earned_cents), 0)::bigint as earned
    from campaign_members m
    join campaigns c on c.id = m.campaign_id
    left join submissions s on s.campaign_id = c.id and s.creator_id = m.creator_id
    where m.creator_id = ${creatorId}
    group by c.id, m.joined_at
    order by m.joined_at desc`)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    rateCentsPer1000: Number(r.rate),
    img: r.img,
    posts: Number(r.posts),
    countedViews: Number(r.counted),
    earnedCents: Number(r.earned),
    joinedAt: new Date(r.joined_at),
  }))
}
