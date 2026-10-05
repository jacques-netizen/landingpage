// A small "world" the property tests drive: seed clients, campaigns, creators and submissions,
// change what the outside world controls (views, states), and read back the ledger.
// The same scenarios run against the in-memory store and against real Postgres.
import { tables } from '@mde/db'
import { eq, sql } from 'drizzle-orm'
import { createMemoryStore, type MoneyStore } from '../src'
import { connect } from './fixtures'

export type LedgerView = {
  transactions: {
    id: string
    kind: string
    idempotencyKey: string
    entries: { accountId: string; amountCents: number }[]
  }[]
  accounts: { id: string; kind: string; ownerType: string | null; ownerId: string | null }[]
  submissions: { id: string; creatorId: string; campaignId: string; earnedCents: number; state: string }[]
}

export interface World {
  store: MoneyStore
  client(feeBps: number): Promise<string>
  campaign(
    clientId: string,
    o: { budgetCents: number; rate: number; capPost: number | null; capCreator: number | null; minViews: number },
  ): Promise<string>
  creator(verified: boolean): Promise<string>
  submission(campaignId: string, creatorId: string, rateLocked: number): Promise<string>
  setViews(submissionId: string, counted: number): Promise<void>
  setSubmissionState(submissionId: string, state: string): Promise<void>
  setCampaignStatus(campaignId: string, status: string): Promise<void>
  setWithdrawalStatus(withdrawalId: string, status: string): Promise<void>
  setFeeSettings(s: {
    withdrawal_fee_bps: number
    withdrawal_fee_min_cents: number
    withdrawal_min_cents: number
  }): Promise<void>
  ledger(): Promise<LedgerView>
  close(): Promise<void>
}

export function memoryWorld(): World {
  const mem = createMemoryStore()
  return {
    store: mem,
    client: async (feeBps) => mem.seed.client({ serviceFeeBps: feeBps }),
    campaign: async (clientId, o) =>
      mem.seed.campaign({
        clientId,
        budgetCents: o.budgetCents,
        capPerPostCents: o.capPost,
        capPerCreatorCents: o.capCreator,
        minViewsToEarn: o.minViews,
        status: 'awaiting_funding',
      }),
    creator: async (verified) => mem.seed.creator({ payoutStatus: verified ? 'verified' : 'none' }),
    submission: async (campaignId, creatorId, rateLocked) =>
      mem.seed.submission({
        campaignId,
        creatorId,
        rateCentsPer1000Locked: rateLocked,
        state: 'approved',
        countedViews: 0,
      }),
    setViews: async (id, countedViews) => {
      mem.seed.setSubmission(id, { countedViews })
    },
    setSubmissionState: async (id, state) => {
      mem.seed.setSubmission(id, { state })
    },
    setCampaignStatus: async (id, status) => {
      mem.seed.setCampaign(id, { status })
    },
    setWithdrawalStatus: async (id, status) => {
      mem.seed.setWithdrawal(id, { status })
    },
    setFeeSettings: async (s) => mem.seed.settings(s),
    ledger: async () => mem.inspect(),
    close: async () => {},
  }
}

export function postgresWorld(): World {
  const ctx = connect(10)
  const { db, store } = ctx
  let n = 0
  return {
    store,
    async client(feeBps) {
      const [c] = await db.insert(tables.clients).values({ name: 'Property client', serviceFeeBps: feeBps }).returning()
      return c!.id
    },
    async campaign(clientId, o) {
      const [c] = await db
        .insert(tables.campaigns)
        .values({
          clientId,
          type: 'clipping',
          title: 'Property campaign',
          platforms: ['tiktok'],
          budgetCents: o.budgetCents,
          rateCentsPer1000: o.rate,
          capPerPostCents: o.capPost,
          capPerCreatorCents: o.capCreator,
          minViewsToEarn: o.minViews,
          status: 'awaiting_funding',
        })
        .returning()
      const [t] = await db
        .insert(tables.termsVersions)
        .values({ campaignId: c!.id, bodyMarkdown: 'Terms', effectiveAt: new Date() })
        .returning()
      await db.update(tables.campaigns).set({ currentTermsVersionId: t!.id }).where(eq(tables.campaigns.id, c!.id))
      return c!.id
    },
    async creator(verified) {
      const [u] = await db
        .insert(tables.users)
        .values({ email: `prop-${Date.now()}-${++n}@test.invalid` })
        .returning()
      await db.insert(tables.creatorProfiles).values({ userId: u!.id, payoutStatus: verified ? 'verified' : 'none' })
      return u!.id
    },
    async submission(campaignId, creatorId, rateLocked) {
      const [c] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, campaignId))
      const [s] = await db
        .insert(tables.submissions)
        .values({
          campaignId,
          creatorId,
          platform: 'tiktok',
          postUrl: `https://www.tiktok.com/@p/video/${++n}`,
          platformPostId: `p${Date.now()}${n}`,
          state: 'approved',
          termsVersionId: c!.currentTermsVersionId!,
          rateCentsPer1000Locked: rateLocked,
          submittedAt: new Date(),
        })
        .returning()
      return s!.id
    },
    async setViews(id, countedViews) {
      await db
        .update(tables.submissions)
        .set({ countedViews, latestViews: countedViews })
        .where(eq(tables.submissions.id, id))
    },
    async setSubmissionState(id, state) {
      await db.update(tables.submissions).set({ state }).where(eq(tables.submissions.id, id))
    },
    async setCampaignStatus(id, status) {
      await db.update(tables.campaigns).set({ status }).where(eq(tables.campaigns.id, id))
    },
    async setWithdrawalStatus(id, status) {
      await db.update(tables.withdrawals).set({ status }).where(eq(tables.withdrawals.id, id))
    },
    async setFeeSettings(s) {
      for (const [key, value] of Object.entries(s))
        await db
          .insert(tables.settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: tables.settings.key, set: { value } })
    },
    async ledger() {
      const txs = await db.select().from(tables.ledgerTransactions)
      const entries = await db.select().from(tables.ledgerEntries)
      const accounts = await db.select().from(tables.ledgerAccounts)
      const subs = await db.execute<{
        id: string
        creator_id: string
        campaign_id: string
        earned_cents: string
        state: string
      }>(sql`select id, creator_id, campaign_id, earned_cents, state from submissions`)
      return {
        transactions: txs.map((t) => ({
          id: t.id,
          kind: t.kind,
          idempotencyKey: t.idempotencyKey,
          entries: entries
            .filter((e) => e.transactionId === t.id)
            .map((e) => ({ accountId: e.accountId, amountCents: e.amountCents })),
        })),
        accounts: accounts.map((a) => ({ id: a.id, kind: a.kind, ownerType: a.ownerType, ownerId: a.ownerId })),
        submissions: subs.map((s) => ({
          id: s.id,
          creatorId: s.creator_id,
          campaignId: s.campaign_id,
          earnedCents: Number(s.earned_cents),
          state: s.state,
        })),
      }
    },
    close: () => ctx.client.end(),
  }
}
