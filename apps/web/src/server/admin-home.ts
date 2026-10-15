import 'server-only'
import { campaignFigures } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { verificationsWaiting } from '@mde/review'
import { desc, eq, isNull, sql } from 'drizzle-orm'

// The staff home (owner brief, 2026-10-15): one row per campaign, the ones needing attention first.
export type HomeStatus = 'live' | 'ended' | 'draft'
export type HomeCampaign = {
  id: string
  title: string
  clientName: string | null
  status: HomeStatus
  statusLabel: string
  demo: boolean
  waiting: number
  verifications: number
  budgetCents: number
  spentCents: number
  views: number
  lastScrapeAt: Date | null
  /** No scrape for over 3 hours on a live campaign with tracked posts. */
  stale: boolean
  trackedPosts: number
}

const STALE_MS = 3 * 3_600_000
const LIVE = ['live', 'closing']
const ENDED = ['closed', 'cancelled']

export async function homeCampaigns(now = new Date()): Promise<HomeCampaign[]> {
  const d = db()
  const campaigns = await d
    .select({ c: tables.campaigns, clientName: tables.clients.name })
    .from(tables.campaigns)
    .leftJoin(tables.clients, eq(tables.clients.id, tables.campaigns.clientId))
    .where(isNull(tables.campaigns.deletedAt))
    .orderBy(desc(tables.campaigns.createdAt))
  const ids = campaigns.map((x) => x.c.id)
  const [figures, verifications, stats] = await Promise.all([
    campaignFigures(d, ids),
    verificationsWaiting(d),
    d.execute<{ campaign_id: string; waiting: string; views: string; last_scrape: Date | null; tracked: string }>(sql`
      select s.campaign_id,
        count(*) filter (where s.state in ('needs_review', 'flagged'))::bigint as waiting,
        coalesce(sum(s.latest_views) filter (where s.state in ('approved', 'earning', 'final', 'paid_out')), 0)::bigint as views,
        count(*) filter (where s.next_check_at is not null)::bigint as tracked,
        (select max(v.taken_at) from view_snapshots v join submissions x on x.id = v.submission_id
          where x.campaign_id = s.campaign_id and coalesce(v.source, '') not in ('manual', 'unavailable')) as last_scrape
      from submissions s group by s.campaign_id`),
  ])
  const byId = new Map(stats.map((r) => [r.campaign_id, r]))
  const rows = campaigns.map(({ c, clientName }): HomeCampaign => {
    const st = byId.get(c.id)
    const f = figures.get(c.id)
    const status: HomeStatus = LIVE.includes(c.status) ? 'live' : ENDED.includes(c.status) ? 'ended' : 'draft'
    const lastScrapeAt = st?.last_scrape ? new Date(st.last_scrape) : null
    const tracked = Number(st?.tracked ?? 0)
    return {
      id: c.id,
      title: c.title,
      clientName,
      status,
      statusLabel: status === 'live' ? 'Live' : status === 'ended' ? 'Ended' : 'Draft',
      demo: c.demo,
      waiting: Number(st?.waiting ?? 0),
      verifications: verifications.get(c.id) ?? 0,
      budgetCents: c.budgetCents,
      spentCents: f?.paidCents ?? 0,
      views: Number(st?.views ?? 0),
      lastScrapeAt,
      stale:
        status === 'live' &&
        !c.demo &&
        tracked > 0 &&
        (!lastScrapeAt || now.getTime() - lastScrapeAt.getTime() > STALE_MS),
      trackedPosts: tracked,
    }
  })
  // Needing attention first: posts and verifications waiting, then stale scrapes, then live before the rest.
  const weight = (r: HomeCampaign) =>
    (r.waiting + r.verifications > 0 ? 4 : 0) + (r.stale ? 2 : 0) + (r.status === 'live' ? 1 : 0)
  return rows.sort((a, b) => weight(b) - weight(a) || b.waiting + b.verifications - (a.waiting + a.verifications))
}
