import { closeCampaign, reopenCampaign } from '@mde/campaigns'
import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { approve } from '../src'
import { db, postInReview, sql } from './fixtures'

afterAll(() => sql.end())
const HOUR = 3_600_000

// Resume a closed campaign (owner request, 2026-10-26: it was closed before the last stats refresh, so
// clippers' views stopped short). Possible until its earnings are released.
describe('resuming a closed campaign', () => {
  it('puts final posts back to earning so views read after the close count, and audits it', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    t.views(3_000)
    await t.check(1)
    // 3,000 - 500 baseline = 2,500 counted at $2.00 per 1,000 = $5.00.
    expect((await t.sub()).earnedCents).toBe(500)
    await db.transaction((tx) => closeCampaign(tx, t.staffId, t.campaignId))
    expect((await t.sub()).state).toBe('final')
    // Views read after the close do not count.
    t.views(6_000)
    await db
      .update(tables.submissions)
      .set({ nextCheckAt: new Date(0) })
      .where(eq(tables.submissions.id, t.id))
    await t.check(3)
    expect((await t.sub()).earnedCents).toBe(500)

    await reopenCampaign(db, t.staffId, t.campaignId)
    const [c] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, t.campaignId))
    expect(c).toMatchObject({ status: 'live', closedAt: null, releaseAt: null })
    const s = await t.sub()
    expect(s.state).toBe('approved')
    expect(s.nextCheckAt!.getTime()).toBeLessThanOrEqual(Date.now())
    // The next check counts the views: 6,000 - 500 = 5,500 at $2.00 per 1,000 = $11.00.
    await t.check(4)
    expect((await t.sub()).earnedCents).toBe(1_100)
    expect((await t.sub()).state).toBe('earning')
    const audit = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, t.campaignId))
    expect(audit.some((a) => a.action === 'campaign.reopen')).toBe(true)
  })

  it('refuses a campaign that is live, or one whose earnings were already released', async () => {
    const t = await postInReview()
    await expect(reopenCampaign(db, t.staffId, t.campaignId)).rejects.toThrow(/only a closed campaign/i)
    await db.transaction((tx) => closeCampaign(tx, t.staffId, t.campaignId))
    await db
      .update(tables.campaigns)
      .set({ releaseAt: new Date(Date.now() - HOUR) })
      .where(eq(tables.campaigns.id, t.campaignId))
    await expect(reopenCampaign(db, t.staffId, t.campaignId)).rejects.toThrow(/already been released/i)
  })
})
