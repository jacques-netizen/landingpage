import { tables } from '@mde/db'
import { desc, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  approve,
  askForVerification,
  canVerifyViews,
  staffVerifyViews,
  claimFlag,
  creatorVerificationStats,
  decideViewProof,
  latestViewProof,
  listViewProofs,
  requestViewProof,
  submitViewProof,
  verificationBlocked,
  verificationsWaiting,
  verifyOptions,
} from '../src'
import { db, postInReview, sql, user } from './fixtures'

afterAll(() => sql.end())

const HOUR = 3_600_000
const notes = (userId: string) =>
  db
    .select()
    .from(tables.notifications)
    .where(eq(tables.notifications.userId, userId))
    .orderBy(desc(tables.notifications.createdAt))

async function file(uploadedBy: string, name: string, contentType: string) {
  const [f] = await db
    .insert(tables.files)
    .values({ name, contentType, sizeBytes: 3, storage: 'db', data: Buffer.from('abc'), uploadedBy })
    .returning({ id: tables.files.id })
  return f!.id
}

// The mock provider answers by platform and post id, so a picture post here is a TikTok photo post.
const picturePost = (id: string) =>
  db.update(tables.submissions).set({ mediaKind: 'image' }).where(eq(tables.submissions.id, id))

/** A creator with an approved picture post (500 views at submission), an open verification and a recording. */
async function approvedWithProof() {
  const t = await postInReview()
  await picturePost(t.id)
  await approve(db, t.staffId, t.id)
  const now = new Date(t.t0.getTime() + HOUR)
  const proof = await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now })
  const screenshot = await file(t.creator, 'insights.png', 'image/png')
  const recording = await file(t.creator, 'insights.mp4', 'video/mp4')
  return { ...t, now, proof, screenshot, recording }
}

const send = (t: Awaited<ReturnType<typeof approvedWithProof>>, proofId: string, claimedViews: number, now = t.now) =>
  submitViewProof(db, {
    proofId,
    creatorId: t.creator,
    now,
    claimedViews,
    screenshotFileId: null,
    recordingFileId: t.recording,
    note: null,
  })

describe('view verification', () => {
  it('opens on Instagram posts always, on other approved posts only with no scraped views or a count stuck for 48 hours', () => {
    const now = new Date('2026-10-15T12:00:00Z')
    const base = {
      state: 'approved',
      platform: 'tiktok',
      postUrl: 'https://www.tiktok.com/@a/video/123',
      mediaKind: 'video',
      submittedAt: new Date(now.getTime() - 100 * HOUR),
      scrapedViews: 2_000,
      scrapedChangedAt: new Date(now.getTime() - HOUR),
    }
    expect(canVerifyViews({ ...base, platform: 'instagram', postUrl: 'https://www.instagram.com/p/x/' }, now)).toBe(
      'instagram_post',
    )
    expect(
      canVerifyViews({ ...base, platform: 'instagram', postUrl: 'https://www.instagram.com/reel/x/' }, now),
    ).toBeNull()
    expect(canVerifyViews({ ...base, mediaKind: 'image' }, now)).toBe('picture')
    expect(canVerifyViews({ ...base, postUrl: 'https://www.tiktok.com/@a/photo/123' }, now)).toBe('picture')
    expect(canVerifyViews(base, now)).toBeNull()
    expect(canVerifyViews({ ...base, scrapedViews: 0 }, now)).toBe('no_views')
    expect(canVerifyViews({ ...base, scrapedViews: null, scrapedChangedAt: null }, now)).toBe('no_views')
    expect(canVerifyViews({ ...base, scrapedChangedAt: new Date(now.getTime() - 49 * HOUR) }, now)).toBe('stale')
    expect(canVerifyViews({ ...base, scrapedChangedAt: new Date(now.getTime() - 47 * HOUR) }, now)).toBeNull()
    expect(canVerifyViews({ ...base, state: 'needs_review', scrapedViews: 0 }, now)).toBeNull()
    expect(
      canVerifyViews(
        { ...base, state: 'rejected', platform: 'instagram', postUrl: 'https://www.instagram.com/p/x/' },
        now,
      ),
    ).toBeNull()
  })

  it('flags claims over 10 times the scraped count on videos and over 50,000 on picture posts', () => {
    const video = { platform: 'tiktok', postUrl: 'https://www.tiktok.com/@a/video/1', mediaKind: 'video' }
    const picture = { platform: 'instagram', postUrl: 'https://www.instagram.com/p/x/', mediaKind: null }
    expect(claimFlag(video, 9_000, 1_000)).toBeNull()
    expect(claimFlag(video, 10_001, 1_000)).toBe('claim_over_10x')
    expect(claimFlag(video, 40_000, 0)).toBeNull()
    expect(claimFlag(video, 60_000, null)).toBe('claim_over_50k')
    expect(claimFlag(picture, 50_000, 3)).toBeNull()
    expect(claimFlag(picture, 50_001, 3)).toBe('claim_over_50k')
  })

  it('a video with moving views offers no verification; the post owner alone can open one', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    const now = new Date(t.t0.getTime() + HOUR)
    // The mock gave 500 views an hour ago: not zero, not stale.
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now })).rejects.toThrow(
      /cannot be verified right now/i,
    )
    const s = await t.sub()
    const opts = await verifyOptions(db, t.creator, [s], now)
    expect(opts.get(t.id)).toMatchObject({ why: null, pending: false, blocked: false })
    // Two days on with the same count, it opens.
    const later = new Date(t.t0.getTime() + 49 * HOUR)
    expect((await verifyOptions(db, t.creator, [s], later)).get(t.id)?.why).toBe('stale')
    const p = await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: later })
    expect(p.code).toMatch(/^MDE-[34679ACDEFGHJKMNPQRTUVWXY]{4}$/)
    // Asking again gives the same open one back.
    expect((await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: later })).id).toBe(p.id)
    const stranger = await user('other')
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: stranger, now: later })).rejects.toThrow(
      /not found/i,
    )
  })

  it("a verification needs the recording and a count; the screenshot is optional and files must be the creator's", async () => {
    const t = await approvedWithProof()
    const base = { proofId: t.proof.id, creatorId: t.creator, now: t.now, note: null }
    await expect(
      submitViewProof(db, { ...base, claimedViews: 2_000, screenshotFileId: t.screenshot, recordingFileId: null }),
    ).rejects.toThrow(/recording/i)
    await expect(
      submitViewProof(db, { ...base, claimedViews: 0, screenshotFileId: null, recordingFileId: t.recording }),
    ).rejects.toThrow(/view count/i)
    const other = await user('other')
    const theirs = await file(other, 'x.png', 'image/png')
    await expect(
      submitViewProof(db, { ...base, claimedViews: 2_000, screenshotFileId: theirs, recordingFileId: t.recording }),
    ).rejects.toThrow(/screenshot/i)
    await send(t, t.proof.id, 2_000)
    const p = (await latestViewProof(db, t.id))!
    expect(p.status).toBe('submitted')
    expect(p.claimedViews).toBe(2_000)
    expect(p.flag).toBeNull()
    expect(p.screenshotFileId).toBeNull()
    // Waiting for staff: no second one meanwhile.
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: t.now })).rejects.toThrow(
      /waiting for review/i,
    )
    expect((await verifyOptions(db, t.creator, [await t.sub()], t.now)).get(t.id)?.pending).toBe(true)
    const waiting = await listViewProofs(db, 'submitted', { campaignId: t.campaignId })
    expect(waiting.map((x) => x.id)).toContain(p.id)
    expect(waiting.find((x) => x.id === p.id)?.scrapedViews).toBe(500)
    expect((await verificationsWaiting(db)).get(t.campaignId)).toBeGreaterThanOrEqual(1)
    // Another campaign's list does not show it.
    expect((await listViewProofs(db, 'submitted', { campaignId: crypto.randomUUID() })).length).toBe(0)
  })

  it('approving keeps the verified count, sets the views to the higher of scraped and verified, and pays the post', async () => {
    const t = await approvedWithProof()
    await send(t, t.proof.id, 4_000)
    // Staff approve at 3,500 (a different number from the 4,000 claimed).
    const r = await decideViewProof(db, t.staffId, t.proof.id, {
      outcome: 'approve',
      views: 3_500,
      note: 'Insights show 3,500.',
    })
    // 3,500 - 500 baseline = 3,000 counted at $2.00 per 1,000 = $6.00.
    expect(r.deltaCents).toBe(600)
    const s = await t.sub()
    expect(s.verifiedViews).toBe(3_500)
    expect(s.latestViews).toBe(3_500)
    expect(s.countedViews).toBe(3_000)
    expect(s.earnedCents).toBe(600)
    expect(await t.balance('creator_pending', t.creator)).toBe(600)
    const snaps = await db.select().from(tables.viewSnapshots).where(eq(tables.viewSnapshots.submissionId, t.id))
    expect(snaps.some((x) => x.source === 'manual' && x.views === 3_500)).toBe(true)
    const p = (await latestViewProof(db, t.id))!
    expect(p.status).toBe('approved')
    expect(p.setViews).toBe(3_500)
    const audit = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, t.id))
    expect(audit.some((a) => a.action === 'submission.views_verified')).toBe(true)
    const n = (await notes(t.creator))[0]!
    expect(n.kind).toBe('view_proof')
    expect(n.body).toContain('3,500 views verified')
    expect(n.body).toContain('You reported 4,000')
    // The verified count stands until the scraper passes it: a check reading 1,000 changes nothing.
    t.views(1_000)
    await t.check(2)
    expect((await t.sub()).latestViews).toBe(3_500)
    expect((await t.sub()).countedViews).toBe(3_000)
    // A check reading more takes over.
    t.views(5_000)
    expect((await t.check(5)).ran).toBe(true)
    expect((await t.sub()).latestViews).toBe(5_000)
    expect((await t.sub()).countedViews).toBe(4_500)
    // The next verification waits 72 hours after an approval.
    await expect(
      requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: new Date(t.now.getTime() + 2 * HOUR) }),
    ).rejects.toThrow(/less than three days/i)
    const opt = (await verifyOptions(db, t.creator, [await t.sub()], new Date(t.now.getTime() + 2 * HOUR))).get(t.id)!
    expect(opt.nextAt).not.toBeNull()
    const next = await requestViewProof(db, {
      submissionId: t.id,
      creatorId: t.creator,
      now: new Date(Date.now() + 73 * HOUR),
    })
    expect(next.id).not.toBe(t.proof.id)
  })

  it('rejecting needs a reason, changes no views, tells the creator, and the third rejection in a campaign blocks them', async () => {
    const t = await approvedWithProof()
    await send(t, t.proof.id, 9_000)
    await expect(decideViewProof(db, t.staffId, t.proof.id, { outcome: 'reject', note: '' })).rejects.toThrow(
      /why|note/i,
    )
    await decideViewProof(db, t.staffId, t.proof.id, { outcome: 'reject', note: 'The recording never shows the post.' })
    const s = await t.sub()
    expect(s.latestViews).toBe(500)
    expect(s.verifiedViews).toBe(0)
    expect(s.earnedCents).toBe(0)
    expect((await latestViewProof(db, t.id))!.status).toBe('rejected')
    const n = (await notes(t.creator))[0]!
    expect(n.kind).toBe('view_proof')
    expect(n.body).toContain('never shows the post')
    await expect(decideViewProof(db, t.staffId, t.proof.id, { outcome: 'reject', note: 'x' })).rejects.toThrow(
      /already/i,
    )
    // After a rejection a new one may be sent at once. Two more rejections block the creator in this campaign.
    for (let i = 0; i < 2; i++) {
      const again = await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: t.now })
      await send(t, again.id, 9_000)
      await decideViewProof(db, t.staffId, again.id, { outcome: 'reject', note: 'Not the insights screen.' })
    }
    expect(await verificationBlocked(db, t.creator, t.campaignId)).toBe(true)
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: t.now })).rejects.toThrow(
      /cannot send more/i,
    )
    expect((await notes(t.creator)).some((x) => x.title === 'Verification blocked in a campaign')).toBe(true)
    const audit = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, t.creator))
    expect(audit.some((a) => a.action === 'creator.verifications_blocked')).toBe(true)
    const stats = (await creatorVerificationStats(db, t.campaignId)).get(t.creator)!
    expect(stats).toMatchObject({ rejected: 3, blocked: true })
  })

  it('a claim far above the scraped count is flagged for staff', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    const later = new Date(t.t0.getTime() + 49 * HOUR)
    const p = await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: later })
    const recording = await file(t.creator, 'insights.mp4', 'video/mp4')
    await submitViewProof(db, {
      proofId: p.id,
      creatorId: t.creator,
      now: later,
      claimedViews: 50_000,
      screenshotFileId: null,
      recordingFileId: recording,
      note: null,
    })
    expect((await latestViewProof(db, t.id))!.flag).toBe('claim_over_10x')
  })

  it('staff set the views from analytics the creator sent them, with a screenshot, and can ask the creator to verify', async () => {
    const t = await postInReview()
    await approve(db, t.staffId, t.id)
    const shot = await file(t.staffId, 'whatsapp.png', 'image/png')
    await expect(
      staffVerifyViews(db, t.staffId, { submissionId: t.id, views: 0, screenshotFileId: shot, note: null }),
    ).rejects.toThrow(/analytics show/i)
    const r = await staffVerifyViews(db, t.staffId, {
      submissionId: t.id,
      views: 6_500,
      screenshotFileId: shot,
      note: 'Sent over WhatsApp.',
      comments: 80,
    })
    // Comments as entered; likes kept from the last check (500 views / 20), never dropped to nothing.
    const [snap] = await db
      .select()
      .from(tables.viewSnapshots)
      .where(eq(tables.viewSnapshots.submissionId, t.id))
      .orderBy(desc(tables.viewSnapshots.takenAt))
      .limit(1)
    expect(snap).toMatchObject({ source: 'manual', views: 6_500, likes: 25, comments: 80 })
    // 6,500 - 500 baseline = 6,000 counted at $2.00 per 1,000 = $12.00.
    expect(r.deltaCents).toBe(1_200)
    const s = await t.sub()
    expect(s.verifiedViews).toBe(6_500)
    expect(s.latestViews).toBe(6_500)
    expect(s.earnedCents).toBe(1_200)
    const p = (await latestViewProof(db, t.id))!
    expect(p.status).toBe('approved')
    expect(p.setViews).toBe(6_500)
    expect(p.screenshotFileId).toBe(shot)
    expect(p.reviewerId).toBe(t.staffId)
    expect((await notes(t.creator))[0]!.title).toBe('Your views were updated from your analytics')
    const audit = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, t.id))
    expect(audit.some((a) => a.action === 'submission.views_verified')).toBe(true)
    await askForVerification(db, t.staffId, t.id, 'Your views look higher than we can read.')
    expect((await notes(t.creator))[0]!.title).toBe('Please verify the views on your post')
    expect(audit.length).toBeGreaterThan(0)
  })
})
