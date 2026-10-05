// The release-earnings job (02_DATA_AND_MONEY.md 5.4 steps 3 and 4), hourly. After a closed
// campaign's review window ends: each final post with no open flag or appeal is released from
// pending to available, then unused budget goes back to the client's holding account. Safe to
// run again: released posts are skipped and each money movement has its own idempotency key.
import { notify, tables, type Db } from '@mde/db'
import { createPgStore, MoneyError, releaseEarnings, returnCampaignRemainder } from '@mde/money'
import { formatDollars } from '@mde/money/dollars'
import { and, eq, lte } from 'drizzle-orm'

const { campaigns, submissions } = tables

export async function runReleases(db: Db, now = new Date()) {
  const store = createPgStore(db)
  const due = await db
    .select({ id: campaigns.id, title: campaigns.title })
    .from(campaigns)
    .where(and(eq(campaigns.status, 'closed'), lte(campaigns.releaseAt, now)))
  const totals = { campaigns: due.length, released: 0, releasedCents: 0, held: 0, returnedCents: 0 }
  for (const c of due) {
    const byCreator = new Map<string, number>()
    const finals = await db
      .select({ id: submissions.id, creatorId: submissions.creatorId })
      .from(submissions)
      .where(and(eq(submissions.campaignId, c.id), eq(submissions.state, 'final')))
    for (const s of finals) {
      try {
        const r = await releaseEarnings(store, { submissionId: s.id })
        if (!r.alreadyReleased) {
          totals.released++
          totals.releasedCents += r.releasedCents
          byCreator.set(s.creatorId, (byCreator.get(s.creatorId) ?? 0) + r.releasedCents)
        }
      } catch (e) {
        // An open flag or appeal holds the post until staff resolve it.
        if (e instanceof MoneyError && e.code === 'not_releasable') totals.held++
        else throw e
      }
    }
    // One notification per creator per campaign, with the amount and the date (03_SYSTEMS.md section 9).
    for (const [creatorId, cents] of byCreator)
      if (cents > 0)
        await notify(db, creatorId, 'earnings_released', {
          title: 'Earnings released',
          body: `${formatDollars(cents)} from ${c.title} became available to withdraw on ${now.toISOString().slice(0, 10)}.`,
          link: '/wallet',
        })
    totals.returnedCents += (await returnCampaignRemainder(store, { campaignId: c.id })).returnedCents
  }
  return totals
}
