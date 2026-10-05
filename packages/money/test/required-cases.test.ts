// The 13 required cases from 02_DATA_AND_MONEY.md section 7, run through the money engine
// against a real Postgres database. All amounts are whole cents.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  accrueEarnings,
  markWithdrawalFailed,
  releaseEarnings,
  requestWithdrawal,
  reverseEarnings,
  serviceFeeCents,
  withdrawalQuote,
} from '../src'
import {
  balanceOf,
  campaign,
  connect,
  fundedCampaign,
  makeSubmission,
  makeUser,
  setCountedViews,
  submission,
  transactionsFor,
} from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

const FEES = { withdrawal_fee_bps: 500, withdrawal_fee_min_cents: 300, withdrawal_min_cents: 2000 }

async function setFeeSettings(s: typeof FEES) {
  for (const [key, value] of Object.entries(s)) {
    await db
      .insert(tables.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: tables.settings.key, set: { value } })
  }
}

describe('Setup A: budget 100,000, rate 200, cap per post 30,000, cap per creator 50,000, min views 1,000', () => {
  it('1. a post with 800 counted views earns 0 (below the minimum)', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 800 })
    const r = await accrueEarnings(store, { submissionId: s })
    expect(r.postCents).toBe(0)
    expect((await submission(db, s)).earnedCents).toBe(0)
    expect(await transactionsFor(db, s)).toHaveLength(0)
  })

  it('2. a post with 2,500 counted views earns floor(2500 * 200 / 1000) = 500', async () => {
    const c = await fundedCampaign(ctx)
    const creator = await makeUser(db)
    const s = await makeSubmission(db, c, creator, { countedViews: 2_500 })
    const r = await accrueEarnings(store, { submissionId: s })
    expect(r.postCents).toBe(500)
    expect((await submission(db, s)).earnedCents).toBe(500)
    expect(await balanceOf(db, 'creator_pending', creator)).toBe(500)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(99_500)
  })

  it('3. a post with 250,000 counted views is capped at 30,000 (raw 50,000)', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 250_000 })
    const r = await accrueEarnings(store, { submissionId: s })
    expect(r.rawCents).toBe(50_000)
    expect(r.postCents).toBe(30_000)
  })

  it('4. a second post by the same creator is limited by the creator cap: 20,000', async () => {
    const c = await fundedCampaign(ctx)
    const creator = await makeUser(db)
    const first = await makeSubmission(db, c, creator, { countedViews: 250_000 })
    await accrueEarnings(store, { submissionId: first })
    const second = await makeSubmission(db, c, creator, { countedViews: 200_000 })
    const r = await accrueEarnings(store, { submissionId: second })
    expect(r.rawCents).toBe(40_000)
    expect(r.postCents).toBe(20_000)
    expect(await balanceOf(db, 'creator_pending', creator)).toBe(50_000)
  })

  it('5. views drop from 10,000 to 9,000 counted: delta -200, earning_reversed 200', async () => {
    const c = await fundedCampaign(ctx)
    const creator = await makeUser(db)
    const s = await makeSubmission(db, c, creator, { countedViews: 10_000 })
    await accrueEarnings(store, { submissionId: s })
    expect((await submission(db, s)).earnedCents).toBe(2_000)
    await setCountedViews(db, s, 9_000)
    const r = await accrueEarnings(store, { submissionId: s })
    expect(r.deltaCents).toBe(-200)
    const txs = await transactionsFor(db, s)
    expect(txs.map((t) => t.kind).sort()).toEqual(['earning_accrued', 'earning_reversed'])
    expect((await submission(db, s)).earnedCents).toBe(1_800)
    expect(await balanceOf(db, 'creator_pending', creator)).toBe(1_800)
  })

  it('6. with 5,000 left and a post owed 8,000, the post earns 5,000 and the campaign moves to closing', async () => {
    const c = await fundedCampaign(ctx, { budgetCents: 5_000 })
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 40_000 })
    const r = await accrueEarnings(store, { submissionId: s })
    expect(r.rawCents).toBe(8_000)
    expect(r.postCents).toBe(5_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(0)
    expect((await campaign(db, c.campaignId)).status).toBe('closing')
  })

  it('7. running the same view check twice posts one transaction only', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 5_000 })
    await accrueEarnings(store, { submissionId: s })
    await accrueEarnings(store, { submissionId: s })
    expect(await transactionsFor(db, s)).toHaveLength(1)
    expect((await submission(db, s)).earnedCents).toBe(1_000)
  })

  it('8. rejecting an approved post that earned 12,000 moves 12,000 from pending back to the budget', async () => {
    const c = await fundedCampaign(ctx)
    const creator = await makeUser(db)
    const s = await makeSubmission(db, c, creator, { countedViews: 60_000 })
    await accrueEarnings(store, { submissionId: s })
    expect(await balanceOf(db, 'creator_pending', creator)).toBe(12_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(88_000)
    await reverseEarnings(store, { submissionId: s, actorId: null })
    expect(await balanceOf(db, 'creator_pending', creator)).toBe(0)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(100_000)
    expect((await submission(db, s)).earnedCents).toBe(0)
  })

  it('9. a rate change from 200 to 300 after submission still pays at 200', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 10_000, rateLocked: 200 })
    await db.update(tables.campaigns).set({ rateCentsPer1000: 300 }).where(eq(tables.campaigns.id, c.campaignId))
    const r = await accrueEarnings(store, { submissionId: s })
    expect(r.postCents).toBe(2_000)
  })
})

describe('fees and withdrawals', () => {
  it('10. a client service fee of 1,000 bps on a 100,000 budget is 10,000; the client pays 110,000', async () => {
    expect(serviceFeeCents(100_000, 1_000)).toBe(10_000)
    const c = await fundedCampaign(ctx, { budgetCents: 100_000 }, 1_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(100_000)
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(0)
    const funded = await db
      .select()
      .from(tables.ledgerTransactions)
      .where(eq(tables.ledgerTransactions.campaignId, c.campaignId))
    expect(funded.map((t) => t.kind).sort()).toEqual(['campaign_funded', 'service_fee_taken'])
  })

  it('11. a 10,000 withdrawal with fee 500 bps and minimum fee 300 has fee 500, net 9,500', () => {
    expect(withdrawalQuote(10_000, FEES)).toEqual({ ok: true, amountCents: 10_000, feeCents: 500, netCents: 9_500 })
  })

  it('12. a 3,000 withdrawal with fee 500 bps and minimum fee 300 has fee 300, net 2,700', () => {
    expect(withdrawalQuote(3_000, FEES)).toEqual({ ok: true, amountCents: 3_000, feeCents: 300, netCents: 2_700 })
  })

  it('13. a withdrawal that fails after being sent restores the creator available balance in full', async () => {
    await setFeeSettings(FEES)
    const c = await fundedCampaign(ctx)
    const creator = await makeUser(db, { payoutStatus: 'verified' })
    const s = await makeSubmission(db, c, creator, { countedViews: 50_000 })
    await accrueEarnings(store, { submissionId: s })
    await db.update(tables.submissions).set({ state: 'final' }).where(eq(tables.submissions.id, s))
    await releaseEarnings(store, { submissionId: s })
    expect(await balanceOf(db, 'creator_available', creator)).toBe(10_000)

    const inTransitBefore = await balanceOf(db, 'payout_in_transit', null)
    const revenueBefore = await balanceOf(db, 'platform_revenue', null)
    const w = await requestWithdrawal(store, { creatorId: creator, amountCents: 10_000, method: 'paypal' })
    expect(w).toMatchObject({ feeCents: 500, netCents: 9_500 })
    expect(await balanceOf(db, 'creator_available', creator)).toBe(0)
    await db.update(tables.withdrawals).set({ status: 'sent' }).where(eq(tables.withdrawals.id, w.id))

    await markWithdrawalFailed(store, { withdrawalId: w.id, reason: 'Partner rejected the account', actorId: null })
    expect(await balanceOf(db, 'creator_available', creator)).toBe(10_000)
    // No fee is taken on a failed withdrawal and nothing stays in transit.
    expect(await balanceOf(db, 'payout_in_transit', null)).toBe(inTransitBefore)
    expect(await balanceOf(db, 'platform_revenue', null)).toBe(revenueBefore)
  })
})
