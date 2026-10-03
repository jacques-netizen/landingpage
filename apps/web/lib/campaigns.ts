import { sql } from 'drizzle-orm'
import type { CampaignType } from '@mde/ui'
import { getDb } from '@/lib/db'

export type CampaignSummary = {
  id: string
  title: string
  type: CampaignType
  status: string
  coverImageUrl: string | null
  platforms: ('tiktok' | 'instagram' | 'youtube' | 'x')[]
  budgetCents: bigint
  /** What is still in the campaign budget account. Computed from ledger entries, never stored. */
  budgetLeftCents: bigint
  rateCentsPer1000: number
}

/** Live campaigns for public lists. Real rows only. Public visibility only. */
export async function getLiveCampaigns(limit = 4): Promise<CampaignSummary[]> {
  const rows = await getDb().execute<{
    id: string
    title: string
    type: CampaignType
    status: string
    cover_image_url: string | null
    platforms: string[]
    budget_cents: string
    left_cents: string | null
    rate_cents_per_1000: number
  }>(sql`
    select c.id, c.title, c.type, c.status, c.cover_image_url, c.platforms, c.budget_cents::text,
           c.rate_cents_per_1000,
           (select coalesce(sum(e.amount_cents), 0)::text
              from ledger_accounts a join ledger_entries e on e.account_id = a.id
             where a.kind = 'campaign_budget' and a.owner_type = 'campaign' and a.owner_id = c.id) as left_cents
      from campaigns c
     where c.status = 'live' and c.visibility = 'public'
     order by c.start_at desc nulls last, c.created_at desc
     limit ${limit}`)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    coverImageUrl: r.cover_image_url,
    platforms: r.platforms as CampaignSummary['platforms'],
    budgetCents: BigInt(r.budget_cents),
    budgetLeftCents: BigInt(r.left_cents ?? '0'),
    rateCentsPer1000: r.rate_cents_per_1000,
  }))
}
