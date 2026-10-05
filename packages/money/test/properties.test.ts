// Property tests from 02_DATA_AND_MONEY.md section 7. Random sequences of money operations run
// through the real engine, and after every step:
//  - every ledger transaction's entries sum to zero,
//  - all entries across all accounts sum to zero,
//  - no campaign budget and no creator available balance is below zero,
//  - each creator's pending balance equals the earned_cents of their unreleased submissions,
// and at the end, replaying every transaction with its idempotency key changes nothing.
// 10,000 runs against the in-memory store; a smaller sample against real Postgres.
import fc from 'fast-check'
import { afterAll, describe, expect, it } from 'vitest'
import {
  accrueEarnings,
  fundCampaign,
  markWithdrawalFailed,
  markWithdrawalPaid,
  MoneyError,
  recordClientFunding,
  releaseEarnings,
  replayTransaction,
  requestWithdrawal,
  returnCampaignRemainder,
  reverseEarnings,
  serviceFeeCents,
} from '../src'
import { memoryWorld, postgresWorld, type LedgerView, type World } from './world'

type Op =
  | { t: 'views'; sub: number; views: number }
  | { t: 'again'; sub: number }
  | { t: 'reject'; sub: number }
  | { t: 'release'; sub: number }
  | { t: 'withdraw'; creator: number; share: number; extra: number }
  | { t: 'paid'; w: number }
  | { t: 'failed'; w: number }
  | { t: 'close' }

const scenario = fc.record({
  budget: fc.integer({ min: 1, max: 200_000 }),
  feeBps: fc.integer({ min: 0, max: 2_000 }),
  rate: fc.integer({ min: 1, max: 2_000 }),
  capPost: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: null }),
  capCreator: fc.option(fc.integer({ min: 0, max: 150_000 }), { nil: null }),
  minViews: fc.integer({ min: 0, max: 5_000 }),
  creators: fc.integer({ min: 1, max: 3 }),
  subsPerCreator: fc.integer({ min: 1, max: 3 }),
  fees: fc.record({
    withdrawal_fee_bps: fc.integer({ min: 0, max: 1_000 }),
    withdrawal_fee_min_cents: fc.integer({ min: 0, max: 500 }),
    withdrawal_min_cents: fc.integer({ min: 0, max: 5_000 }),
  }),
  ops: fc.array(
    fc.oneof(
      {
        weight: 5,
        arbitrary: fc.record({
          t: fc.constant('views' as const),
          sub: fc.nat(8),
          views: fc.integer({ min: 0, max: 2_000_000 }),
        }),
      },
      { weight: 1, arbitrary: fc.record({ t: fc.constant('again' as const), sub: fc.nat(8) }) },
      { weight: 1, arbitrary: fc.record({ t: fc.constant('reject' as const), sub: fc.nat(8) }) },
      { weight: 3, arbitrary: fc.record({ t: fc.constant('release' as const), sub: fc.nat(8) }) },
      {
        weight: 4,
        arbitrary: fc.record({
          t: fc.constant('withdraw' as const),
          creator: fc.nat(2),
          // A share of what is available (1 to 100%), sometimes plus extra to hit the refusals.
          share: fc.integer({ min: 1, max: 100 }),
          extra: fc.oneof(
            { weight: 4, arbitrary: fc.constant(0) },
            { weight: 1, arbitrary: fc.integer({ min: 1, max: 50_000 }) },
          ),
        }),
      },
      { weight: 2, arbitrary: fc.record({ t: fc.constant('paid' as const), w: fc.nat(4) }) },
      { weight: 2, arbitrary: fc.record({ t: fc.constant('failed' as const), w: fc.nat(4) }) },
      { weight: 1, arbitrary: fc.record({ t: fc.constant('close' as const) }) },
    ),
    { minLength: 10, maxLength: 40 },
  ),
})

function checkInvariants(l: LedgerView) {
  const byAccount = new Map<string, number>()
  let total = 0
  for (const t of l.transactions) {
    const sum = t.entries.reduce((s, e) => s + e.amountCents, 0)
    expect(sum, `transaction ${t.kind} ${t.idempotencyKey} must sum to zero`).toBe(0)
    expect(t.entries.length).toBeGreaterThanOrEqual(2)
    for (const e of t.entries) {
      byAccount.set(e.accountId, (byAccount.get(e.accountId) ?? 0) + e.amountCents)
      total += e.amountCents
    }
  }
  expect(total).toBe(0)
  const pendingByCreator = new Map<string, number>()
  for (const a of l.accounts) {
    const b = byAccount.get(a.id) ?? 0
    if (a.kind === 'campaign_budget') expect(b, 'campaign budget below zero').toBeGreaterThanOrEqual(0)
    if (a.kind === 'creator_available') expect(b, 'creator available below zero').toBeGreaterThanOrEqual(0)
    if (a.kind === 'creator_pending') pendingByCreator.set(a.ownerId!, b)
  }
  const earnedByCreator = new Map<string, number>()
  for (const s of l.submissions) {
    if (s.state === 'paid_out') continue
    earnedByCreator.set(s.creatorId, (earnedByCreator.get(s.creatorId) ?? 0) + s.earnedCents)
  }
  for (const [creator, earned] of earnedByCreator)
    expect(pendingByCreator.get(creator) ?? 0, 'pending equals unreleased earnings').toBe(earned)
  for (const [creator, pending] of pendingByCreator) expect(pending).toBe(earnedByCreator.get(creator) ?? 0)
}

// Errors the engine is expected to refuse with. Anything else fails the test.
const EXPECTED = new Set([
  'insufficient_available',
  'below_minimum',
  'fee_exceeds_amount',
  'payout_not_verified',
  'withdrawal_already_requested',
  'not_releasable',
  'wrong_withdrawal_status',
  'not_whole_cents',
  'nothing_to_reverse',
  'campaign_not_closed',
])

async function tolerate(p: Promise<unknown>) {
  try {
    return await p
  } catch (e) {
    if (e instanceof MoneyError && EXPECTED.has(e.code)) return undefined
    throw e
  }
}

// How often each money path actually ran, so a generator change cannot silently stop exercising it.
const coverage = {
  accrued: 0,
  reversedByViews: 0,
  rejectedWithEarnings: 0,
  released: 0,
  withdrawn: 0,
  paid: 0,
  failed: 0,
  closing: 0,
  remainder: 0,
}

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never

async function runScenario(w: World, s: Scenario, eachStep: boolean) {
  await w.setFeeSettings(s.fees)
  const clientId = await w.client(s.feeBps)
  const campaignId = await w.campaign(clientId, {
    budgetCents: s.budget,
    rate: s.rate,
    capPost: s.capPost,
    capCreator: s.capCreator,
    minViews: s.minViews,
  })
  await recordClientFunding(w.store, {
    clientId,
    amountCents: s.budget + serviceFeeCents(s.budget, s.feeBps),
    reference: `inv-${campaignId}`,
    actorId: null,
  })
  await fundCampaign(w.store, { campaignId, actorId: null })
  await w.setCampaignStatus(campaignId, 'live')

  const creators: string[] = []
  const subs: string[] = []
  for (let c = 0; c < s.creators; c++) {
    const creator = await w.creator(c !== 1)
    creators.push(creator)
    for (let k = 0; k < s.subsPerCreator; k++) subs.push(await w.submission(campaignId, creator, s.rate))
  }
  const withdrawals: string[] = []
  const withdrawalStatus = new Map<string, string>()
  const states = new Map(subs.map((id) => [id, 'approved']))
  let closed = false

  for (const op of s.ops satisfies Op[]) {
    switch (op.t) {
      case 'views': {
        const id = subs[op.sub % subs.length]!
        await w.setViews(id, op.views)
        const r = (await tolerate(accrueEarnings(w.store, { submissionId: id }))) as
          { deltaCents: number; campaignClosing: boolean } | undefined
        if (r && r.deltaCents > 0) coverage.accrued++
        if (r && r.deltaCents < 0) coverage.reversedByViews++
        if (r?.campaignClosing) coverage.closing++
        break
      }
      case 'again': {
        await tolerate(accrueEarnings(w.store, { submissionId: subs[op.sub % subs.length]! }))
        break
      }
      case 'reject': {
        const id = subs[op.sub % subs.length]!
        if (!['approved', 'earning'].includes(states.get(id)!)) break
        const rev = (await tolerate(reverseEarnings(w.store, { submissionId: id, actorId: null }))) as
          { reversedCents: number } | undefined
        if (rev && rev.reversedCents > 0) coverage.rejectedWithEarnings++
        await w.setSubmissionState(id, 'rejected')
        states.set(id, 'rejected')
        break
      }
      case 'release': {
        const id = subs[op.sub % subs.length]!
        if (!['approved', 'earning'].includes(states.get(id)!)) break
        await w.setSubmissionState(id, 'final')
        const r = await tolerate(releaseEarnings(w.store, { submissionId: id }))
        states.set(id, r ? 'paid_out' : 'final')
        if (r && (r as { releasedCents: number }).releasedCents > 0) coverage.released++
        break
      }
      case 'withdraw': {
        const creatorId = creators[op.creator % creators.length]!
        const l = await w.ledger()
        const acct = l.accounts.find((a) => a.kind === 'creator_available' && a.ownerId === creatorId)
        const available = acct
          ? l.transactions
              .flatMap((t) => t.entries)
              .filter((e) => e.accountId === acct.id)
              .reduce((n, e) => n + e.amountCents, 0)
          : 0
        const r = await tolerate(
          requestWithdrawal(w.store, {
            creatorId,
            amountCents: Math.floor((available * op.share) / 100) + op.extra,
            method: 'paypal',
          }),
        )
        if (r && typeof r === 'object' && 'id' in r) {
          withdrawals.push((r as { id: string }).id)
          coverage.withdrawn++
          withdrawalStatus.set((r as { id: string }).id, 'requested')
        }
        break
      }
      case 'paid':
      case 'failed': {
        const id = withdrawals[op.w % Math.max(1, withdrawals.length)]
        if (!id) break
        // Staff approval and batching come later; here a requested withdrawal is simply sent.
        if (withdrawalStatus.get(id) === 'requested') {
          await w.setWithdrawalStatus(id, 'sent')
          withdrawalStatus.set(id, 'sent')
        }
        const done = (await tolerate(
          op.t === 'paid'
            ? markWithdrawalPaid(w.store, { withdrawalId: id, partnerReference: `ref-${id}`, actorId: null })
            : markWithdrawalFailed(w.store, { withdrawalId: id, reason: 'test failure', actorId: null }),
        )) as { alreadyDone: boolean } | undefined
        if (done && !done.alreadyDone) {
          withdrawalStatus.set(id, op.t)
          coverage[op.t]++
        }
        break
      }
      case 'close': {
        if (closed) break
        closed = true
        await w.setCampaignStatus(campaignId, 'closed')
        const rem = (await tolerate(returnCampaignRemainder(w.store, { campaignId }))) as
          { returnedCents: number } | undefined
        if (rem && rem.returnedCents > 0) coverage.remainder++
        break
      }
    }
    if (eachStep) checkInvariants(await w.ledger())
  }

  const before = await w.ledger()
  checkInvariants(before)
  // Replaying every transaction with its idempotency key changes nothing.
  for (const t of before.transactions) await replayTransaction(w.store, t)
  const after = await w.ledger()
  expect(after.transactions.length).toBe(before.transactions.length)
  expect(after.transactions.reduce((n, t) => n + t.entries.length, 0)).toBe(
    before.transactions.reduce((n, t) => n + t.entries.length, 0),
  )
}

describe('money engine properties', () => {
  it('hold for 10,000 random operation sequences (in-memory store, same engine code)', async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        await runScenario(memoryWorld(), s, true)
      }),
      { numRuns: 10_000 },
    )
    // Every path ran many times across the 10,000 sequences.
    console.log('Property coverage across 10,000 runs:', JSON.stringify(coverage))
    for (const [path, count] of Object.entries(coverage))
      expect(count, `${path} ran ${count} times`).toBeGreaterThan(200)
  })

  const pg = postgresWorld()
  afterAll(() => pg.close())

  it('hold against real Postgres (sampled runs)', async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        await runScenario(pg, s, false)
      }),
      { numRuns: Number(process.env.PG_PROPERTY_RUNS ?? 40) },
    )
  })
})
