import { afterAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import {
  auditLog,
  campaigns,
  ledgerTransactions,
  ledgerEntries,
  reviewDecisions,
  submissions,
  withdrawals,
} from '@mde/db'
import {
  SETUP_A,
  makeCampaign,
  makeCreator,
  makeSubmission,
  testDb,
  type Db,
} from '../../test/world'
import {
  accounts,
  applyEarnings,
  balanceOf,
  fundCampaign,
  recordClientFunding,
  releaseEarnings,
  requestWithdrawal,
  markWithdrawalPaid,
  markWithdrawalFailed,
  markWithdrawalSent,
  reverseEarnings,
  postTransaction,
} from './index'

const { db, sql: pg } = testDb()
afterAll(() => pg.end())

async function funded(setup = SETUP_A) {
  const w = await makeCampaign(db, setup)
  const feeBps = setup.serviceFeeBps ?? 0
  const fee = (setup.budgetCents * BigInt(feeBps) + 5000n) / 10000n
  await recordClientFunding(db, {
    clientId: w.client.id,
    amountCents: setup.budgetCents + fee,
    reference: `r-${w.campaign.id}`,
    campaignId: w.campaign.id,
    actorId: null,
  })
  await fundCampaign(db, { campaignId: w.campaign.id, actorId: null })
  return w
}

async function post(
  w: Awaited<ReturnType<typeof funded>>,
  creatorId: string,
  views: number,
  rate = w.campaign.rateCentsPer1000,
) {
  const s = await makeSubmission(db, {
    campaignId: w.campaign.id,
    creatorId,
    termsId: w.termsId,
    rateLocked: rate,
    state: 'approved',
    baselineViews: 0,
    latestViews: views,
  })
  return s
}

const budget = (w: Awaited<ReturnType<typeof funded>>) =>
  accounts.campaignBudget(db, w.campaign.id).then((id) => balanceOf(db, id))
const pending = (creatorId: string) =>
  accounts.creatorPending(db, creatorId).then((id) => balanceOf(db, id))
const available = (creatorId: string) =>
  accounts.creatorAvailable(db, creatorId).then((id) => balanceOf(db, id))

describe('funding', () => {
  it('case 10 on the ledger: fee 10,000 on budget 100,000, client pays 110,000', async () => {
    const w = await funded({ ...SETUP_A, serviceFeeBps: 1000 })
    expect(await budget(w)).toBe(100_000n)
    expect(await balanceOf(db, await accounts.clientHolding(db, w.client.id))).toBe(0n)
    const revenue = await accounts.platformRevenue(db)
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.campaignId, w.campaign.id))
    expect(rows.map((r) => r.kind).sort()).toEqual([
      'campaign_funded',
      'client_funding_received',
      'service_fee_taken',
    ])
    expect(await balanceOf(db, revenue)).toBeGreaterThanOrEqual(10_000n)
  })

  it('refuses to fund a campaign when the client has paid less than budget plus fee', async () => {
    const w = await makeCampaign(db, { ...SETUP_A, serviceFeeBps: 1000 })
    await recordClientFunding(db, {
      clientId: w.client.id,
      amountCents: 100_000n,
      reference: `short-${w.campaign.id}`,
      actorId: null,
    })
    await expect(fundCampaign(db, { campaignId: w.campaign.id, actorId: null })).rejects.toThrow(
      /fund/i,
    )
    expect(await budget(w)).toBe(0n)
  })

  it('funding twice does nothing the second time', async () => {
    const w = await funded()
    await fundCampaign(db, { campaignId: w.campaign.id, actorId: null })
    expect(await budget(w)).toBe(100_000n)
  })
})

describe('earnings engine on the ledger', () => {
  it('case 2: moves 500 from the budget into pending', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 2_500)
    const r = await applyEarnings(db, s.id)
    expect(r.deltaCents).toBe(500n)
    expect(await budget(w)).toBe(99_500n)
    expect(await pending(c.id)).toBe(500n)
    const [row] = await db.select().from(submissions).where(eq(submissions.id, s.id))
    expect(row?.earnedCents).toBe(500n)
    expect(row?.countedViews).toBe(2_500)
    expect(row?.state).toBe('earning')
  })

  it('case 1: below the minimum posts nothing and stays approved', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 800)
    const r = await applyEarnings(db, s.id)
    expect(r.deltaCents).toBe(0n)
    expect(r.transactionId).toBeNull()
    expect(await pending(c.id)).toBe(0n)
    const [row] = await db.select().from(submissions).where(eq(submissions.id, s.id))
    expect(row?.state).toBe('approved')
  })

  it('case 4 on the ledger: the second post is limited by the creator cap', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s1 = await post(w, c.id, 250_000)
    const s2 = await post(w, c.id, 200_000)
    await applyEarnings(db, s1.id)
    await applyEarnings(db, s2.id)
    const [r1] = await db.select().from(submissions).where(eq(submissions.id, s1.id))
    const [r2] = await db.select().from(submissions).where(eq(submissions.id, s2.id))
    expect(r1?.earnedCents).toBe(30_000n)
    expect(r2?.earnedCents).toBe(20_000n)
    expect(await pending(c.id)).toBe(50_000n)
  })

  it('case 5 on the ledger: views corrected down post an earning_reversed for 200', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    expect(await pending(c.id)).toBe(2_000n)
    await db.update(submissions).set({ latestViews: 9_000 }).where(eq(submissions.id, s.id))
    const r = await applyEarnings(db, s.id)
    expect(r.deltaCents).toBe(-200n)
    expect(await pending(c.id)).toBe(1_800n)
    expect(await budget(w)).toBe(98_200n)
    const kinds = await db
      .select({ kind: ledgerTransactions.kind })
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.submissionId, s.id))
    expect(kinds.map((k) => k.kind).sort()).toEqual(['earning_accrued', 'earning_reversed'])
  })

  it('views going down and back up to the same number pays again (idempotency keys do not collide)', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    await db.update(submissions).set({ latestViews: 9_000 }).where(eq(submissions.id, s.id))
    await applyEarnings(db, s.id)
    await db.update(submissions).set({ latestViews: 10_000 }).where(eq(submissions.id, s.id))
    await applyEarnings(db, s.id)
    expect(await pending(c.id)).toBe(2_000n)
    const [row] = await db.select().from(submissions).where(eq(submissions.id, s.id))
    expect(row?.earnedCents).toBe(2_000n)
  })

  it('case 6: budget of 5,000 pays 5,000 and the campaign moves to closing', async () => {
    const w = await funded({ budgetCents: 5_000n, rateCentsPer1000: 200, minViewsToEarn: 1000 })
    const c = await makeCreator(db)
    const s = await post(w, c.id, 40_000) // owed 8,000
    const r = await applyEarnings(db, s.id)
    expect(r.deltaCents).toBe(5_000n)
    expect(await budget(w)).toBe(0n)
    const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, w.campaign.id))
    expect(camp?.status).toBe('closing')
    expect(r.campaignClosing).toBe(true)
  })

  it('once a campaign is closing, views stop adding earnings but corrections down still apply', async () => {
    const w = await funded({ budgetCents: 5_000n, rateCentsPer1000: 200, minViewsToEarn: 1000 })
    const c = await makeCreator(db)
    const s = await post(w, c.id, 40_000)
    await applyEarnings(db, s.id)
    await db.update(submissions).set({ latestViews: 90_000 }).where(eq(submissions.id, s.id))
    expect((await applyEarnings(db, s.id)).deltaCents).toBe(0n)
    await db.update(submissions).set({ latestViews: 10_000 }).where(eq(submissions.id, s.id))
    expect((await applyEarnings(db, s.id)).deltaCents).toBe(-3_000n)
    expect(await budget(w)).toBe(3_000n)
  })

  it('case 7: the same view check run twice makes one transaction only', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 5_000)
    await applyEarnings(db, s.id)
    const second = await applyEarnings(db, s.id)
    expect(second.deltaCents).toBe(0n)
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.submissionId, s.id))
    expect(rows).toHaveLength(1)
    expect(await pending(c.id)).toBe(1_000n)
  })

  it('case 7 with a repeated idempotency key: postTransaction returns the first transaction and changes nothing', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const key = `test-key-${w.campaign.id}`
    const budgetAcc = await accounts.campaignBudget(db, w.campaign.id)
    const pendingAcc = await accounts.creatorPending(db, c.id)
    const entries = [
      { accountId: budgetAcc, amountCents: -700n },
      { accountId: pendingAcc, amountCents: 700n },
    ]
    const first = await db.transaction((tx) =>
      postTransaction(tx, {
        kind: 'earning_accrued',
        idempotencyKey: key,
        entries,
        campaignId: w.campaign.id,
        creatorId: c.id,
      }),
    )
    const again = await db.transaction((tx) =>
      postTransaction(tx, {
        kind: 'earning_accrued',
        idempotencyKey: key,
        entries,
        campaignId: w.campaign.id,
        creatorId: c.id,
      }),
    )
    expect(first.created).toBe(true)
    expect(again.created).toBe(false)
    expect(again.transactionId).toBe(first.transactionId)
    expect(await pending(c.id)).toBe(700n)
  })

  it('case 9: a rate change after submitting does not change what the post pays', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000, 200)
    await db.update(campaigns).set({ rateCentsPer1000: 300 }).where(eq(campaigns.id, w.campaign.id))
    await applyEarnings(db, s.id)
    expect(await pending(c.id)).toBe(2_000n)
  })

  it('does not pay submissions that are not approved or earning', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await makeSubmission(db, {
      campaignId: w.campaign.id,
      creatorId: c.id,
      termsId: w.termsId,
      rateLocked: 200,
      state: 'needs_review',
      latestViews: 50_000,
    })
    const r = await applyEarnings(db, s.id)
    expect(r.deltaCents).toBe(0n)
    expect(await pending(c.id)).toBe(0n)
  })
})

describe('reversal (docs/02 section 5.5)', () => {
  it('case 8: rejecting an approved post that had earned 12,000 reverses it exactly', async () => {
    const w = await funded({ budgetCents: 1_000_000n, rateCentsPer1000: 200, minViewsToEarn: 0 })
    const c = await makeCreator(db)
    const reviewer = await makeCreator(db)
    const s = await post(w, c.id, 60_000) // 12,000
    await applyEarnings(db, s.id)
    expect(await pending(c.id)).toBe(12_000n)
    const budgetBefore = await budget(w)
    await reverseEarnings(db, {
      submissionId: s.id,
      toState: 'rejected',
      outcome: 'reject',
      reasonCode: 'not_original',
      note: 'test',
      actorId: reviewer.id,
    })
    expect(await pending(c.id)).toBe(0n)
    expect(await budget(w)).toBe(budgetBefore + 12_000n)
    const [row] = await db.select().from(submissions).where(eq(submissions.id, s.id))
    expect(row?.earnedCents).toBe(0n)
    expect(row?.state).toBe('rejected')
    expect(row?.reasonCode).toBe('not_original')
    const decisions = await db
      .select()
      .from(reviewDecisions)
      .where(eq(reviewDecisions.submissionId, s.id))
    expect(decisions).toHaveLength(1)
    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, s.id))
    expect(audits.some((a) => a.action === 'submission.reject' && a.actorId === reviewer.id)).toBe(
      true,
    )
  })

  it('a rejected post no longer earns when the next view check runs', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const reviewer = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    await reverseEarnings(db, {
      submissionId: s.id,
      toState: 'rejected',
      outcome: 'reject',
      reasonCode: 'other',
      actorId: reviewer.id,
    })
    await applyEarnings(db, s.id)
    expect(await pending(c.id)).toBe(0n)
  })

  it('rejecting twice posts the reversal once', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const reviewer = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    await reverseEarnings(db, {
      submissionId: s.id,
      toState: 'rejected',
      outcome: 'reject',
      reasonCode: 'other',
      actorId: reviewer.id,
    })
    await reverseEarnings(db, {
      submissionId: s.id,
      toState: 'rejected',
      outcome: 'reject',
      reasonCode: 'other',
      actorId: reviewer.id,
    })
    const kinds = await db
      .select({ kind: ledgerTransactions.kind })
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.submissionId, s.id))
    expect(kinds.filter((k) => k.kind === 'earning_reversed')).toHaveLength(1)
  })

  it('a human decision always needs an actor', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await expect(
      reverseEarnings(db, {
        submissionId: s.id,
        toState: 'rejected',
        outcome: 'reject',
        reasonCode: 'other',
        actorId: null,
      }),
    ).rejects.toThrow(/actor/i)
  })
})

describe('release', () => {
  it('moves earned cents from pending to available once, and marks the post paid out', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    await db.update(submissions).set({ state: 'final' }).where(eq(submissions.id, s.id))
    await releaseEarnings(db, s.id)
    await releaseEarnings(db, s.id)
    expect(await pending(c.id)).toBe(0n)
    expect(await available(c.id)).toBe(2_000n)
    const [row] = await db.select().from(submissions).where(eq(submissions.id, s.id))
    expect(row?.state).toBe('paid_out')
  })

  it('waits while a fraud flag or an appeal is open', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    await db.update(submissions).set({ state: 'final' }).where(eq(submissions.id, s.id))
    await db.execute(
      sql`insert into fraud_flags (submission_id, kind) values (${s.id}, 'view_jump')`,
    )
    const r = await releaseEarnings(db, s.id)
    expect(r.released).toBe(false)
    expect(await available(c.id)).toBe(0n)
  })

  it('only releases posts that are final', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 10_000)
    await applyEarnings(db, s.id)
    expect((await releaseEarnings(db, s.id)).released).toBe(false)
  })
})

describe('withdrawals', () => {
  async function creatorWithAvailable(cents: bigint, verified = true) {
    const w = await funded({ budgetCents: 10_000_000n, rateCentsPer1000: 1000, minViewsToEarn: 0 })
    const c = await makeCreator(db, { payoutVerified: verified })
    // 1,000 cents per 1,000 views: each view is one cent.
    const s = await post(w, c.id, Number(cents))
    await applyEarnings(db, s.id)
    await db.update(submissions).set({ state: 'final' }).where(eq(submissions.id, s.id))
    await releaseEarnings(db, s.id)
    return { w, c }
  }

  it('case 11 on the ledger: 10,000 with fee 500 bps and minimum 300 pays 9,500 and takes fee 500 only when paid', async () => {
    await db.execute(
      sql`insert into settings (key, value) values ('withdrawal_fee_bps', '500'::jsonb), ('withdrawal_fee_min_cents', '300'::jsonb) on conflict (key) do update set value = excluded.value`,
    )
    try {
      const { c } = await creatorWithAvailable(10_000n)
      const revenueBefore = await balanceOf(db, await accounts.platformRevenue(db))
      const wd = await requestWithdrawal(db, {
        creatorId: c.id,
        amountCents: 10_000n,
        method: 'stripe_connect',
      })
      expect(wd.feeCents).toBe(500n)
      expect(wd.netCents).toBe(9_500n)
      expect(await available(c.id)).toBe(0n)
      expect(await balanceOf(db, await accounts.payoutInTransit(db))).toBeGreaterThanOrEqual(
        10_000n,
      )
      // No fee has been taken yet.
      expect(await balanceOf(db, await accounts.platformRevenue(db))).toBe(revenueBefore)

      await markWithdrawalSent(db, { withdrawalId: wd.id })
      await markWithdrawalPaid(db, { withdrawalId: wd.id, partnerReference: 'tr_123' })
      expect(await balanceOf(db, await accounts.platformRevenue(db))).toBe(revenueBefore + 500n)
      const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, wd.id))
      expect(row?.status).toBe('paid')
      expect(row?.partnerReference).toBe('tr_123')
    } finally {
      await db.execute(
        sql`delete from settings where key in ('withdrawal_fee_bps','withdrawal_fee_min_cents')`,
      )
    }
  })

  it('case 12 on the ledger: 3,000 pays the minimum fee 300 and nets 2,700', async () => {
    await db.execute(
      sql`insert into settings (key, value) values ('withdrawal_fee_bps', '500'::jsonb), ('withdrawal_fee_min_cents', '300'::jsonb), ('withdrawal_min_cents', '1000'::jsonb) on conflict (key) do update set value = excluded.value`,
    )
    try {
      const { c } = await creatorWithAvailable(3_000n)
      const wd = await requestWithdrawal(db, {
        creatorId: c.id,
        amountCents: 3_000n,
        method: 'paypal',
      })
      expect(wd.feeCents).toBe(300n)
      expect(wd.netCents).toBe(2_700n)
    } finally {
      await db.execute(
        sql`delete from settings where key in ('withdrawal_fee_bps','withdrawal_fee_min_cents','withdrawal_min_cents')`,
      )
    }
  })

  it('case 13: a withdrawal that fails after being sent restores available in full and takes no fee', async () => {
    await db.execute(
      sql`insert into settings (key, value) values ('withdrawal_fee_bps', '500'::jsonb) on conflict (key) do update set value = excluded.value`,
    )
    try {
      const { c } = await creatorWithAvailable(10_000n)
      const revenueBefore = await balanceOf(db, await accounts.platformRevenue(db))
      const wd = await requestWithdrawal(db, {
        creatorId: c.id,
        amountCents: 10_000n,
        method: 'stripe_connect',
      })
      await markWithdrawalSent(db, { withdrawalId: wd.id })
      await markWithdrawalFailed(db, { withdrawalId: wd.id, reason: 'account_closed' })
      expect(await available(c.id)).toBe(10_000n)
      expect(await balanceOf(db, await accounts.platformRevenue(db))).toBe(revenueBefore)
      const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, wd.id))
      expect(row?.status).toBe('failed')
      expect(row?.failureReason).toBe('account_closed')
    } finally {
      await db.execute(sql`delete from settings where key = 'withdrawal_fee_bps'`)
    }
  })

  it('marking a withdrawal paid or failed twice changes nothing the second time', async () => {
    const { c } = await creatorWithAvailable(5_000n)
    const wd = await requestWithdrawal(db, {
      creatorId: c.id,
      amountCents: 5_000n,
      method: 'stripe_connect',
    })
    await markWithdrawalSent(db, { withdrawalId: wd.id })
    await markWithdrawalFailed(db, { withdrawalId: wd.id, reason: 'x' })
    await markWithdrawalFailed(db, { withdrawalId: wd.id, reason: 'x' })
    expect(await available(c.id)).toBe(5_000n)
    await expect(markWithdrawalPaid(db, { withdrawalId: wd.id })).rejects.toThrow()
  })

  it('needs a verified payout status', async () => {
    const { c } = await creatorWithAvailable(5_000n, false)
    await expect(
      requestWithdrawal(db, { creatorId: c.id, amountCents: 5_000n, method: 'paypal' }),
    ).rejects.toThrow(/payout/i)
    expect(await available(c.id)).toBe(5_000n)
  })

  it('refuses amounts below the minimum and above the available balance', async () => {
    const { c } = await creatorWithAvailable(5_000n)
    await expect(
      requestWithdrawal(db, { creatorId: c.id, amountCents: 1_999n, method: 'paypal' }),
    ).rejects.toThrow(/minimum/i)
    await expect(
      requestWithdrawal(db, { creatorId: c.id, amountCents: 5_001n, method: 'paypal' }),
    ).rejects.toThrow(/available/i)
  })

  it('allows only one open request per creator', async () => {
    const { c } = await creatorWithAvailable(8_000n)
    await requestWithdrawal(db, { creatorId: c.id, amountCents: 2_500n, method: 'paypal' })
    await expect(
      requestWithdrawal(db, { creatorId: c.id, amountCents: 2_500n, method: 'paypal' }),
    ).rejects.toThrow(/open/i)
    expect(await available(c.id)).toBe(5_500n)
  })
})

describe('ledger integrity in the database', () => {
  it('rejects an unbalanced transaction at commit', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const a = await accounts.campaignBudget(db, w.campaign.id)
    const b = await accounts.creatorPending(db, c.id)
    await expect(
      db.transaction(async (tx) => {
        const [t] = await tx
          .insert(ledgerTransactions)
          .values({ kind: 'manual_adjustment', idempotencyKey: `unbalanced-${w.campaign.id}` })
          .returning()
        await tx.insert(ledgerEntries).values([
          { transactionId: t!.id, accountId: a, amountCents: -100n },
          { transactionId: t!.id, accountId: b, amountCents: 99n },
        ])
      }),
    ).rejects.toThrow(/balance|sum/i)
  })

  it('rejects a transaction with no entries', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx
          .insert(ledgerTransactions)
          .values({ kind: 'manual_adjustment', idempotencyKey: `empty-${crypto.randomUUID()}` })
      }),
    ).rejects.toThrow()
  })

  it('refuses to take a campaign budget below zero even if code tries to', async () => {
    const w = await funded({ budgetCents: 1_000n, rateCentsPer1000: 200 })
    const c = await makeCreator(db)
    const a = await accounts.campaignBudget(db, w.campaign.id)
    const b = await accounts.creatorPending(db, c.id)
    await expect(
      db.transaction((tx) =>
        postTransaction(tx, {
          kind: 'manual_adjustment',
          idempotencyKey: `overdraw-${w.campaign.id}`,
          entries: [
            { accountId: a, amountCents: -1_001n },
            { accountId: b, amountCents: 1_001n },
          ],
        }),
      ),
    ).rejects.toThrow(/below zero|negative/i)
    expect(await balanceOf(db, a)).toBe(1_000n)
  })

  it('refuses to take creator available below zero', async () => {
    const c = await makeCreator(db)
    const ext = await accounts.external(db)
    const av = await accounts.creatorAvailable(db, c.id)
    await expect(
      db.transaction((tx) =>
        postTransaction(tx, {
          kind: 'manual_adjustment',
          idempotencyKey: `av-${c.id}`,
          entries: [
            { accountId: av, amountCents: -1n },
            { accountId: ext, amountCents: 1n },
          ],
        }),
      ),
    ).rejects.toThrow(/below zero|negative/i)
  })

  it('money rows cannot be edited or deleted', async () => {
    const w = await funded()
    const [t] = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.campaignId, w.campaign.id))
      .limit(1)
    await expect(
      db.execute(sql`update ledger_entries set amount_cents = 1 where transaction_id = ${t!.id}`),
    ).rejects.toThrow()
    await expect(
      db.execute(sql`delete from ledger_transactions where id = ${t!.id}`),
    ).rejects.toThrow()
  })
})

describe('concurrency', () => {
  it('ten parallel earnings jobs on one campaign never overspend the budget', async () => {
    const w = await funded({ budgetCents: 5_000n, rateCentsPer1000: 1000, minViewsToEarn: 0 })
    const subs = []
    for (let i = 0; i < 10; i++) {
      const c = await makeCreator(db)
      subs.push(await post(w, c.id, 1_000)) // each is owed 1,000 cents
    }
    const results = await Promise.all(subs.map((s) => applyEarnings(db, s.id)))
    const paid = results.reduce((sum, r) => sum + r.deltaCents, 0n)
    expect(paid).toBe(5_000n)
    expect(await budget(w)).toBe(0n)
    const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, w.campaign.id))
    expect(camp?.status).toBe('closing')
    const earned = await db
      .select({ e: submissions.earnedCents })
      .from(submissions)
      .where(eq(submissions.campaignId, w.campaign.id))
    expect(earned.reduce((s, r) => s + r.e, 0n)).toBe(5_000n)
  })

  it('the same submission run in parallel posts one transaction', async () => {
    const w = await funded()
    const c = await makeCreator(db)
    const s = await post(w, c.id, 5_000)
    await Promise.all(Array.from({ length: 8 }, () => applyEarnings(db, s.id)))
    const rows = await db
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.submissionId, s.id))
    expect(rows).toHaveLength(1)
    expect(await pending(c.id)).toBe(1_000n)
  })

  it('parallel accruals and reversals on one campaign stay balanced and never go below zero', async () => {
    const w = await funded({ budgetCents: 20_000n, rateCentsPer1000: 1000, minViewsToEarn: 0 })
    const reviewer = await makeCreator(db)
    const subs = []
    for (let i = 0; i < 8; i++) subs.push(await post(w, (await makeCreator(db)).id, 2_000))
    await Promise.all([...subs.map((s) => applyEarnings(db, s.id))])
    await Promise.all([
      ...subs.slice(0, 4).map((s) =>
        reverseEarnings(db, {
          submissionId: s.id,
          toState: 'rejected',
          outcome: 'reject',
          reasonCode: 'other',
          actorId: reviewer.id,
        }),
      ),
      ...subs.slice(4).map((s) => applyEarnings(db, s.id)),
    ])
    const b = await budget(w)
    expect(b).toBeGreaterThanOrEqual(0n)
    const rows = await db
      .select({ e: submissions.earnedCents })
      .from(submissions)
      .where(eq(submissions.campaignId, w.campaign.id))
    const earned = rows.reduce((s, r) => s + r.e, 0n)
    expect(b + earned).toBe(20_000n)
  })
})

export type { Db }
