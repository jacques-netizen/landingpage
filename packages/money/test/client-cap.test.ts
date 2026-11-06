// Owner rule (2026-11-06, Davido X Winnerman-Audio was overspent): clippers stop earning once the
// client's budget is used up. A campaign that shows the client a budget of its own, or spend at a
// multiple of what clippers earn, lets clippers earn in total at most that budget divided by the spend
// factor, rounded down. Posts that already earned more keep it; nothing is taken back.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { accrueEarnings } from '../src'
import {
  balanceOf,
  campaign,
  connect,
  fundedCampaign,
  makeSubmission,
  makeUser,
  setCountedViews,
  submission,
} from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

// Budget 100,000 cents, rate 200 per 1,000, no caps, no minimum.
const OPEN = { capPerPostCents: null, capPerCreatorCents: null, minViewsToEarn: 0 }

async function clientCap(campaignId: string, clientBudgetCents: number | null, clientSpendFactor: number) {
  await db
    .update(tables.campaigns)
    .set({ clientBudgetCents, clientSpendFactor })
    .where(eq(tables.campaigns.id, campaignId))
}

describe('clippers stop earning at the client budget', () => {
  it('caps the campaign total at the client budget divided by the spend factor', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    // The client sees $20.00 at twice what clippers earn: clippers may earn 1,000 cents in all.
    await clientCap(c.campaignId, 2_000, 2)
    const a = await makeSubmission(db, c, await makeUser(db), { countedViews: 3_000 }) // 600 uncapped
    const b = await makeSubmission(db, c, await makeUser(db), { countedViews: 3_000 }) // 600 uncapped
    expect((await accrueEarnings(store, { submissionId: a })).postCents).toBe(600)
    const r = await accrueEarnings(store, { submissionId: b })
    expect(r.postCents).toBe(400)
    expect((await submission(db, b)).earnedCents).toBe(400)
    // The ledger budget still holds the rest, but no further cent can be earned: the campaign closes.
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(99_000)
    expect(r.campaignClosing).toBe(true)
    expect((await campaign(db, c.campaignId)).status).toBe('closing')
  })

  it('uses the campaign budget when only the spend factor is set', async () => {
    const c = await fundedCampaign(ctx, { ...OPEN, budgetCents: 1_000 })
    await clientCap(c.campaignId, null, 2)
    const a = await makeSubmission(db, c, await makeUser(db), { countedViews: 5_000 }) // 1,000 uncapped
    expect((await accrueEarnings(store, { submissionId: a })).postCents).toBe(500)
  })

  it('rounds the cap down to whole cents', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    await clientCap(c.campaignId, 1_001, 2) // 500.5 cents: 500
    const a = await makeSubmission(db, c, await makeUser(db), { countedViews: 10_000 })
    expect((await accrueEarnings(store, { submissionId: a })).postCents).toBe(500)
  })

  it('takes nothing back from a campaign that was already over the cap', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    const a = await makeSubmission(db, c, await makeUser(db), { countedViews: 10_000 })
    expect((await accrueEarnings(store, { submissionId: a })).postCents).toBe(2_000)
    // The cap is set afterwards, below what was already earned.
    await clientCap(c.campaignId, 1_000, 2)
    await setCountedViews(db, a, 20_000)
    const again = await accrueEarnings(store, { submissionId: a })
    expect(again.deltaCents).toBe(0)
    expect((await submission(db, a)).earnedCents).toBe(2_000)
    const b = await makeSubmission(db, c, await makeUser(db), { countedViews: 5_000 })
    expect((await accrueEarnings(store, { submissionId: b })).postCents).toBe(0)
  })

  it('leaves a campaign without a client budget or factor exactly as before', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    const a = await makeSubmission(db, c, await makeUser(db), { countedViews: 10_000 })
    const r = await accrueEarnings(store, { submissionId: a })
    expect(r.postCents).toBe(2_000)
    expect(r.campaignClosing).toBe(false)
  })
})
