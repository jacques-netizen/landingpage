// The email-send job (03_SYSTEMS.md section 11): emails go out from notification rows, with retries.
// Safe to run on two workers at once: rows are claimed with SKIP LOCKED and a claim expires.
import { env } from '@mde/config'
import { tables, type Db, type NotificationKind } from '@mde/db'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { escapeHtml, sendEmail, type SendEmail } from './email'
import { EMAIL_SUBJECT } from './kinds'
import { preferenceLinks } from './tokens'

const { notifications, users } = tables

export const MAX_EMAIL_ATTEMPTS = 5
const CLAIM_MS = 10 * 60_000

type Row = typeof notifications.$inferSelect

export function notificationEmail(n: Pick<Row, 'kind' | 'title' | 'body' | 'link'>, to: string, userId: string) {
  const base = env().APP_URL.replace(/\/$/, '')
  const url = n.link ? `${base}${n.link.startsWith('/') ? '' : '/'}${n.link}` : `${base}/notifications`
  return {
    to,
    subject: EMAIL_SUBJECT[n.kind as NotificationKind] ?? 'An update from your account',
    text: [n.title, n.body, `Open it here: ${url}`].filter(Boolean).join('\n\n'),
    html: [
      `<p style="font:600 16px Archivo,Arial,sans-serif;color:#0E0E0C">${escapeHtml(n.title)}</p>`,
      n.body ? `<p style="font:15px Archivo,Arial,sans-serif;color:#0E0E0C">${escapeHtml(n.body)}</p>` : '',
      `<p style="font:15px Archivo,Arial,sans-serif"><a href="${escapeHtml(url)}" style="color:#0E0E0C">Open it</a></p>`,
    ].join(''),
    ...preferenceLinks(userId),
  }
}

export async function deliverPendingEmails(
  db: Db,
  opts: { send?: SendEmail; now?: Date; limit?: number; log?: (o: object) => void } = {},
) {
  const send = opts.send ?? sendEmail
  const now = opts.now ?? new Date()
  const log = opts.log ?? ((o) => console.log(JSON.stringify(o)))
  // A worker that died mid-send leaves rows claimed; they go back to the queue after the claim expires.
  await db
    .update(notifications)
    .set({ emailStatus: 'pending' })
    .where(
      and(
        eq(notifications.emailStatus, 'sending'),
        lt(notifications.emailClaimedAt, new Date(now.getTime() - CLAIM_MS)),
      ),
    )
  const claimed = await db.execute<{ id: string }>(sql`
    update notifications n set email_status = 'sending', email_claimed_at = ${now.toISOString()}, email_attempts = n.email_attempts + 1
    from (select id from notifications where email_status = 'pending' order by created_at limit ${opts.limit ?? 50}
          for update skip locked) c
    where n.id = c.id returning n.id`)
  const ids = claimed.map((r) => r.id)
  const out = { sent: 0, skipped: 0, retry: 0, failed: 0 }
  if (!ids.length) return out
  const rows = await db
    .select({ n: notifications, email: users.email, notifyEmail: users.notifyEmail, status: users.status })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(inArray(notifications.id, ids))
  for (const { n, email, notifyEmail, status } of rows) {
    const set = (v: Partial<Row>) => db.update(notifications).set(v).where(eq(notifications.id, n.id))
    if (!notifyEmail || status === 'closed') {
      await set({ emailStatus: 'skipped' })
      out.skipped++
      continue
    }
    try {
      await send(notificationEmail(n, email, n.userId))
      await set({ emailStatus: 'sent', emailedAt: new Date() })
      out.sent++
    } catch (e) {
      const final = n.emailAttempts >= MAX_EMAIL_ATTEMPTS
      await set({ emailStatus: final ? 'failed' : 'pending' })
      if (final) out.failed++
      else out.retry++
      log({ level: final ? 'error' : 'warn', msg: 'notification email failed', notificationId: n.id, err: String(e) })
    }
  }
  return out
}
