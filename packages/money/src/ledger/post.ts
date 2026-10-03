import { eq, sql } from 'drizzle-orm'
import { ledgerEntries, ledgerTransactions, type Executor } from '@mde/db'
import { balanceOf, lockAccounts } from './accounts'

export type TransactionKind =
  | 'client_funding_received'
  | 'campaign_funded'
  | 'service_fee_taken'
  | 'earning_accrued'
  | 'earning_reversed'
  | 'earnings_released'
  | 'withdrawal_requested'
  | 'withdrawal_paid'
  | 'withdrawal_failed'
  | 'campaign_remainder_returned'
  | 'manual_adjustment'

export type EntryInput = { accountId: string; amountCents: bigint }

export type PostInput = {
  kind: TransactionKind
  /** Deterministic. A repeated key returns the existing transaction and changes nothing. */
  idempotencyKey: string
  entries: EntryInput[]
  campaignId?: string
  submissionId?: string
  creatorId?: string
  /** The withdrawal this movement belongs to. */
  payoutId?: string
  memo?: string
  createdBy?: string | null
}

export type PostResult = { created: boolean; transactionId: string }

const GUARDED = [
  'campaign_budget',
  'creator_pending',
  'creator_available',
  'client_funds_holding',
  'payout_in_transit',
]

/**
 * The only way money moves. Call inside a database transaction. Entries must sum to zero
 * (the database also rejects an unbalanced transaction at commit).
 */
export async function postTransaction(tx: Executor, input: PostInput): Promise<PostResult> {
  if (input.entries.length < 2) throw new Error('A ledger transaction needs at least two entries')
  if (input.entries.some((e) => e.amountCents === 0n))
    throw new Error('Ledger entries cannot be zero')
  const total = input.entries.reduce((s, e) => s + e.amountCents, 0n)
  if (total !== 0n) throw new Error(`Ledger transaction does not balance, the sum is ${total}`)

  const existing = await tx
    .select({ id: ledgerTransactions.id })
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.idempotencyKey, input.idempotencyKey))
    .limit(1)
  if (existing[0]) return { created: false, transactionId: existing[0].id }

  await lockAccounts(
    tx,
    input.entries.map((e) => e.accountId),
  )

  const inserted = await tx
    .insert(ledgerTransactions)
    .values({
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      campaignId: input.campaignId,
      submissionId: input.submissionId,
      creatorId: input.creatorId,
      payoutId: input.payoutId,
      memo: input.memo,
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoNothing({ target: ledgerTransactions.idempotencyKey })
    .returning({ id: ledgerTransactions.id })
  if (!inserted[0]) {
    // A concurrent job with the same key won the race.
    const [won] = await tx
      .select({ id: ledgerTransactions.id })
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1)
    return { created: false, transactionId: won!.id }
  }
  const transactionId = inserted[0].id

  await tx
    .insert(ledgerEntries)
    .values(
      input.entries.map((e) => ({
        transactionId,
        accountId: e.accountId,
        amountCents: e.amountCents,
      })),
    )

  // Fail early with a clear message. The database trigger is the backstop.
  for (const e of input.entries.filter((x) => x.amountCents < 0n)) {
    const rows = await tx.execute<{ kind: string }>(
      sql`select kind from ledger_accounts where id = ${e.accountId}`,
    )
    if (rows[0] && GUARDED.includes(rows[0].kind) && (await balanceOf(tx, e.accountId)) < 0n) {
      throw new Error(`This would take the ${rows[0].kind} account below zero`)
    }
  }
  return { created: true, transactionId }
}
