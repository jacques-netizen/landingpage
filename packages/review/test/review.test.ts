import { tables } from '@mde/db'
import { and, desc, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  activeStrikes,
  answerInfo,
  addBusinessDays,
  approve,
  clearFlag,
  deleteSubmission,
  expireStrikes,
  issueWarning,
  openAppeal,
  reject,
  requestInfo,
  resolveAppeal,
  setPending,
  setStaffNotes,
  setSuspended,
} from '../src'
import { db, postInReview, sql, user } from './fixtures'

afterAll(() => sql.end())

const notes = (userId: string) =>
  db
    .select()
    .from(tables.notifications)
    .where(eq(tables.notifications.userId, userId))
    .orderBy(desc(tables.notifications.createdAt))
const audits = (entityId: string) => db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, entityId))

describe('reviewer decisions', () => {
  it('approving lets the post earn from every view since submission', async () => {
    const t = await postInReview()
    t.views(3_000)
    await t.check(2) // counted views do not move while in review
    expect((await t.sub()).countedViews).toBe(0)
    const r = await approve(db, t.staffId, t.id)
    // 3,000 - 500 baseline = 2,500 counted at $2.00 per 1,000 = 500 cents.
    expect(r.deltaCents).toBe(500)
    expect(await t.sub()).toMatchObject({ state: 'earning', countedViews: 2_500, earnedCents: 500 })
    expect((await notes(t.creator))[0]).toMatchObject({ kind: 'submission_approved' })
    expect((await audits(t.id)).map((a) => a.action)).toContain('submission.approve')
  })

  it('rejecting an approved post reverses its earnings exactly', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    t.views(61_234)
    await t.check(2)
    const earned = (await t.sub()).earnedCents
    expect(earned).toBe(12_146) // floor(60,734 x 200 / 1,000)
    const budgetBefore = await t.balance('campaign_budget', t.campaignId)
    const r = await reject(db, t.staffId, t.id, { reasonCode: 'not_original', note: 'Reposted from another account.' })
    expect(r.reversedCents).toBe(12_146)
    expect(await t.balance('creator_pending', t.creator)).toBe(0)
    expect(await t.balance('campaign_budget', t.campaignId)).toBe(budgetBefore + 12_146)
    expect(await t.sub()).toMatchObject({
      state: 'rejected',
      earnedCents: 0,
      reasonCode: 'not_original',
      nextCheckAt: null,
    })
    const [n] = await notes(t.creator)
    expect(n).toMatchObject({
      kind: 'submission_rejected',
      body: 'The content is not original. Reposted from another account.',
    })
  })

  it('needs a reason from the list, a note for Other, and never rejects a paid out post', async () => {
    const t = await postInReview()
    await expect(reject(db, t.staffId, t.id, { reasonCode: 'made_up' })).rejects.toMatchObject({
      code: 'reason_required',
    })
    await expect(reject(db, t.staffId, t.id, { reasonCode: 'other' })).rejects.toMatchObject({ code: 'note_required' })
    await db.update(tables.submissions).set({ state: 'paid_out' }).where(eq(tables.submissions.id, t.id))
    await expect(reject(db, t.staffId, t.id, { reasonCode: 'brand_unsafe' })).rejects.toMatchObject({
      code: 'paid_out',
    })
  })

  it('asks the creator for information', async () => {
    const t = await postInReview()
    await requestInfo(db, t.staffId, t.id, 'Can you show the sound in the first 5 seconds?')
    expect(await t.sub()).toMatchObject({
      state: 'needs_info',
      reasonNote: 'Can you show the sound in the first 5 seconds?',
    })
    expect((await notes(t.creator))[0]).toMatchObject({ kind: 'needs_info' })
    // The creator answers from the drawer; the post goes back to the queue with the answer.
    await expect(answerInfo(db, t.staffId, t.id, 'Here it is.')).rejects.toMatchObject({ code: 'not_found' })
    await expect(answerInfo(db, t.creator, t.id, '  ')).rejects.toMatchObject({ code: 'note_required' })
    await answerInfo(db, t.creator, t.id, 'The sound starts at 0:02, see the pinned comment.')
    expect(await t.sub()).toMatchObject({
      state: 'needs_review',
      creatorNote: 'The sound starts at 0:02, see the pinned comment.',
    })
    expect((await audits(t.id)).map((a) => a.action)).toContain('submission.info_reply')
    await expect(answerInfo(db, t.creator, t.id, 'Again')).rejects.toMatchObject({ code: 'wrong_state' })
  })

  it('clearing a flag needs a note and puts the post back where it was', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    t.views(2_000, { authorPlatformUserId: 'someone-else' })
    await t.check(2)
    expect((await t.sub()).state).toBe('flagged')
    const [flag] = await db.select().from(tables.fraudFlags).where(eq(tables.fraudFlags.submissionId, t.id))
    await expect(clearFlag(db, t.staffId, flag!.id, ' ')).rejects.toMatchObject({ code: 'note_required' })
    await clearFlag(db, t.staffId, flag!.id, 'Same creator, account renamed.')
    expect((await t.sub()).state).toBe('earning')
  })

  it('rejecting a post with a view jump confirms the flag and issues a strike', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    let v = 500
    for (let h = 2; h <= 12; h += 2) {
      v += 1_000
      t.views(v)
      await t.check(h)
    }
    t.views(v + 90_000)
    await t.check(14)
    expect((await t.sub()).state).toBe('flagged')
    const r = await reject(db, t.staffId, t.id, { reasonCode: 'suspected_view_inflation' })
    expect(r.warned).toBe(true)
    const flags = await db
      .select()
      .from(tables.fraudFlags)
      .where(and(eq(tables.fraudFlags.submissionId, t.id), eq(tables.fraudFlags.kind, 'view_jump')))
    expect(flags[0]!.status).toBe('confirmed')
    expect(await activeStrikes(db, t.creator)).toBe(1)
  })
})

// Submission management inside a campaign (testing report, 2026-10-08): staff can put a decided post
// back to pending, or delete it. Money moves only through the engine, exactly as for a rejection.
describe('set to pending and delete', () => {
  it('putting an approved post back to pending reverses its earnings and returns it to review', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    t.views(10_500)
    await t.check(2)
    expect((await t.sub()).earnedCents).toBe(2_000) // 10,000 counted at $2.00 per 1,000
    const budgetBefore = await t.balance('campaign_budget', t.campaignId)
    const r = await setPending(db, t.staffId, t.id)
    expect(r).toEqual({ previousState: 'earning', reversedCents: 2_000 })
    expect(await t.sub()).toMatchObject({ state: 'needs_review', earnedCents: 0, countedViews: 0, reasonCode: null })
    expect(await t.balance('creator_pending', t.creator)).toBe(0)
    expect(await t.balance('campaign_budget', t.campaignId)).toBe(budgetBefore + 2_000)
    expect((await audits(t.id)).map((a) => a.action)).toContain('submission.set_pending')
    expect((await notes(t.creator))[0]).toMatchObject({
      kind: 'submission_pending',
      title: 'Your post is back in review',
    })
    // Approving again pays it from the same views, once.
    const again = await approve(db, t.staffId, t.id)
    expect(again.deltaCents).toBe(2_000)
    expect(await t.balance('creator_pending', t.creator)).toBe(2_000)
  })

  it('puts a denied post back to pending, and refuses posts already pending or paid out', async () => {
    const t = await postInReview()
    await expect(setPending(db, t.staffId, t.id)).rejects.toMatchObject({ code: 'wrong_state' })
    await reject(db, t.staffId, t.id, { reasonCode: 'not_original' })
    await setPending(db, t.staffId, t.id)
    expect(await t.sub()).toMatchObject({ state: 'needs_review', reasonCode: null, reasonNote: null })
    await db.update(tables.submissions).set({ state: 'paid_out' }).where(eq(tables.submissions.id, t.id))
    await expect(setPending(db, t.staffId, t.id)).rejects.toMatchObject({ code: 'paid_out' })
  })

  it('deleting a post reverses its earnings, removes it and keeps the audit record', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    t.views(5_500)
    await t.check(2)
    expect((await t.sub()).earnedCents).toBe(1_000)
    const budgetBefore = await t.balance('campaign_budget', t.campaignId)
    const r = await deleteSubmission(db, t.staffId, t.id)
    expect(r).toEqual({ reversedCents: 1_000 })
    expect(await db.select().from(tables.submissions).where(eq(tables.submissions.id, t.id))).toEqual([])
    expect(await t.balance('creator_pending', t.creator)).toBe(0)
    expect(await t.balance('campaign_budget', t.campaignId)).toBe(budgetBefore + 1_000)
    const [a] = (await audits(t.id)).filter((x) => x.action === 'submission.delete')
    expect(a).toMatchObject({ actorId: t.staffId, before: expect.objectContaining({ state: 'earning' }) })
    await expect(deleteSubmission(db, t.staffId, t.id)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('never deletes a paid out post', async () => {
    const t = await postInReview()
    await db.update(tables.submissions).set({ state: 'paid_out' }).where(eq(tables.submissions.id, t.id))
    await expect(deleteSubmission(db, t.staffId, t.id)).rejects.toMatchObject({ code: 'paid_out' })
  })
})

describe('appeals', () => {
  it('replies are due in working days', () => {
    // Friday 2 October 2026 + 5 working days = Friday 9 October.
    expect(addBusinessDays(new Date('2026-10-02T15:00:00Z'), 5).toISOString()).toBe('2026-10-09T15:00:00.000Z')
    expect(addBusinessDays(new Date('2026-10-03T09:00:00Z'), 1).toISOString()).toBe('2026-10-05T09:00:00.000Z')
  })

  it('an overturned appeal restores the post, clears its strike, and the next check pays it', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    t.views(5_500)
    await t.check(2) // earns 1,000
    await reject(db, t.staffId, t.id, { reasonCode: 'missing_logo' })
    await issueWarning(db, t.staffId, t.creator, { reasonCode: 'missing_logo', submissionId: t.id })
    expect(await activeStrikes(db, t.creator)).toBe(1)
    const reviewer = await user('reviewer', 'reviewer')

    const a = await openAppeal(db, t.creator, t.id, {
      message: 'The logo is at 0:03, top left.',
      links: ['https://example.com/frame.png', 'not a link'],
    })
    expect(a.links).toEqual(['https://example.com/frame.png'])
    expect(a.dueAt.getTime()).toBeGreaterThan(Date.now())
    expect((await t.sub()).state).toBe('appealed')
    expect((await notes(reviewer))[0]).toMatchObject({ kind: 'appeal_opened', link: `/admin/appeals/${a.id}` })
    await expect(openAppeal(db, t.creator, t.id, { message: 'again' })).rejects.toMatchObject({
      code: 'already_appealed',
    })

    await expect(resolveAppeal(db, t.staffId, a.id, { outcome: 'overturned', reply: '' })).rejects.toMatchObject({
      code: 'note_required',
    })
    const r = await resolveAppeal(db, t.staffId, a.id, {
      outcome: 'overturned',
      reply: 'You are right, the logo is visible.',
    })
    expect(r.strikesCleared).toBe(1)
    expect(await activeStrikes(db, t.creator)).toBe(0)
    expect(await t.sub()).toMatchObject({ state: 'approved', earnedCents: 0 })
    expect((await notes(t.creator))[0]).toMatchObject({
      kind: 'appeal_reply',
      body: 'You are right, the logo is visible.',
    })

    // The next view check pays it from its counted views: (8,500 - 500) x $2.00 / 1,000 = $16.00.
    t.views(8_500)
    const c = await t.check(5)
    expect(c).toMatchObject({ ran: true, deltaCents: 1_600 })
    expect(await t.sub()).toMatchObject({ state: 'earning', earnedCents: 1_600 })
  })

  it('an upheld appeal leaves the decision as it was', async () => {
    const t = await postInReview()
    await reject(db, t.staffId, t.id, { reasonCode: 'brand_unsafe' })
    const a = await openAppeal(db, t.creator, t.id, { message: 'Please look again.' })
    await resolveAppeal(db, t.staffId, a.id, { outcome: 'upheld', reply: 'The post breaks the content rules.' })
    expect((await t.sub()).state).toBe('rejected')
    await expect(resolveAppeal(db, t.staffId, a.id, { outcome: 'overturned', reply: 'x' })).rejects.toMatchObject({
      code: 'wrong_state',
    })
  })

  it('only the creator can appeal, and only rejected or removed posts', async () => {
    const t = await postInReview()
    await expect(openAppeal(db, t.creator, t.id, { message: 'hi' })).rejects.toMatchObject({ code: 'wrong_state' })
    const other = await user('other')
    await expect(openAppeal(db, other, t.id, { message: 'hi' })).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('warnings and suspension', () => {
  it('suggests suspension at 3 active strikes, and strikes expire after strike_days', async () => {
    const staff = await user('staff', 'admin')
    const creator = await user('creator')
    const now = new Date()
    for (let i = 0; i < 2; i++)
      expect((await issueWarning(db, staff, creator, { reasonCode: 'brand_unsafe' }, now)).suggestSuspension).toBe(
        false,
      )
    const third = await issueWarning(db, staff, creator, { reasonCode: 'brand_unsafe' }, now)
    expect(third).toMatchObject({ strikes: 3, suggestSuspension: true })
    // 61 days later the strikes have expired.
    const later = new Date(now.getTime() + 61 * 86_400_000)
    expect(await activeStrikes(db, creator, later)).toBe(0)
    await expireStrikes(db, later)
    const [p] = await db.select().from(tables.creatorProfiles).where(eq(tables.creatorProfiles.userId, creator))
    expect(p!.strikesActive).toBe(0)
  })

  it('suspending and restoring needs a reason and is audited', async () => {
    const admin = await user('admin', 'admin')
    const creator = await user('creator')
    await expect(setSuspended(db, admin, creator, true, '')).rejects.toMatchObject({ code: 'note_required' })
    await setSuspended(db, admin, creator, true, 'Three confirmed view inflation strikes.')
    expect((await db.select().from(tables.users).where(eq(tables.users.id, creator)))[0]!.status).toBe('suspended')
    await setSuspended(db, admin, creator, false, 'Reviewed with the creator.')
    expect((await audits(creator)).map((a) => a.action)).toEqual(['user.suspend', 'user.restore'])
  })

  it('staff notes on a creator are saved and audited', async () => {
    const staff = await user('reviewer', 'reviewer')
    const creator = await user('creator')
    await setStaffNotes(db, staff, creator, '  Prefers email. Spoke on Monday.  ')
    const [p] = await db.select().from(tables.creatorProfiles).where(eq(tables.creatorProfiles.userId, creator))
    expect(p!.staffNotes).toBe('Prefers email. Spoke on Monday.')
    await setStaffNotes(db, staff, creator, '')
    const [after] = await db.select().from(tables.creatorProfiles).where(eq(tables.creatorProfiles.userId, creator))
    expect(after!.staffNotes).toBeNull()
    const rows = (await audits(creator)).filter((a) => a.action === 'creator.notes')
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.actorId)).toEqual([staff, staff])
  })
})
