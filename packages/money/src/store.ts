// The engine talks to storage only through this interface. Two implementations exist: Postgres
// (the product) and in memory (fast property tests). Both run the same engine code.
import type { WithdrawalFeeSettings } from './fees'

export type AccountKind =
  | 'client_funds_holding'
  | 'campaign_budget'
  | 'creator_pending'
  | 'creator_available'
  | 'payout_in_transit'
  | 'platform_revenue'
  | 'external'

export type OwnerType = 'client' | 'campaign' | 'creator' | 'platform'
export type AccountRef = { kind: AccountKind; ownerType: OwnerType; ownerId: string | null }

export const account = {
  external: (): AccountRef => ({ kind: 'external', ownerType: 'platform', ownerId: null }),
  revenue: (): AccountRef => ({ kind: 'platform_revenue', ownerType: 'platform', ownerId: null }),
  inTransit: (): AccountRef => ({ kind: 'payout_in_transit', ownerType: 'platform', ownerId: null }),
  holding: (clientId: string): AccountRef => ({ kind: 'client_funds_holding', ownerType: 'client', ownerId: clientId }),
  budget: (campaignId: string): AccountRef => ({ kind: 'campaign_budget', ownerType: 'campaign', ownerId: campaignId }),
  pending: (creatorId: string): AccountRef => ({ kind: 'creator_pending', ownerType: 'creator', ownerId: creatorId }),
  available: (creatorId: string): AccountRef => ({
    kind: 'creator_available',
    ownerType: 'creator',
    ownerId: creatorId,
  }),
}

/** Accounts whose balance can never go below zero. Only the outside world can. */
export const GUARDED_KINDS: readonly AccountKind[] = [
  'client_funds_holding',
  'campaign_budget',
  'creator_pending',
  'creator_available',
  'payout_in_transit',
  'platform_revenue',
]

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
  | 'campaign_budget_changed'
  | 'service_fee_adjusted'
  | 'manual_adjustment'

export type NewTransaction = {
  kind: TransactionKind
  idempotencyKey: string
  campaignId?: string | null
  submissionId?: string | null
  creatorId?: string | null
  payoutId?: string | null
  memo?: string | null
  createdBy?: string | null
}

export type Entry = { accountId: string; amountCents: number }

export type CampaignMoney = {
  id: string
  clientId: string
  status: string
  budgetCents: number
  capPerPostCents: number | null
  capPerCreatorCents: number | null
  minViewsToEarn: number
}

export type SubmissionMoney = {
  id: string
  campaignId: string
  creatorId: string
  state: string
  countedViews: number
  earnedCents: number
  rateCentsPer1000Locked: number
}

export type WithdrawalMoney = {
  id: string
  creatorId: string
  method: 'stripe_connect' | 'paypal' | 'crypto'
  amountCents: number
  feeCents: number
  netCents: number
  destination?: string | null
  status: string
}

export type AuditEntry = {
  actorId: string | null
  action: string
  entity: string
  entityId: string | null
  before?: unknown
  after?: unknown
}

export interface MoneyTx {
  /** Get or create the accounts and lock them for this transaction. Returns ids in input order. */
  lockAccounts(refs: AccountRef[]): Promise<string[]>
  balance(accountId: string): Promise<number>
  /** Insert a transaction and its entries. If the idempotency key exists, nothing is written. */
  insertTransaction(t: NewTransaction, entries: Entry[]): Promise<{ id: string; created: boolean }>
  transactionExists(idempotencyKey: string): Promise<boolean>
  countSubmissionTransactions(submissionId: string): Promise<number>
  /** How many transactions of one kind a campaign has had. */
  countCampaignTransactions(campaignId: string, kind: string): Promise<number>

  campaign(id: string): Promise<CampaignMoney | null>
  setCampaignStatus(id: string, status: string): Promise<void>
  setCampaignBudget(id: string, budgetCents: number): Promise<void>
  clientServiceFeeBps(clientId: string): Promise<number | null>

  /** Read a submission, locking its row when asked. */
  submission(id: string, lock: boolean): Promise<SubmissionMoney | null>
  setSubmission(id: string, patch: { earnedCents?: number; state?: string }): Promise<void>
  creatorEarnedInCampaign(creatorId: string, campaignId: string, excludeSubmissionId: string): Promise<number>
  hasOpenFlagOrAppeal(submissionId: string): Promise<boolean>

  /** Lock the creator (serialises withdrawal requests) and read what withdrawals need. */
  lockCreator(creatorId: string): Promise<{ payoutStatus: string; userStatus: string } | null>
  hasRequestedWithdrawal(creatorId: string): Promise<boolean>
  insertWithdrawal(w: Omit<WithdrawalMoney, 'id' | 'status'>): Promise<string>
  withdrawal(id: string, lock: boolean): Promise<WithdrawalMoney | null>
  setWithdrawal(
    id: string,
    patch: { status: string; partnerReference?: string | null; failureReason?: string | null },
  ): Promise<void>
  feeSettings(): Promise<WithdrawalFeeSettings>

  audit(e: AuditEntry): Promise<void>
}

export interface MoneyStore {
  /** Run fn in one database transaction. Everything commits together or not at all. */
  transaction<T>(fn: (tx: MoneyTx) => Promise<T>): Promise<T>
}
