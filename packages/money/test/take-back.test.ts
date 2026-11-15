// Owner, 2026-11-15: delete the One Billion Dollar Billboard campaign and take back what clippers earned
// on it. Earnings not yet released are reversed to the campaign budget. Earnings already released are
// taken from the clipper's available balance, as far as it still holds them; money already withdrawn
// cannot be taken back and is reported instead. Running it twice changes nothing.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { accrueEarnings, account, ledgerCheck, manualAdjustment, releaseEarnings, takeBackPosts } from '../src'
import { balanceOf, connect, fundedCampaign, makeSubmission, makeUser, submission } from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

const OPEN = { capPerPostCents: null, capPerCreatorCents: null, minViewsToEarn: 0 }

async function released(submissionId: string) {
  await db.update(tables.submissions).set({ state: 'final' }).where(eq(tables.submissions.id, submissionId))
  await releaseEarnings(store, { submissionId })
}

describe('taking back what a campaign paid clippers', () => {
  it('reverses unreleased earnings and takes released ones from the available balance', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    const admin = await makeUser(db)
    const ann = await makeUser(db)
    const ben = await makeUser(db)
    const a = await makeSubmission(db, c, ann, { countedViews: 1_000 }) // 200, stays pending
    const b = await makeSubmission(db, c, ben, { countedViews: 2_000 }) // 400, released
    await accrueEarnings(store, { submissionId: a })
    await accrueEarnings(store, { submissionId: b })
    await released(b)
    expect(await balanceOf(db, 'creator_available', ben)).toBe(400)

    const r = await takeBackPosts(store, {
      campaignId: c.campaignId,
      submissionIds: [a, b],
      actorId: admin,
      memo: 'test',
    })
    expect(r).toEqual({ reversedCents: 200, takenFromAvailableCents: 400, notRecovered: [] })
    expect(await balanceOf(db, 'creator_pending', ann)).toBe(0)
    expect(await balanceOf(db, 'creator_available', ben)).toBe(0)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(100_000)
    expect((await submission(db, a)).earnedCents).toBe(0)
    expect(await ledgerCheck(db)).toEqual([])
  })

  it('takes only what is still there when the clipper already withdrew some, and reports the rest', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    const admin = await makeUser(db)
    const cat = await makeUser(db)
    const s = await makeSubmission(db, c, cat, { countedViews: 5_000 }) // 1,000, released
    await accrueEarnings(store, { submissionId: s })
    await released(s)
    // 700 of it has left as a withdrawal.
    await manualAdjustment(store, {
      from: account.available(cat),
      to: account.inTransit(),
      amountCents: 700,
      memo: 'withdrawal stand-in',
      actorId: admin,
      idempotencyKey: `t-${s}`,
    })

    const r = await takeBackPosts(store, { campaignId: c.campaignId, submissionIds: [s], actorId: admin, memo: 'test' })
    expect(r).toEqual({
      reversedCents: 0,
      takenFromAvailableCents: 300,
      notRecovered: [{ creatorId: cat, cents: 700 }],
    })
    expect(await balanceOf(db, 'creator_available', cat)).toBe(0)
    expect(await ledgerCheck(db)).toEqual([])
  })

  it('changes nothing the second time', async () => {
    const c = await fundedCampaign(ctx, OPEN)
    const admin = await makeUser(db)
    const dan = await makeUser(db)
    const p = await makeSubmission(db, c, dan, { countedViews: 1_000 })
    const q = await makeSubmission(db, c, dan, { countedViews: 1_000 })
    await accrueEarnings(store, { submissionId: p })
    await accrueEarnings(store, { submissionId: q })
    await released(q)
    const input = { campaignId: c.campaignId, submissionIds: [p, q], actorId: admin, memo: 'test' }
    await takeBackPosts(store, input)
    const again = await takeBackPosts(store, input)
    expect(again.reversedCents).toBe(0)
    expect(again.takenFromAvailableCents).toBe(0)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(100_000)
  })
})
