import 'server-only'
import { tables, type DbOrTx } from '@mde/db'
import { desc, eq, sql } from 'drizzle-orm'

/** Each client's holding balance (paid in, not yet moved into a campaign), from the ledger. */
export async function clientsWithBalances(d: DbOrTx) {
  const rows = await d.execute<{
    id: string
    name: string
    contact_email: string | null
    service_fee_bps: number
    holding: string
    campaigns: string
  }>(sql`
    select c.id, c.name, c.contact_email, c.service_fee_bps,
      coalesce((select sum(e.amount_cents) from ledger_entries e join ledger_accounts a on a.id = e.account_id
                where a.kind = 'client_funds_holding' and a.owner_id = c.id), 0) as holding,
      (select count(*) from campaigns k where k.client_id = c.id) as campaigns
    from clients c order by c.name`)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    contactEmail: r.contact_email,
    serviceFeeBps: r.service_fee_bps,
    holdingCents: Number(r.holding),
    campaigns: Number(r.campaigns),
  }))
}

export async function clientHolding(d: DbOrTx, clientId: string) {
  const rows = await d.execute<{ b: string }>(sql`
    select coalesce(sum(e.amount_cents), 0) as b from ledger_entries e join ledger_accounts a on a.id = e.account_id
    where a.kind = 'client_funds_holding' and a.owner_id = ${clientId}`)
  return Number(rows[0]!.b)
}

/** Money received from a client, newest first. */
export async function clientFundingHistory(d: DbOrTx, clientId: string) {
  const rows = await d.execute<{ id: string; memo: string | null; created_at: string; amount: string }>(sql`
    select t.id, t.memo, t.created_at, e.amount_cents as amount
    from ledger_transactions t join ledger_entries e on e.transaction_id = t.id join ledger_accounts a on a.id = e.account_id
    where t.kind = 'client_funding_received' and a.kind = 'client_funds_holding' and a.owner_id = ${clientId}
    order by t.created_at desc`)
  return rows.map((r) => ({ id: r.id, reference: r.memo, at: new Date(r.created_at), amountCents: Number(r.amount) }))
}

/** Campaigns with what they need for the staff list: budget used and posts waiting for review. */
export async function campaignsForStaff(d: DbOrTx) {
  const rows = await d
    .select({ c: tables.campaigns, client: tables.clients.name })
    .from(tables.campaigns)
    .leftJoin(tables.clients, eq(tables.clients.id, tables.campaigns.clientId))
    .orderBy(desc(tables.campaigns.createdAt))
  const waiting = await d.execute<{ campaign_id: string; n: string }>(
    sql`select campaign_id, count(*) as n from submissions where state in ('needs_review','flagged') group by campaign_id`,
  )
  const w = new Map(waiting.map((r) => [r.campaign_id, Number(r.n)]))
  return rows.map((r) => ({ ...r.c, clientName: r.client, postsWaiting: w.get(r.c.id) ?? 0 }))
}
