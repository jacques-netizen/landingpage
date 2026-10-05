// The in-app list and the reader's preferences (03_SYSTEMS.md section 9 and section 10 routes).
import { tables, type DbOrTx } from '@mde/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

const { notifications, users } = tables

export function listNotifications(d: DbOrTx, userId: string, limit = 100) {
  return d
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function unreadCount(d: DbOrTx, userId: string) {
  const [r] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return r?.n ?? 0
}

export async function markAllRead(d: DbOrTx, userId: string, now = new Date()) {
  await d
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}

export type Preferences = { email: boolean; newCampaigns: boolean }

export async function getPreferences(d: DbOrTx, userId: string): Promise<Preferences | null> {
  const [u] = await d
    .select({ email: users.notifyEmail, newCampaigns: users.notifyNewCampaigns })
    .from(users)
    .where(eq(users.id, userId))
  return u ?? null
}

export async function setPreferences(d: DbOrTx, userId: string, p: Partial<Preferences>) {
  const set: Partial<typeof users.$inferInsert> = {}
  if (p.email !== undefined) set.notifyEmail = p.email
  if (p.newCampaigns !== undefined) set.notifyNewCampaigns = p.newCampaigns
  if (Object.keys(set).length) await d.update(users).set(set).where(eq(users.id, userId))
}
