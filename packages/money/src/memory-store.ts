// In-memory money store. Same contract as the Postgres store, including the checks the database
// enforces at commit (every transaction balances, guarded balances never go below zero), so the
// property tests can run the real engine code thousands of times quickly.
import { randomUUID } from 'node:crypto'
import type { WithdrawalFeeSettings } from './fees'
import {
  GUARDED_KINDS,
  type AccountRef,
  type AuditEntry,
  type CampaignMoney,
  type MoneyStore,
  type MoneyTx,
  type SubmissionMoney,
  type WithdrawalMoney,
} from './store'

type State = {
  accounts: { id: string; kind: AccountRef['kind']; ownerType: string; ownerId: string | null }[]
  transactions: {
    id: string
    kind: string
    idempotencyKey: string
    submissionId: string | null
    campaignId: string | null
    entries: { accountId: string; amountCents: number }[]
  }[]
  clients: Record<string, { serviceFeeBps: number }>
  campaigns: Record<string, CampaignMoney>
  creators: Record<string, { payoutStatus: string; userStatus: string }>
  submissions: Record<string, SubmissionMoney>
  withdrawals: Record<string, WithdrawalMoney>
  openHolds: Record<string, boolean>
  fees: WithdrawalFeeSettings
  audit: AuditEntry[]
}

const DEFAULT_FEES: WithdrawalFeeSettings = {
  withdrawal_fee_bps: 0,
  withdrawal_fee_min_cents: 0,
  withdrawal_min_cents: 2000,
}

export function createMemoryStore() {
  let state: State = {
    accounts: [],
    transactions: [],
    clients: {},
    campaigns: {},
    creators: {},
    submissions: {},
    withdrawals: {},
    openHolds: {},
    fees: { ...DEFAULT_FEES },
    audit: [],
  }
  let queue: Promise<unknown> = Promise.resolve()

  const balanceOf = (s: State, accountId: string) =>
    s.transactions.reduce(
      (n, t) => n + t.entries.reduce((m, e) => (e.accountId === accountId ? m + e.amountCents : m), 0),
      0,
    )

  function txFor(s: State): MoneyTx {
    return {
      async lockAccounts(refs) {
        return refs.map((r) => {
          let a = s.accounts.find((x) => x.kind === r.kind && x.ownerType === r.ownerType && x.ownerId === r.ownerId)
          if (!a) {
            a = { id: randomUUID(), kind: r.kind, ownerType: r.ownerType, ownerId: r.ownerId }
            s.accounts.push(a)
          }
          return a.id
        })
      },
      async balance(id) {
        return balanceOf(s, id)
      },
      async insertTransaction(t, entries) {
        const existing = s.transactions.find((x) => x.idempotencyKey === t.idempotencyKey)
        if (existing) return { id: existing.id, created: false }
        const id = randomUUID()
        s.transactions.push({
          id,
          kind: t.kind,
          idempotencyKey: t.idempotencyKey,
          submissionId: t.submissionId ?? null,
          campaignId: t.campaignId ?? null,
          entries: entries.map((e) => ({ ...e })),
        })
        return { id, created: true }
      },
      async transactionExists(key) {
        return s.transactions.some((t) => t.idempotencyKey === key)
      },
      async countSubmissionTransactions(id) {
        return s.transactions.filter((t) => t.submissionId === id).length
      },
      async countCampaignTransactions(campaignId, kind) {
        return s.transactions.filter((t) => t.campaignId === campaignId && t.kind === kind).length
      },
      async campaign(id) {
        return s.campaigns[id] ? { ...s.campaigns[id]! } : null
      },
      async setCampaignStatus(id, status) {
        s.campaigns[id]!.status = status
      },
      async setCampaignBudget(id, budgetCents) {
        s.campaigns[id]!.budgetCents = budgetCents
      },
      async clientServiceFeeBps(id) {
        return s.clients[id]?.serviceFeeBps ?? null
      },
      async submission(id) {
        return s.submissions[id] ? { ...s.submissions[id]! } : null
      },
      async setSubmission(id, patch) {
        Object.assign(s.submissions[id]!, patch)
      },
      async creatorEarnedInCampaign(creatorId, campaignId, exclude) {
        return Object.values(s.submissions)
          .filter((x) => x.creatorId === creatorId && x.campaignId === campaignId && x.id !== exclude)
          .reduce((n, x) => n + x.earnedCents, 0)
      },
      async hasOpenFlagOrAppeal(id) {
        return !!s.openHolds[id]
      },
      async lockCreator(id) {
        return s.creators[id] ? { ...s.creators[id]! } : null
      },
      async hasRequestedWithdrawal(creatorId) {
        return Object.values(s.withdrawals).some(
          (w) => w.creatorId === creatorId && (w.status === 'requested' || w.status === 'approved'),
        )
      },
      async insertWithdrawal(w) {
        const id = randomUUID()
        s.withdrawals[id] = { ...w, id, status: 'requested' }
        return id
      },
      async withdrawal(id) {
        return s.withdrawals[id] ? { ...s.withdrawals[id]! } : null
      },
      async setWithdrawal(id, patch) {
        s.withdrawals[id]!.status = patch.status
      },
      async feeSettings() {
        return { ...s.fees }
      },
      async audit(e) {
        s.audit.push(e)
      },
    }
  }

  // What the database's deferred trigger checks at commit.
  function checkCommit(s: State, before: number) {
    for (const t of s.transactions.slice(before)) {
      const sum = t.entries.reduce((n, e) => n + e.amountCents, 0)
      if (sum !== 0 || t.entries.length < 2) throw new Error(`ledger transaction ${t.id} does not balance`)
    }
    for (const a of s.accounts) {
      if (GUARDED_KINDS.includes(a.kind) && balanceOf(s, a.id) < 0)
        throw new Error(`ledger account ${a.id} would go below zero`)
    }
  }

  const store: MoneyStore = {
    transaction<T>(fn: (tx: MoneyTx) => Promise<T>): Promise<T> {
      const run = async () => {
        const draft = structuredClone(state)
        const result = await fn(txFor(draft))
        checkCommit(draft, state.transactions.length)
        state = draft
        return result
      }
      const p = queue.then(run, run)
      queue = p.catch(() => {})
      return p
    },
  }

  return {
    ...store,
    seed: {
      client: (c: { serviceFeeBps: number }) => {
        const id = randomUUID()
        state.clients[id] = { ...c }
        return id
      },
      campaign: (c: Omit<CampaignMoney, 'id'>) => {
        const id = randomUUID()
        state.campaigns[id] = { ...c, id }
        return id
      },
      creator: (c: { payoutStatus: string; userStatus?: string }) => {
        const id = randomUUID()
        state.creators[id] = { payoutStatus: c.payoutStatus, userStatus: c.userStatus ?? 'active' }
        return id
      },
      submission: (x: Omit<SubmissionMoney, 'id' | 'earnedCents'>) => {
        const id = randomUUID()
        state.submissions[id] = { ...x, id, earnedCents: 0 }
        return id
      },
      setSubmission: (id: string, patch: Partial<SubmissionMoney>) => Object.assign(state.submissions[id]!, patch),
      setCampaign: (id: string, patch: Partial<CampaignMoney>) => Object.assign(state.campaigns[id]!, patch),
      setWithdrawal: (id: string, patch: Partial<WithdrawalMoney>) => Object.assign(state.withdrawals[id]!, patch),
      settings: (fees: WithdrawalFeeSettings) => {
        state.fees = { ...fees }
      },
    },
    inspect: () => ({
      transactions: state.transactions.map((t) => ({
        id: t.id,
        kind: t.kind,
        idempotencyKey: t.idempotencyKey,
        entries: t.entries.map((e) => ({ ...e })),
      })),
      accounts: state.accounts.map((a) => ({ ...a })),
      submissions: Object.values(state.submissions).map((x) => ({
        id: x.id,
        creatorId: x.creatorId,
        campaignId: x.campaignId,
        earnedCents: x.earnedCents,
        state: x.state,
      })),
    }),
  }
}
