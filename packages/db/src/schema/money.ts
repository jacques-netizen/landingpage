import { sql } from 'drizzle-orm'
import { bigint, bigserial, check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { id, timestamps, tz } from './_shared'
import { users } from './identity'

export const ledgerAccountKinds = [
  'client_funds_holding',
  'campaign_budget',
  'creator_pending',
  'creator_available',
  'payout_in_transit',
  'platform_revenue',
  'external',
] as const

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: id(),
    kind: text('kind').notNull(),
    /** 'client' | 'campaign' | 'creator' | 'platform'. */
    ownerType: text('owner_type'),
    ownerId: uuid('owner_id'),
    ...timestamps,
  },
  (t) => [
    unique('ledger_accounts_owner_unique').on(t.kind, t.ownerType, t.ownerId).nullsNotDistinct(),
    check(
      'ledger_accounts_kind_check',
      sql`${t.kind} in ('client_funds_holding','campaign_budget','creator_pending','creator_available','payout_in_transit','platform_revenue','external')`,
    ),
  ],
)

export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: id(),
    kind: text('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    campaignId: uuid('campaign_id'),
    submissionId: uuid('submission_id'),
    creatorId: uuid('creator_id'),
    payoutId: uuid('payout_id'),
    memo: text('memo'),
    /** Null for system jobs. */
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [
    index('ledger_transactions_campaign_idx').on(t.campaignId),
    index('ledger_transactions_creator_idx').on(t.creatorId),
  ],
)

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    /** Positive adds to the account, negative takes from it. A transaction sums to zero. */
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('ledger_entries_transaction_idx').on(t.transactionId),
    index('ledger_entries_account_idx').on(t.accountId),
  ],
)

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: id(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    method: text('method').notNull(),
    amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
    feeCents: bigint('fee_cents', { mode: 'bigint' }).notNull(),
    netCents: bigint('net_cents', { mode: 'bigint' }).notNull(),
    status: text('status').notNull().default('requested'),
    batchId: uuid('batch_id'),
    partnerReference: text('partner_reference'),
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  (t) => [
    check('withdrawals_method_check', sql`${t.method} in ('stripe_connect','paypal')`),
    check(
      'withdrawals_status_check',
      sql`${t.status} in ('requested','approved','in_batch','sent','paid','failed','cancelled')`,
    ),
    check('withdrawals_net_check', sql`${t.netCents} = ${t.amountCents} - ${t.feeCents}`),
    check('withdrawals_amount_check', sql`${t.amountCents} > 0 and ${t.feeCents} >= 0`),
    // A creator cannot have two requests in 'requested' at the same time.
    index('withdrawals_creator_idx').on(t.creatorId),
  ],
)

export const payoutBatches = pgTable('payout_batches', {
  id: id(),
  createdBy: uuid('created_by').references(() => users.id),
  status: text('status').notNull().default('draft'),
  sentAt: tz('sent_at'),
  ...timestamps,
})
