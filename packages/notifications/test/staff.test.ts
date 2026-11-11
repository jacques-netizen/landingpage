import { createDb, tables } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  deliverPendingEmails,
  notifyPayoutMethodChange,
  sendStaffMessage,
  setPayoutChangeAlerts,
  StaffMessageError,
  type Email,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

let n = 0
async function user(role?: 'reviewer' | 'finance' | 'admin', status = 'active') {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `s${Date.now() % 1e9}${++n}@test.invalid`, status })
    .returning()
  if (role) await db.insert(tables.staffRoles).values({ userId: u!.id, role })
  return u!
}
const rows = (userId: string, kind: string) =>
  db
    .select()
    .from(tables.notifications)
    .where(and(eq(tables.notifications.userId, userId), eq(tables.notifications.kind, kind)))

describe('payout method alerts', () => {
  it('tells finance and admins, not reviewers or clippers, and not staff who switched it off', async () => {
    const [admin, finance, reviewer, off, clipper] = await Promise.all([
      user('admin'),
      user('finance'),
      user('reviewer'),
      user('admin'),
      user(),
    ])
    await setPayoutChangeAlerts(db, off.id, false)
    await notifyPayoutMethodChange(db, {
      creatorId: clipper.id,
      creatorName: '@kay',
      before: 'USDT on Tron (TRC-20), TQn9Y2…bLSE',
      after: 'Bank transfer, Chase, ending 6789 (United States)',
    })
    const [a] = await rows(admin.id, 'payout_method_changed')
    expect(a!.title).toBe('@kay changed their payout method')
    expect(a!.body).toBe(
      'From USDT on Tron (TRC-20), TQn9Y2…bLSE to Bank transfer, Chase, ending 6789 (United States).',
    )
    expect(a!.link).toBe(`/admin/creators/${clipper.id}`)
    expect(await rows(finance.id, 'payout_method_changed')).toHaveLength(1)
    expect(await rows(reviewer.id, 'payout_method_changed')).toHaveLength(0)
    expect(await rows(off.id, 'payout_method_changed')).toHaveLength(0)
    expect(await rows(clipper.id, 'payout_method_changed')).toHaveLength(0)
  })

  it('says "added" for a first payout method', async () => {
    const admin = await user('admin')
    const clipper = await user()
    await notifyPayoutMethodChange(db, { creatorId: clipper.id, creatorName: '@new', before: null, after: 'X' })
    const [a] = await rows(admin.id, 'payout_method_changed')
    expect(a!.title).toBe('@new added a payout method')
  })

  it('emails with a fixed subject', async () => {
    await deliverPendingEmails(db, { send: async () => {}, limit: 5000 })
    const admin = await user('admin')
    const clipper = await user()
    await notifyPayoutMethodChange(db, { creatorId: clipper.id, creatorName: '@m', before: 'A', after: 'B' })
    const sent: Email[] = []
    await deliverPendingEmails(db, { send: async (e) => void sent.push(e), limit: 5000 })
    const mine = sent.filter((e) => e.to === admin.email)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.subject).toBe('A clipper changed their payout method')
  })
})

describe('staff messages', () => {
  it('reaches each clipper in the app and by email, with no warning or strike, and is audited', async () => {
    await deliverPendingEmails(db, { send: async () => {}, limit: 5000 })
    const staff = await user('reviewer')
    const a = await user()
    const b = await user()
    const sentTo = await sendStaffMessage(db, staff.id, [a.id, b.id, a.id], {
      title: 'Posting tip',
      body: 'Please add the sound link to your captions.',
    })
    expect(sentTo).toBe(2)
    const [m] = await rows(a.id, 'staff_message')
    expect(m!.title).toBe('Posting tip')
    expect(m!.body).toBe('Please add the sound link to your captions.')
    expect(await db.select().from(tables.warnings).where(eq(tables.warnings.creatorId, a.id))).toHaveLength(0)
    const [p] = await db.select().from(tables.creatorProfiles).where(eq(tables.creatorProfiles.userId, a.id))
    expect(p?.strikesActive ?? 0).toBe(0)
    const audit = await db
      .select()
      .from(tables.auditLog)
      .where(and(eq(tables.auditLog.actorId, staff.id), eq(tables.auditLog.action, 'creator.message')))
    expect(audit).toHaveLength(1)
    const sent: Email[] = []
    await deliverPendingEmails(db, { send: async (e) => void sent.push(e), limit: 5000 })
    const mail = sent.find((e) => e.to === a.email)!
    expect(mail.subject).toBe('A message from the team')
    expect(mail.text).toContain('Please add the sound link to your captions.')
  })

  it('uses a default title, skips closed accounts and refuses an empty message', async () => {
    const staff = await user('reviewer')
    const open = await user()
    const closed = await user(undefined, 'closed')
    expect(await sendStaffMessage(db, staff.id, [open.id, closed.id], { body: 'Hello' })).toBe(1)
    expect((await rows(open.id, 'staff_message'))[0]!.title).toBe('A message from the team')
    expect(await rows(closed.id, 'staff_message')).toHaveLength(0)
    await expect(sendStaffMessage(db, staff.id, [open.id], { body: '   ' })).rejects.toBeInstanceOf(StaffMessageError)
    await expect(sendStaffMessage(db, staff.id, [open.id], { body: 'x'.repeat(2001) })).rejects.toBeInstanceOf(
      StaffMessageError,
    )
  })
})
