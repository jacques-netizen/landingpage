import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { eq, sql } from 'drizzle-orm'
import { submissions, withdrawals } from '@mde/db'
import { makeCampaign, makeCreator, makeSubmission, testDb } from '../../test/world'
import {
  accounts,
  applyEarnings,
  balanceOf,
  fundCampaign,
  markWithdrawalFailed,
  markWithdrawalPaid,
  markWithdrawalSent,
  postTransaction,
  recordClientFunding,
  releaseEarnings,
  requestWithdrawal,
  reverseEarnings,
} from './index'

/**
 * Model test: 10,000 random operations (view checks, duplicates, rejections, releases, withdrawals,
 * partner results and parallel jobs) run against a real Postgres. After every operation the money
 * invariants from docs/02_DATA_AND_MONEY.md section 7 must hold.
 */
const RUNS = 10_000
const { db, sql: pg } = testDb(12)

let worlds: Awaited<ReturnType<typeof makeCampaign>>[] = []
let campaignIds: string[] = []
let creatorIds: string[] = []
let submissionIds: string[] = []
let reviewerId = ''

beforeAll(async () => {
  await db.execute(
    sql`insert into settings (key, value) values ('withdrawal_min_cents', '100'::jsonb), ('withdrawal_fee_bps', '300'::jsonb), ('withdrawal_fee_min_cents', '50'::jsonb) on conflict (key) do update set value = excluded.value`,
  )
  const setups = [
    {
      budgetCents: 3_000n,
      rateCentsPer1000: 1000,
      minViewsToEarn: 0,
      capPerPostCents: 1_200n,
      capPerCreatorCents: 2_000n,
    },
    { budgetCents: 5_000_000n, rateCentsPer1000: 500, minViewsToEarn: 100 },
    { budgetCents: 800n, rateCentsPer1000: 1000, minViewsToEarn: 0 },
    { budgetCents: 2_000_000n, rateCentsPer1000: 1000, minViewsToEarn: 0, capPerPostCents: 4_000n },
  ]
  for (const s of setups) {
    const w = await makeCampaign(db, s)
    await recordClientFunding(db, {
      clientId: w.client.id,
      amountCents: s.budgetCents,
      reference: `prop-${w.campaign.id}`,
      campaignId: w.campaign.id,
      actorId: null,
    })
    await fundCampaign(db, { campaignId: w.campaign.id, actorId: null })
    worlds.push(w)
  }
  campaignIds = worlds.map((w) => w.campaign.id)
  const creators = []
  for (let i = 0; i < 10; i++) creators.push(await makeCreator(db))
  creatorIds = creators.map((c) => c.id)
  reviewerId = (await makeCreator(db)).id
  for (let i = 0; i < 36; i++) await spawn(i, i)
}, 120_000)

afterAll(async () => {
  await db.execute(
    sql`delete from settings where key in ('withdrawal_min_cents','withdrawal_fee_bps','withdrawal_fee_min_cents')`,
  )
  await pg.end()
})

/** A new approved post, as if a creator had submitted and a reviewer approved it. */
async function spawn(campaignIdx: number, creatorIdx: number) {
  const w = worlds[campaignIdx % worlds.length]!
  const s = await makeSubmission(db, {
    campaignId: w.campaign.id,
    creatorId: creatorIds[creatorIdx % creatorIds.length]!,
    termsId: w.termsId,
    rateLocked: w.campaign.rateCentsPer1000,
    state: 'approved',
    baselineViews: (submissionIds.length * 7) % 50,
  })
  submissionIds.push(s.id)
}

const idList = (ids: string[]) =>
  sql.join(
    ids.map((i) => sql`${i}`),
    sql`, `,
  )

/** The invariants that must hold after every operation. */
async function checkInvariants() {
  const [budgets, available, pending] = await Promise.all([
    db.execute<{ n: number }>(sql`
      select count(*)::int as n from (
        select a.id from ledger_accounts a join ledger_entries e on e.account_id = a.id
        where a.kind = 'campaign_budget' and a.owner_id in (${idList(campaignIds)})
        group by a.id having sum(e.amount_cents) < 0) x`),
    db.execute<{ n: number }>(sql`
      select count(*)::int as n from (
        select a.id from ledger_accounts a join ledger_entries e on e.account_id = a.id
        where a.kind = 'creator_available' and a.owner_id in (${idList(creatorIds)})
        group by a.id having sum(e.amount_cents) < 0) x`),
    db.execute<{ creator_id: string; pending: string; earned: string }>(sql`
      select c.id as creator_id,
        coalesce((select sum(e.amount_cents) from ledger_entries e join ledger_accounts a on a.id = e.account_id
                  where a.kind = 'creator_pending' and a.owner_id = c.id), 0)::text as pending,
        coalesce((select sum(s.earned_cents) from submissions s
                  where s.creator_id = c.id and s.state in ('approved','earning','flagged','final')), 0)::text as earned
      from (values ${sql.join(
        creatorIds.map((i) => sql`(${i}::uuid)`),
        sql`, `,
      )}) as c(id)`),
  ])
  expect(budgets[0]?.n, 'a campaign budget went below zero').toBe(0)
  expect(available[0]?.n, 'a creator available balance went below zero').toBe(0)
  for (const row of pending) {
    expect(
      row.pending,
      `pending for ${row.creator_id} must equal earned_cents of unreleased posts`,
    ).toBe(row.earned)
  }
}

async function checkLedgerWide() {
  const [bad, total] = await Promise.all([
    db.execute<{ n: number }>(
      sql`select count(*)::int as n from (select transaction_id from ledger_entries group by transaction_id having sum(amount_cents) <> 0) x`,
    ),
    db.execute<{ total: string }>(
      sql`select coalesce(sum(amount_cents), 0)::text as total from ledger_entries`,
    ),
  ])
  expect(bad[0]?.n, 'a transaction does not sum to zero').toBe(0)
  expect(total[0]?.total, 'all entries together must sum to zero').toBe('0')
}

/** Errors the engine is allowed to raise for an operation that is not valid right now. */
function isEngineBug(e: unknown) {
  return /below zero|does not balance|already exists|deadlock|violates|constraint/i.test(
    String((e as Error)?.message ?? e),
  )
}
async function attempt(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (e) {
    if (isEngineBug(e)) throw e
  }
}

const sub = fc.nat({ max: 1_000_000 })
const op = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({
      t: fc.constant('views' as const),
      sub,
      views: fc.integer({ min: 0, max: 6_000 }),
    }),
  },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('dup' as const), sub }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('reject' as const), sub }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('release' as const), sub }) },
  {
    weight: 3,
    arbitrary: fc.record({
      t: fc.constant('withdraw' as const),
      creator: fc.nat({ max: 9 }),
      amount: fc.integer({ min: 100, max: 3_000 }),
      method: fc.constantFrom('stripe_connect' as const, 'paypal' as const),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      t: fc.constant('settle' as const),
      pick: fc.nat({ max: 50 }),
      result: fc.constantFrom('paid' as const, 'failed' as const),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      t: fc.constant('parallel' as const),
      subs: fc.array(sub, { minLength: 2, maxLength: 5 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      t: fc.constant('spawn' as const),
      camp: fc.nat({ max: 3 }),
      creator: fc.nat({ max: 9 }),
    }),
  },
)
type Op = {
  t: string
  sub: number
  views: number
  creator: number
  camp: number
  amount: number
  method: 'stripe_connect' | 'paypal'
  pick: number
  result: 'paid' | 'failed'
  subs: number[]
}
const pickSub = (n: number) => submissionIds[n % submissionIds.length]!

async function run(x: Op) {
  switch (x.t) {
    case 'views': {
      const id = pickSub(x.sub)
      await db.update(submissions).set({ latestViews: x.views }).where(eq(submissions.id, id))
      return attempt(() => applyEarnings(db, id))
    }
    case 'dup': {
      const id = pickSub(x.sub)
      await attempt(() => applyEarnings(db, id))
      return attempt(() => applyEarnings(db, id))
    }
    case 'reject':
      return attempt(() =>
        reverseEarnings(db, {
          submissionId: pickSub(x.sub),
          toState: 'rejected',
          outcome: 'reject',
          reasonCode: 'other',
          actorId: reviewerId,
        }),
      )
    case 'release': {
      const id = pickSub(x.sub)
      await db
        .update(submissions)
        .set({ state: 'final' })
        .where(sql`${submissions.id} = ${id} and ${submissions.state} in ('approved','earning')`)
      return attempt(() => releaseEarnings(db, id))
    }
    case 'withdraw':
      return attempt(() =>
        requestWithdrawal(db, {
          creatorId: creatorIds[x.creator]!,
          amountCents: BigInt(x.amount),
          method: x.method,
        }),
      )
    case 'settle': {
      const open = await db
        .select({ id: withdrawals.id })
        .from(withdrawals)
        .where(
          sql`${withdrawals.creatorId} in (${idList(creatorIds)}) and ${withdrawals.status} in ('requested','sent')`,
        )
      const w = open[x.pick % Math.max(open.length, 1)]
      if (!w) return
      return attempt(async () => {
        await markWithdrawalSent(db, { withdrawalId: w.id })
        if (x.result === 'paid')
          await markWithdrawalPaid(db, { withdrawalId: w.id, partnerReference: 'ref' })
        else await markWithdrawalFailed(db, { withdrawalId: w.id, reason: 'test' })
      })
    }
    case 'spawn':
      return spawn(x.camp, x.creator)
    case 'parallel':
      return Promise.all(x.subs.map((s) => attempt(() => applyEarnings(db, pickSub(s)))))
  }
}

describe('ledger properties (10,000 random operations)', () => {
  it('every invariant holds after every operation', async () => {
    let n = 0
    await fc.assert(
      fc.asyncProperty(op, async (o) => {
        await run(o as unknown as Op)
        await checkInvariants()
        if (++n % 1000 === 0) await checkLedgerWide()
        return true
      }),
      { numRuns: RUNS, endOnFailure: true },
    )
    expect(n).toBe(RUNS)
  }, 1_800_000)

  it('every transaction sums to zero and all entries together sum to zero', async () => {
    await checkLedgerWide()
  })

  it('replaying existing transactions with their idempotency keys changes nothing', async () => {
    const before = await db.execute<{ n: number; total: string }>(
      sql`select count(*)::int as n, coalesce(sum(amount_cents),0)::text as total from ledger_entries`,
    )
    const txs = await db.execute<{ id: string; kind: string; idempotency_key: string }>(
      sql`select id, kind, idempotency_key from ledger_transactions order by random() limit 800`,
    )
    expect(txs.length).toBeGreaterThan(0)
    for (const t of txs) {
      const entries = await db.execute<{ account_id: string; amount_cents: string }>(
        sql`select account_id, amount_cents::text from ledger_entries where transaction_id = ${t.id}`,
      )
      const res = await db.transaction((tx) =>
        postTransaction(tx, {
          kind: t.kind as never,
          idempotencyKey: t.idempotency_key,
          entries: entries.map((e) => ({
            accountId: e.account_id,
            amountCents: BigInt(e.amount_cents),
          })),
        }),
      )
      expect(res.created).toBe(false)
      expect(res.transactionId).toBe(t.id)
    }
    const after = await db.execute<{ n: number; total: string }>(
      sql`select count(*)::int as n, coalesce(sum(amount_cents),0)::text as total from ledger_entries`,
    )
    expect(after[0]).toEqual(before[0])
  })

  it('the world actually did something: money moved and the budgets were exercised', async () => {
    const accrued = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ledger_transactions where kind = 'earning_accrued'`,
    )
    // A guard against a vacuous run, not a tuned number: hundreds of accruals happen.
    expect(accrued[0]?.n).toBeGreaterThan(200)
    const kinds = await db.execute<{ kind: string }>(
      sql`select distinct kind from ledger_transactions`,
    )
    const set = new Set(kinds.map((k) => k.kind))
    for (const k of [
      'earning_accrued',
      'earning_reversed',
      'earnings_released',
      'withdrawal_requested',
      'withdrawal_paid',
      'withdrawal_failed',
    ]) {
      expect(set.has(k), `no ${k} transaction happened during the run`).toBe(true)
    }
    const closing = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from campaigns where id in (${idList(campaignIds)}) and status = 'closing'`,
    )
    expect(closing[0]?.n).toBeGreaterThan(0)
    expect(await balanceOf(db, await accounts.external(db))).toBeLessThanOrEqual(0n)
  })
})
