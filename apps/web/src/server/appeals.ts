import 'server-only'
import { db, tables } from '@mde/db'
import { asc, desc, eq, ne } from 'drizzle-orm'

const base = () =>
  db()
    .select({
      id: tables.appeals.id,
      status: tables.appeals.status,
      message: tables.appeals.message,
      links: tables.appeals.links,
      reply: tables.appeals.reply,
      dueAt: tables.appeals.dueAt,
      createdAt: tables.appeals.createdAt,
      resolvedAt: tables.appeals.resolvedAt,
      previousState: tables.appeals.previousState,
      submissionId: tables.submissions.id,
      postUrl: tables.submissions.postUrl,
      platform: tables.submissions.platform,
      reasonCode: tables.submissions.reasonCode,
      reasonNote: tables.submissions.reasonNote,
      campaignTitle: tables.campaigns.title,
      creatorId: tables.appeals.creatorId,
      email: tables.users.email,
      name: tables.users.name,
    })
    .from(tables.appeals)
    .innerJoin(tables.submissions, eq(tables.submissions.id, tables.appeals.submissionId))
    .innerJoin(tables.campaigns, eq(tables.campaigns.id, tables.submissions.campaignId))
    .innerJoin(tables.users, eq(tables.users.id, tables.appeals.creatorId))

/** Open appeals by deadline, nearest first; answered ones newest first (03_SYSTEMS.md section 7). */
export async function staffAppeals(show: 'open' | 'answered') {
  return show === 'open'
    ? base().where(eq(tables.appeals.status, 'open')).orderBy(asc(tables.appeals.dueAt)).limit(200)
    : base().where(ne(tables.appeals.status, 'open')).orderBy(desc(tables.appeals.resolvedAt)).limit(200)
}

export async function appealById(id: string) {
  const [a] = await base().where(eq(tables.appeals.id, id))
  return a ?? null
}

export async function creatorAppeals(creatorId: string) {
  return base().where(eq(tables.appeals.creatorId, creatorId)).orderBy(desc(tables.appeals.createdAt))
}

export const HOUR = 3_600_000
/** Due within a day, or already late: the dashboard and inbox call these out. */
export const dueSoon = (dueAt: Date, now = new Date()) => dueAt.getTime() - now.getTime() <= 24 * HOUR
