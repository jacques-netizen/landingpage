// Read models for campaign pages. Money figures come from the ledger, never from stored balances.
import { tables, type DbOrTx } from '@mde/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

export type CampaignFigures = { budgetCents: number; leftCents: number; paidCents: number; paidPercent: number }

/** Budget, what is left in the campaign budget account, and what creators have earned. */
export async function campaignFigures(db: DbOrTx, ids: string[]): Promise<Map<string, CampaignFigures>> {
  const out = new Map<string, CampaignFigures>()
  if (ids.length === 0) return out
  const rows = await db.execute<{ id: string; budget: string; left_cents: string; paid: string; funded: boolean }>(sql`
    select c.id, c.budget_cents as budget,
      coalesce((select sum(e.amount_cents) from ledger_entries e join ledger_accounts a on a.id = e.account_id
                where a.kind = 'campaign_budget' and a.owner_id = c.id), 0) as left_cents,
      coalesce((select sum(s.earned_cents) from submissions s where s.campaign_id = c.id), 0) as paid,
      exists(select 1 from ledger_transactions t where t.kind = 'campaign_funded' and t.campaign_id = c.id) as funded
    from campaigns c where c.id in (${sql.join(
      ids.map((i) => sql`${i}`),
      sql`, `,
    )})`)
  for (const r of rows) {
    const budget = Number(r.budget)
    const paid = Number(r.paid)
    // Before funding nothing has been spent, so the whole budget is left.
    const left = r.funded ? Number(r.left_cents) : budget
    out.set(r.id, {
      budgetCents: budget,
      leftCents: left,
      paidCents: paid,
      paidPercent: budget > 0 ? Number((BigInt(paid) * 100n + BigInt(budget) / 2n) / BigInt(budget)) : 0,
    })
  }
  return out
}

export const PUBLIC_STATUSES = ['live', 'closing', 'closed'] as const

/** Campaigns anyone can browse: public ones that are live, closing or closed. */
export async function listPublicCampaigns(db: DbOrTx) {
  const rows = await db
    .select()
    .from(tables.campaigns)
    .where(and(eq(tables.campaigns.visibility, 'public'), inArray(tables.campaigns.status, [...PUBLIC_STATUSES])))
    .orderBy(desc(tables.campaigns.createdAt))
  const figures = await campaignFigures(
    db,
    rows.map((r) => r.id),
  )
  return rows.map((c) => ({ campaign: c, figures: figures.get(c.id)! }))
}

/**
 * One campaign for its page, private ones included (they are reached by link). Staff previewing an
 * unpublished campaign pass includeUnpublished.
 */
export async function getPublicCampaign(db: DbOrTx, id: string, opts: { includeUnpublished?: boolean } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [c] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, id))
  if (!c) return null
  if (!opts.includeUnpublished && !PUBLIC_STATUSES.includes(c.status as (typeof PUBLIC_STATUSES)[number])) return null
  const figures = (await campaignFigures(db, [c.id])).get(c.id)!
  const [terms] = c.currentTermsVersionId
    ? await db.select().from(tables.termsVersions).where(eq(tables.termsVersions.id, c.currentTermsVersionId))
    : []
  return { campaign: c, figures, terms: terms ?? null }
}

/** Recent approved posts on a campaign. Private profiles show a masked name and no avatar. */
export async function recentPosts(db: DbOrTx, campaignId: string, limit = 10) {
  const rows = await db
    .select({
      id: tables.submissions.id,
      platform: tables.submissions.platform,
      postUrl: tables.submissions.postUrl,
      submittedAt: tables.submissions.submittedAt,
      countedViews: tables.submissions.countedViews,
      name: tables.users.name,
      isPrivate: tables.users.isPrivateProfile,
    })
    .from(tables.submissions)
    .innerJoin(tables.users, eq(tables.users.id, tables.submissions.creatorId))
    .where(
      and(
        eq(tables.submissions.campaignId, campaignId),
        inArray(tables.submissions.state, ['approved', 'earning', 'final', 'paid_out']),
      ),
    )
    .orderBy(desc(tables.submissions.submittedAt))
    .limit(limit)
  return rows.map((r) => ({ ...r, name: r.isPrivate || !r.name ? maskName(r.name) : r.name }))
}

export function maskName(name: string | null) {
  if (!name) return 'Private creator'
  return `${name.trim()[0]!.toUpperCase()}. (private)`
}
