import { createDb, notify, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  deliverPendingEmails,
  EMAIL_SUBJECT,
  listNotifications,
  markAllRead,
  MAX_EMAIL_ATTEMPTS,
  notifyAppealDeadlines,
  preferenceLinks,
  setPreferences,
  unreadCount,
  verifyPreferencesToken,
  withFooter,
  type Email,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

let n = 0
async function user(role?: 'reviewer' | 'admin') {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `n${Date.now() % 1e9}${++n}@test.invalid` })
    .returning()
  if (role) await db.insert(tables.staffRoles).values({ userId: u!.id, role })
  return u!
}
const row = async (userId: string) =>
  (await db.select().from(tables.notifications).where(eq(tables.notifications.userId, userId)))[0]!

// Each test drains the queue, so earlier tests' rows do not leak into later counts.
async function drain() {
  await deliverPendingEmails(db, { send: async () => {}, limit: 1000 })
}

describe('notification emails', () => {
  it('sends each notification once, in plain text and HTML, with the legal entity and a preferences link', async () => {
    await drain()
    const u = await user()
    await notify(db, u.id, 'earnings_released', {
      title: 'Earnings released',
      body: '$12.50 is now available to withdraw.',
      link: '/wallet',
    })
    const sent: Email[] = []
    const r = await deliverPendingEmails(db, { send: async (e) => void sent.push(e) })
    expect(r.sent).toBe(1)
    expect(sent[0]!.to).toBe(u.email)
    expect(sent[0]!.text).toContain('$12.50 is now available to withdraw.')
    expect(sent[0]!.text).toContain('https://app.example.test/wallet')
    expect(sent[0]!.preferencesUrl).toContain('/email-preferences?u=')
    const footer = withFooter(sent[0]!)
    expect(footer.text).toContain('Example Legal Entity Ltd')
    expect(footer.text).toContain('Change or stop these emails: https://app.example.test/email-preferences?u=')
    expect(footer.html).toContain('Example Legal Entity Ltd')
    expect((await row(u.id)).emailStatus).toBe('sent')
    // Running again sends nothing.
    expect((await deliverPendingEmails(db, { send: async (e) => void sent.push(e) })).sent).toBe(0)
    expect(sent).toHaveLength(1)
  })

  it('never puts money amounts or reasons in a subject', async () => {
    for (const subject of Object.values(EMAIL_SUBJECT)) {
      expect(subject).not.toMatch(/[$€£]|\d/)
      expect(subject).not.toMatch(/—/)
    }
    await drain()
    const u = await user()
    await notify(db, u.id, 'submission_rejected', {
      title: 'Your post was not accepted',
      body: 'A required hashtag is missing.',
    })
    const sent: Email[] = []
    await deliverPendingEmails(db, { send: async (e) => void sent.push(e) })
    expect(sent[0]!.subject).toBe('An update on your post')
  })

  it('skips the email when the reader turned email off, but keeps the in-app notification', async () => {
    await drain()
    const u = await user()
    await setPreferences(db, u.id, { email: false })
    await notify(db, u.id, 'submission_approved', { title: 'Your post was approved' })
    const r = await deliverPendingEmails(db, { send: async () => {} })
    expect(r).toMatchObject({ sent: 0, skipped: 1 })
    expect(await unreadCount(db, u.id)).toBe(1)
  })

  it('retries a failed send and gives up after the last attempt', async () => {
    await drain()
    const u = await user()
    await notify(db, u.id, 'submission_approved', { title: 'Your post was approved' })
    const fail = async () => {
      throw new Error('provider down')
    }
    for (let i = 1; i < MAX_EMAIL_ATTEMPTS; i++) {
      expect(await deliverPendingEmails(db, { send: fail, log: () => {} })).toMatchObject({ retry: 1 })
      expect((await row(u.id)).emailStatus).toBe('pending')
    }
    expect(await deliverPendingEmails(db, { send: fail, log: () => {} })).toMatchObject({ failed: 1 })
    expect((await row(u.id)).emailStatus).toBe('failed')
  })

  it('takes back a claim a crashed worker left behind', async () => {
    await drain()
    const u = await user()
    await notify(db, u.id, 'submission_approved', { title: 'Your post was approved' })
    await db
      .update(tables.notifications)
      .set({ emailStatus: 'sending', emailClaimedAt: new Date(Date.now() - 11 * 60_000) })
      .where(eq(tables.notifications.userId, u.id))
    expect((await deliverPendingEmails(db, { send: async () => {} })).sent).toBe(1)
  })
})

describe('in-app list and preferences', () => {
  it('lists newest first and marks everything read', async () => {
    const u = await user()
    await notify(db, u.id, 'submission_approved', { title: 'First' })
    await notify(db, u.id, 'needs_info', { title: 'Second' })
    expect((await listNotifications(db, u.id)).map((x) => x.title)).toEqual(['Second', 'First'])
    expect(await unreadCount(db, u.id)).toBe(2)
    await markAllRead(db, u.id)
    expect(await unreadCount(db, u.id)).toBe(0)
  })

  it('preference links are signed for one reader only', () => {
    const { preferencesUrl } = preferenceLinks('11111111-1111-1111-1111-111111111111')
    const t = new URL(preferencesUrl).searchParams.get('t')!
    expect(verifyPreferencesToken('11111111-1111-1111-1111-111111111111', t)).toBe(true)
    expect(verifyPreferencesToken('22222222-2222-2222-2222-222222222222', t)).toBe(false)
    expect(verifyPreferencesToken('11111111-1111-1111-1111-111111111111', 'forged')).toBe(false)
  })
})

describe('appeal deadlines', () => {
  it('tells reviewers and admins once when an appeal is within 24 hours', async () => {
    const reviewer = await user('reviewer')
    const creator = await user()
    const [c] = await sql`
      insert into campaigns (type, title, platforms, budget_cents, rate_cents_per_1000)
      values ('clipping', 'Deadline test', '{tiktok}', 100000, 200) returning id`
    const [t] = await sql`
      insert into terms_versions (campaign_id, body_markdown, effective_at) values (${c!.id}, 'Terms', now()) returning id`
    const [s] = await sql`
      insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
        rate_cents_per_1000_locked, submitted_at)
      values (${c!.id}, ${creator.id}, 'tiktok', ${`https://www.tiktok.com/@x/video/${n}`}, ${`p${n}`}, 'appealed',
        ${t!.id}, 200, now())
      returning id`
    const [a] = await sql`
      insert into appeals (submission_id, creator_id, message, due_at)
      values (${s!.id}, ${creator.id}, 'Look again', now() + interval '5 hours') returning id`
    expect((await notifyAppealDeadlines(db)).appeals).toBeGreaterThanOrEqual(1)
    const mine = (await listNotifications(db, reviewer.id)).filter((x) => x.link === `/admin/appeals/${a!.id}`)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.kind).toBe('appeal_due')
    await notifyAppealDeadlines(db)
    expect((await listNotifications(db, reviewer.id)).filter((x) => x.link === `/admin/appeals/${a!.id}`)).toHaveLength(
      1,
    )
  })
})
