// Unused budget after close (02_DATA_AND_MONEY.md 5.4 step 3). Money that comes back into a closed
// campaign's budget later (a held post's earnings reversed by staff) is returned too, once.
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { accrueEarnings, returnCampaignRemainder, reverseEarnings } from '../src'
import { balanceOf, connect, fundedCampaign, makeSubmission, makeUser, setCountedViews } from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

describe('returning unused budget', () => {
  it('returns what is left at close, and later reversals as they arrive, never twice', async () => {
    const c = await fundedCampaign(ctx)
    const creator = await makeUser(db)
    const s = await makeSubmission(db, c, creator)
    await setCountedViews(db, s, 10_000) // earns 2,000
    await accrueEarnings(store, { submissionId: s })
    await db.update(tables.campaigns).set({ status: 'closed' }).where(eq(tables.campaigns.id, c.campaignId))
    await db.update(tables.submissions).set({ state: 'final' }).where(eq(tables.submissions.id, s))

    expect((await returnCampaignRemainder(store, { campaignId: c.campaignId })).returnedCents).toBe(98_000)
    expect((await returnCampaignRemainder(store, { campaignId: c.campaignId })).returnedCents).toBe(0)
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(98_000)

    // Staff later reverse the held post: its 2,000 goes back to the budget, then to the client.
    await reverseEarnings(store, { submissionId: s, actorId: null })
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(2_000)
    expect((await returnCampaignRemainder(store, { campaignId: c.campaignId })).returnedCents).toBe(2_000)
    expect((await returnCampaignRemainder(store, { campaignId: c.campaignId })).returnedCents).toBe(0)
    expect(await balanceOf(db, 'campaign_budget', c.campaignId)).toBe(0)
    expect(await balanceOf(db, 'client_funds_holding', c.clientId)).toBe(100_000)
  })
})
