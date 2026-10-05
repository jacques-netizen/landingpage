// The release-earnings job (02_DATA_AND_MONEY.md 5.4 steps 3 and 4), hourly. After a closed
// campaign's review window ends: each final post with no open flag or appeal is released from
// pending to available, then unused budget goes back to the client's holding account. Safe to
// run again: released posts are skipped and each money movement has its own idempotency key.
import { tables, type Db } from '@mde/db'
import { createPgStore, MoneyError, releaseEarnings, returnCampaignRemainder } from '@mde/money'
import { and, eq, lte } from 'drizzle-orm'

const { campaigns, submissions } = tables

export async function runReleases(db: Db, now = new Date()) {
  const store = createPgStore(db)
  const due = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.status, 'closed'), lte(campaigns.releaseAt, now)))
  const totals = { campaigns: due.length, released: 0, releasedCents: 0, held: 0, returnedCents: 0 }
  for (const c of due) {
    const finals = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.campaignId, c.id), eq(submissions.state, 'final')))
    for (const s of finals) {
      try {
        const r = await releaseEarnings(store, { submissionId: s.id })
        if (!r.alreadyReleased) {
          totals.released++
          totals.releasedCents += r.releasedCents
        }
      } catch (e) {
        // An open flag or appeal holds the post until staff resolve it.
        if (e instanceof MoneyError && e.code === 'not_releasable') totals.held++
        else throw e
      }
    }
    totals.returnedCents += (await returnCampaignRemainder(store, { campaignId: c.id })).returnedCents
  }
  return totals
}
