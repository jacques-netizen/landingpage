import { tables } from '@mde/db'
import { desc, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  approve,
  canProveViews,
  decideViewProof,
  latestViewProof,
  listViewProofs,
  requestViewProof,
  submitViewProof,
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

const picture = (id: string) =>
  db.update(tables.submissions).set({ mediaKind: 'image' }).where(eq(tables.submissions.id, id))

/** A creator with an approved picture post (500 views at submission), a code, and the two files. */
async function approvedWithProof() {
  const t = await postInReview()
  await picture(t.id)
  await approve(db, t.staffId, t.id)
  const now = new Date(t.t0.getTime() + HOUR)
  const proof = await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now })
  const screenshot = await file(t.creator, 'analytics.png', 'image/png')
  const recording = await file(t.creator, 'analytics.mp4', 'video/mp4')
  return { ...t, now, proof, screenshot, recording }
}

describe('view proofs', () => {
  it('only picture posts can prove views; videos, reels and YouTube never can', async () => {
    const t = await postInReview()
    const now = new Date(t.t0.getTime() + HOUR)
    // The mock describes the post as a video (it has a duration): no proof.
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now })).rejects.toThrow(
      /only picture posts/i,
    )
    const base = {
      state: 'approved',
      platform: 'instagram',
      postUrl: 'https://www.instagram.com/p/abc/',
      mediaKind: null,
    }
    expect(canProveViews({ ...base, mediaKind: 'image' })).toBe(true)
    expect(canProveViews({ ...base, mediaKind: 'video' })).toBe(false)
    expect(canProveViews({ ...base, postUrl: 'https://www.instagram.com/reel/abc/' })).toBe(false)
    expect(canProveViews({ ...base, platform: 'youtube', mediaKind: 'image' })).toBe(false)
    expect(canProveViews({ ...base, platform: 'tiktok', postUrl: 'https://www.tiktok.com/@a/photo/123' })).toBe(true)
    expect(canProveViews({ ...base, platform: 'tiktok', postUrl: 'https://www.tiktok.com/@a/video/123' })).toBe(false)
    expect(canProveViews({ ...base, state: 'rejected', mediaKind: 'image' })).toBe(false)
  })

  it('the code is one time, expires after 24 hours, and only the post owner can ask for it', async () => {
    const t = await postInReview()
    await picture(t.id)
    const now = new Date(t.t0.getTime() + HOUR)
    const p = await requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now })
    expect(p.code).toMatch(/^MDE-[34679ACDEFGHJKMNPQRTUVWXY]{4}$/)
    expect(p.expiresAt.getTime()).toBe(now.getTime() + 24 * HOUR)
    // Asking again within the day gives the same open request, not a second code.
    const again = await requestViewProof(db, {
      submissionId: t.id,
      creatorId: t.creator,
      now: new Date(now.getTime() + HOUR),
    })
    expect(again.id).toBe(p.id)
    expect(again.code).toBe(p.code)
    // After it expires, a fresh code.
    const later = await requestViewProof(db, {
      submissionId: t.id,
      creatorId: t.creator,
      now: new Date(now.getTime() + 25 * HOUR),
    })
    expect(later.id).not.toBe(p.id)
    const stranger = await user('other')
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: stranger, now })).rejects.toThrow(/not found/i)
  })

  it('a proof needs both files, a count that is not below the current views, and a live code', async () => {
    const t = await approvedWithProof()
    const base = { proofId: t.proof.id, creatorId: t.creator, now: t.now, note: null }
    await expect(
      submitViewProof(db, { ...base, claimedViews: 2_000, screenshotFileId: t.screenshot, recordingFileId: null }),
    ).rejects.toThrow(/recording/i)
    await expect(
      submitViewProof(db, { ...base, claimedViews: 400, screenshotFileId: t.screenshot, recordingFileId: t.recording }),
    ).rejects.toThrow(/go up/i)
    // Someone else's file is not accepted as this creator's.
    const other = await user('other')
    const theirs = await file(other, 'x.png', 'image/png')
    await expect(
      submitViewProof(db, { ...base, claimedViews: 2_000, screenshotFileId: theirs, recordingFileId: t.recording }),
    ).rejects.toThrow(/screenshot/i)
    await expect(
      submitViewProof(db, {
        ...base,
        now: new Date(t.now.getTime() + 25 * HOUR),
        claimedViews: 2_000,
        screenshotFileId: t.screenshot,
        recordingFileId: t.recording,
      }),
    ).rejects.toThrow(/expired/i)
    await submitViewProof(db, {
      ...base,
      claimedViews: 2_000,
      screenshotFileId: t.screenshot,
      recordingFileId: t.recording,
    })
    const p = (await latestViewProof(db, t.id))!
    expect(p.status).toBe('submitted')
    expect(p.claimedViews).toBe(2_000)
    // Waiting for review: no second request meanwhile.
    await expect(requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: t.now })).rejects.toThrow(
      /waiting for review/i,
    )
    expect((await listViewProofs(db, 'submitted')).map((x) => x.id)).toContain(p.id)
  })

  it('approving sets the views, counts them from the baseline and pays the post, with an audit row and a notification', async () => {
    const t = await approvedWithProof()
    await submitViewProof(db, {
      proofId: t.proof.id,
      creatorId: t.creator,
      now: t.now,
      claimedViews: 4_000,
      screenshotFileId: t.screenshot,
      recordingFileId: t.recording,
      note: 'Picture post, no analytics API.',
    })
    // Staff set 3,500 (what the recording shows), not the 4,000 claimed.
    const r = await decideViewProof(db, t.staffId, t.proof.id, {
      outcome: 'approve',
      views: 3_500,
      note: 'Recording shows 3,500.',
    })
    // 3,500 - 500 baseline = 3,000 counted at $2.00 per 1,000 = $6.00.
    expect(r.deltaCents).toBe(600)
    const s = await t.sub()
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
    expect(audit.some((a) => a.action === 'submission.views_set_by_proof')).toBe(true)
    expect((await notes(t.creator))[0]!.kind).toBe('view_proof')
    // Views only go up: a later proof cannot set fewer.
    const next = await requestViewProof(db, {
      submissionId: t.id,
      creatorId: t.creator,
      now: new Date(t.now.getTime() + 25 * HOUR),
    })
    await submitViewProof(db, {
      proofId: next.id,
      creatorId: t.creator,
      now: new Date(t.now.getTime() + 25 * HOUR),
      claimedViews: 5_000,
      screenshotFileId: t.screenshot,
      recordingFileId: t.recording,
      note: null,
    })
    await expect(
      decideViewProof(db, t.staffId, next.id, { outcome: 'approve', views: 3_000, note: null }),
    ).rejects.toThrow(/go up/i)
    // A second proof within a day of an approved one is refused.
    await expect(
      requestViewProof(db, { submissionId: t.id, creatorId: t.creator, now: new Date(t.now.getTime() + 2 * HOUR) }),
    ).rejects.toThrow(/once a day|waiting/i)
  })

  it('rejecting needs a note, changes no views and tells the creator why', async () => {
    const t = await approvedWithProof()
    await submitViewProof(db, {
      proofId: t.proof.id,
      creatorId: t.creator,
      now: t.now,
      claimedViews: 9_000,
      screenshotFileId: t.screenshot,
      recordingFileId: t.recording,
      note: null,
    })
    await expect(decideViewProof(db, t.staffId, t.proof.id, { outcome: 'reject', note: '' })).rejects.toThrow(
      /why|note/i,
    )
    await decideViewProof(db, t.staffId, t.proof.id, { outcome: 'reject', note: 'The recording has a cut at 0:12.' })
    const s = await t.sub()
    expect(s.latestViews).toBe(500)
    expect(s.earnedCents).toBe(0)
    expect((await latestViewProof(db, t.id))!.status).toBe('rejected')
    const n = (await notes(t.creator))[0]!
    expect(n.kind).toBe('view_proof')
    expect(n.body).toContain('cut at 0:12')
    // Decided once: not again.
    await expect(decideViewProof(db, t.staffId, t.proof.id, { outcome: 'reject', note: 'x' })).rejects.toThrow(
      /already/i,
    )
  })
})
