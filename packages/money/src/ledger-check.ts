// The ledger-check job (03_SYSTEMS.md section 11): the property checks from 02_DATA_AND_MONEY.md
// section 7, run on live data. An empty list means every check passed.
import type { DbOrTx } from '@mde/db'
import { sql } from 'drizzle-orm'

export type LedgerProblem = { check: string; detail: Record<string, unknown> }

export async function ledgerCheck(db: DbOrTx): Promise<LedgerProblem[]> {
  const problems: LedgerProblem[] = []
  const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[]

  for (const r of await rows<{ id: string; total: string }>(sql`
    select t.id, sum(e.amount_cents)::bigint as total from ledger_transactions t
    join ledger_entries e on e.transaction_id = t.id group by t.id having sum(e.amount_cents) <> 0`))
    problems.push({ check: 'transaction entries sum to zero', detail: { transactionId: r.id, total: Number(r.total) } })

  const [all] = await rows<{ total: string }>(
    sql`select coalesce(sum(amount_cents), 0)::bigint as total from ledger_entries`,
  )
  if (Number(all!.total) !== 0)
    problems.push({ check: 'all entries sum to zero', detail: { total: Number(all!.total) } })

  for (const r of await rows<{ kind: string; owner_id: string; balance: string }>(sql`
    select a.kind, a.owner_id, sum(e.amount_cents)::bigint as balance from ledger_accounts a
    join ledger_entries e on e.account_id = a.id
    where a.kind in ('campaign_budget', 'creator_available', 'creator_pending')
    group by a.id, a.kind, a.owner_id having sum(e.amount_cents) < 0`))
    problems.push({ check: `${r.kind} never below zero`, detail: { ownerId: r.owner_id, balance: Number(r.balance) } })

  // Pending equals what posts have earned and not yet had released.
  for (const r of await rows<{ creator_id: string; pending: string; earned: string }>(sql`
    with pending as (
      select a.owner_id as creator_id, coalesce(sum(e.amount_cents), 0)::bigint as pending
      from ledger_accounts a left join ledger_entries e on e.account_id = a.id
      where a.kind = 'creator_pending' group by a.owner_id
    ), earned as (
      select creator_id, sum(earned_cents)::bigint as earned from submissions
      where state <> 'paid_out' group by creator_id
    )
    select coalesce(p.creator_id, x.creator_id) as creator_id, coalesce(p.pending, 0) as pending, coalesce(x.earned, 0) as earned
    from pending p full join earned x on x.creator_id = p.creator_id
    where coalesce(p.pending, 0) <> coalesce(x.earned, 0)`))
    problems.push({
      check: 'pending equals unreleased earnings',
      detail: { creatorId: r.creator_id, pending: Number(r.pending), earned: Number(r.earned) },
    })

  return problems
}
