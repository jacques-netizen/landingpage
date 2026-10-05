// Phase 1 acceptance: two concurrent earnings jobs on the same campaign never overspend the budget.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { accrueEarnings } from '../src'
import { balanceOf, connect, fundedCampaign, makeSubmission, makeUser, submission } from './fixtures'

const ctx = connect(20)
const { db, store } = ctx
afterAll(() => ctx.client.end())

describe('concurrent earnings', () => {
  it('parallel view checks on one campaign never spend more than the budget', async () => {
    // 20 posts each owed 3,000 against a 10,000 budget, all accrued at the same time.
    const c = await fundedCampaign(ctx, {
      budgetCents: 10_000,
      capPerPostCents: null,
      capPerCreatorCents: null,
      minViewsToEarn: 0,
    })
    const subs = []
    for (let i = 0; i < 20; i++) subs.push(await makeSubmission(db, c, await makeUser(db), { countedViews: 15_000 }))
    const results = await Promise.allSettled(subs.map((id) => accrueEarnings(store, { submissionId: id })))
    expect(results.filter((r) => r.status === 'rejected')).toEqual([])

    const earned = (await Promise.all(subs.map((id) => submission(db, id)))).reduce((n, s) => n + s.earnedCents, 0)
    expect(earned).toBe(10_000)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(0)
    const [campaign] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.campaignId))
    expect(campaign!.status).toBe('closing')
  })

  it('the same view check run twice at once posts one transaction', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db), { countedViews: 5_000 })
    await Promise.all(Array.from({ length: 8 }, () => accrueEarnings(store, { submissionId: s })))
    const txs = await db.select().from(tables.ledgerTransactions).where(eq(tables.ledgerTransactions.submissionId, s))
    expect(txs).toHaveLength(1)
    expect((await submission(db, s)).earnedCents).toBe(1_000)
  })
})
