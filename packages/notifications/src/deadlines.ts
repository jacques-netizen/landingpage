// The appeal-deadlines job (03_SYSTEMS.md section 11): tell reviewers and admins once when an open
// appeal is within 24 hours of its reply date. Running it again sends nothing new.
import { notify, tables, type Db } from '@mde/db'
import { and, eq, inArray, lte, notExists, sql } from 'drizzle-orm'

const { appeals, notifications, staffRoles } = tables

export async function notifyAppealDeadlines(db: Db, now = new Date()) {
  const link = sql`'/admin/appeals/' || ${appeals.id}::text`
  const due = await db
    .select({ id: appeals.id, dueAt: appeals.dueAt })
    .from(appeals)
    .where(
      and(
        eq(appeals.status, 'open'),
        lte(appeals.dueAt, new Date(now.getTime() + 24 * 3_600_000)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(notifications)
            .where(and(eq(notifications.kind, 'appeal_due'), eq(notifications.link, link))),
        ),
      ),
    )
  if (!due.length) return { appeals: 0 }
  const staff = await db
    .selectDistinct({ id: staffRoles.userId })
    .from(staffRoles)
    .where(inArray(staffRoles.role, ['reviewer', 'admin']))
  for (const a of due)
    await db.transaction(async (tx) => {
      for (const { id } of staff)
        await notify(tx, id, 'appeal_due', {
          title: 'An appeal is due within 24 hours',
          body: `Reply by ${a.dueAt.toISOString().replace('T', ' ').slice(0, 16)} UTC.`,
          link: `/admin/appeals/${a.id}`,
        })
    })
  return { appeals: due.length }
}
