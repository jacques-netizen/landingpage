import { sql } from 'drizzle-orm'
import type { Executor } from '@mde/db'

export type AccountKind =
  | 'client_funds_holding'
  | 'campaign_budget'
  | 'creator_pending'
  | 'creator_available'
  | 'payout_in_transit'
  | 'platform_revenue'
  | 'external'

/** Finds or creates the single account for this owner. Safe to call from concurrent jobs. */
export async function getAccount(
  ex: Executor,
  kind: AccountKind,
  ownerType: string | null,
  ownerId: string | null,
): Promise<string> {
  await ex.execute(
    sql`insert into ledger_accounts (kind, owner_type, owner_id) values (${kind}, ${ownerType}, ${ownerId}) on conflict do nothing`,
  )
  const rows = await ex.execute<{ id: string }>(
    sql`select id from ledger_accounts where kind = ${kind} and owner_type is not distinct from ${ownerType} and owner_id is not distinct from ${ownerId}`,
  )
  const id = rows[0]?.id
  if (!id) throw new Error(`Ledger account missing for ${kind}`)
  return id
}

/** One account per owner, as listed in docs/02_DATA_AND_MONEY.md section 3. */
export const accounts = {
  clientHolding: (ex: Executor, clientId: string) =>
    getAccount(ex, 'client_funds_holding', 'client', clientId),
  campaignBudget: (ex: Executor, campaignId: string) =>
    getAccount(ex, 'campaign_budget', 'campaign', campaignId),
  creatorPending: (ex: Executor, creatorId: string) =>
    getAccount(ex, 'creator_pending', 'creator', creatorId),
  creatorAvailable: (ex: Executor, creatorId: string) =>
    getAccount(ex, 'creator_available', 'creator', creatorId),
  payoutInTransit: (ex: Executor) => getAccount(ex, 'payout_in_transit', 'platform', null),
  platformRevenue: (ex: Executor) => getAccount(ex, 'platform_revenue', 'platform', null),
  external: (ex: Executor) => getAccount(ex, 'external', null, null),
}

/** Balances are always computed from entries. Nothing is cached that could drift. */
export async function balanceOf(ex: Executor, accountId: string): Promise<bigint> {
  const rows = await ex.execute<{ balance: string }>(
    sql`select coalesce(sum(amount_cents), 0)::text as balance from ledger_entries where account_id = ${accountId}`,
  )
  return BigInt(rows[0]?.balance ?? '0')
}

/**
 * Takes row locks on the accounts a money operation will touch. Always in ascending id order, so two
 * operations that need the same accounts can never wait on each other in a circle. Call inside the
 * database transaction, before reading any balance.
 */
export async function lockAccounts(tx: Executor, accountIds: string[]): Promise<void> {
  const ids = [...new Set(accountIds)].sort()
  if (ids.length === 0) return
  await tx.execute(
    sql`select id from ledger_accounts where id in (${sql.join(
      ids.map((i) => sql`${i}`),
      sql`, `,
    )}) order by id for update`,
  )
}
