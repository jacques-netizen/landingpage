import 'server-only'
import { campaignFigures } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { and, asc, count, eq, inArray, lte, min, sql, isNull } from 'drizzle-orm'
import { HOUR } from './appeals'

/** Budget left at or below this share counts as near its end. */
const NEAR_END_PERCENT = 10n

/** What needs a staff member today (01_PRODUCT.md 8.4): the queue, appeals due within a day, campaigns running out. */
export async function staffDashboard(now = new Date()) {
  const d = db()
  const [[queue], [flagged], appeals, running] = await Promise.all([
    d
      .select({ n: count(), oldest: min(tables.submissions.submittedAt) })
      .from(tables.submissions)
      .where(inArray(tables.submissions.state, ['needs_review', 'flagged'])),
    d.select({ n: count() }).from(tables.submissions).where(eq(tables.submissions.state, 'flagged')),
    d
      .select({
        id: tables.appeals.id,
        dueAt: tables.appeals.dueAt,
        campaignTitle: tables.campaigns.title,
        name: sql<string | null>`coalesce(${tables.users.username}, ${tables.users.name})`,
        email: tables.users.email,
      })
      .from(tables.appeals)
      .innerJoin(tables.submissions, eq(tables.submissions.id, tables.appeals.submissionId))
      .innerJoin(tables.campaigns, eq(tables.campaigns.id, tables.submissions.campaignId))
      .innerJoin(tables.users, eq(tables.users.id, tables.appeals.creatorId))
      .where(and(eq(tables.appeals.status, 'open'), lte(tables.appeals.dueAt, new Date(now.getTime() + 24 * HOUR))))
      .orderBy(asc(tables.appeals.dueAt)),
    d
      .select({ id: tables.campaigns.id, title: tables.campaigns.title })
      .from(tables.campaigns)
      .where(and(eq(tables.campaigns.status, 'live'), isNull(tables.campaigns.deletedAt))),
  ])
  const figures = await campaignFigures(
    d,
    running.map((c) => c.id),
  )
  const nearEnd = running
    .map((c) => ({ ...c, ...figures.get(c.id)! }))
    .filter((c) => BigInt(c.leftCents) * 100n <= BigInt(c.budgetCents) * NEAR_END_PERCENT)
    .sort((a, b) => a.leftCents - b.leftCents)
  return {
    waiting: queue?.n ?? 0,
    flagged: flagged?.n ?? 0,
    oldestWaiting: queue?.oldest ?? null,
    appeals,
    nearEnd,
  }
}
