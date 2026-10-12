// The client's campaign report (client report brief, 2026-10-12): every figure from SQL, checked
// against a hand-built campaign with three posts and three days of snapshots.
import { createDb, recordSnapshot, tables } from '@mde/db'
import { accrueEarnings, createPgStore } from '@mde/money'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  campaignFormSchema,
  campaignReport,
  createClient,
  createDraft,
  fundCampaign,
  handleFor,
  joinCampaign,
  publishCampaign,
  recordClientFunding,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

const DAY = 86_400_000
let n = 0
async function user(prefix: string, username?: string) {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `${prefix}-${Date.now()}-${++n}@test.invalid`, username })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
  return u!.id
}

/** A live $1,000 campaign at $2.00 per 1,000 with: A (TikTok, earning), B (Instagram, paid out), C (rejected). */
async function reportCampaign() {
  const staffId = await user('staff')
  const client = await createClient(db, staffId, {
    name: 'Report client',
    contactName: null,
    contactEmail: null,
    serviceFeeBps: 0,
    notes: null,
  })
  const c = await createDraft(
    db,
    staffId,
    campaignFormSchema.parse({
      title: 'Report campaign',
      type: 'clipping',
      clientId: client.id,
      coverImageUrl: '/designed/camp-clip.png',
      briefMarkdown: 'b',
      assets: '',
      examplePosts: '',
      platforms: ['tiktok', 'instagram'],
      budgetCents: '$1,000.00',
      rateCentsPer1000: '$2.00',
      capPerPostCents: '',
      capPerCreatorCents: '',
      minViewsToEarn: '0',
      minEngagementBps: '',
      maxPostsPerAccount: '',
      minFollowers: '',
      minAccountAgeDays: '',
      languages: '',
      allowedRegions: '',
      blockedRegions: '',
      requiredHashtags: '',
      requireAdDisclosure: false,
      minDurationSeconds: '',
      keepLiveDays: '30',
      visibility: 'public',
      accessCode: '',
      startAt: new Date(Date.now() - 5 * DAY).toISOString(),
      endAt: '',
      termsDraftMarkdown: 'Rules.',
      templateFields: {},
    }),
  )
  await recordClientFunding(db, staffId, { clientId: client.id, amountCents: 100_000, reference: `INV-${c.id}` })
  await fundCampaign(db, staffId, c.id)
  await publishCampaign(db, staffId, c.id)
  const [full] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.id))
  const maya = await user('maya', `maya${n}`)
  const ben = await user('ben', `ben${n}`)
  await joinCampaign(db, maya, c.id)
  await joinCampaign(db, ben, c.id)
  const now = Date.now()
  const post = async (
    creatorId: string,
    platform: string,
    url: string,
    state: string,
    submittedAt: Date,
    counted: number,
    snapshots: [Date, number][],
  ) => {
    const [s] = await db
      .insert(tables.submissions)
      .values({
        campaignId: c.id,
        creatorId,
        platform,
        postUrl: url,
        platformPostId: `${Date.now()}${++n}`,
        state,
        termsVersionId: full!.currentTermsVersionId!,
        rateCentsPer1000Locked: 200,
        submittedAt,
        publishedAt: new Date(submittedAt.getTime() - 3_600_000),
        countedViews: counted,
        latestViews: snapshots.at(-1)?.[1] ?? 0,
      })
      .returning()
    for (const [takenAt, views] of snapshots)
      await recordSnapshot(db, {
        submissionId: s!.id,
        takenAt,
        views,
        likes: Math.floor(views / 10),
        comments: Math.floor(views / 100),
        shares: 1,
        isPublic: true,
      })
    return s!.id
  }
  const d = (daysAgo: number, hour = 12) => new Date(now - daysAgo * DAY - (12 - hour) * 3_600_000)
  const a = await post(maya, 'tiktok', 'https://www.tiktok.com/@maya.clips/video/1', 'approved', d(2, 9), 1_500, [
    [d(2, 10), 100],
    [d(1, 10), 900],
    [d(1, 11), 1_000],
    [d(0, 10), 1_500],
  ])
  const b = await post(ben, 'instagram', 'https://www.instagram.com/reel/ABC123/', 'approved', d(1, 9), 2_000, [
    [d(0, 9), 2_000],
  ])
  await post(ben, 'tiktok', 'https://www.tiktok.com/@ben/video/2', 'rejected', d(0, 8), 0, [[d(0, 8), 999]])
  // Earnings through the engine, so the spend comes from the ledger: A 300 cents, B 400 cents.
  const store = createPgStore(db)
  await accrueEarnings(store, { submissionId: a })
  await accrueEarnings(store, { submissionId: b })
  await db.update(tables.submissions).set({ state: 'paid_out' }).where(eq(tables.submissions.id, b))
  return { id: c.id, d }
}

describe('campaign report', () => {
  it('adds up approved posts from their latest snapshots, by day and by platform', async () => {
    const { id, d } = await reportCampaign()
    const r = (await campaignReport(db, id, { mode: 'all', page: 1 }))!
    expect(r.campaign).toMatchObject({ title: 'Report campaign', status: 'Live', rateCentsPer1000: 200 })
    expect(r.totals).toEqual({ views: 3_500, likes: 350, comments: 35, shares: 2, clips: 2 })
    expect(r.viewsByDay.map((x) => x.views)).toEqual([100, 1_000, 3_500])
    expect(r.viewsByDay.map((x) => x.clips)).toEqual([1, 1, 1])
    expect(r.viewsByDay[0]!.day).toBe(d(2).toISOString().slice(0, 10))
    expect(r.platforms).toEqual([
      { platform: 'instagram', views: 2_000, clips: 1, spentCents: 400, ecpmCents: 200 },
      { platform: 'tiktok', views: 1_500, clips: 1, spentCents: 300, ecpmCents: 200 },
    ])
    expect(r.budget).toEqual({
      budgetCents: 100_000,
      spentCents: 700,
      paidOutCents: 400,
      holdCents: 300,
      remainingCents: 99_300,
      ecpmCents: 200,
    })
    expect(r.spendByDay.at(-1)).toMatchObject({ spendCents: 700 })
    // Ben's reel link has no handle in it, so his username stands in.
    expect(r.topClips.map((x) => [x.handle.replace(/^@ben\d+$/, '@ben'), x.views, x.payout])).toEqual([
      ['@ben', 2_000, 'paid'],
      ['@maya.clips', 1_500, 'pending'],
    ])
    expect(r.submissions.total).toBe(3)
    expect(r.accounts.map((a) => [a.posts, a.spentCents, a.share])).toEqual([
      [1, 400, 57.1],
      [1, 300, 42.9],
    ])
    expect(r.clipsByPlatformDay.map((x) => [x.platform, x.clips])).toEqual([
      ['tiktok', 1],
      ['instagram', 1],
      ['tiktok', 1],
    ])
    // Most views first by default; newest when asked.
    expect(r.submissions.rows.map((x) => x.status)).toEqual(['approved', 'approved', 'rejected'])
    expect(r.counts).toEqual({ submitted: 3, approved: 2, pending: 0, rejected: 1 })
    const newest = (await campaignReport(db, id, { mode: 'all', page: 1, sort: 'newest' }))!
    expect(newest.submissions.rows.map((x) => x.status)).toEqual(['rejected', 'approved', 'approved'])
    expect(r.lastUpdated).not.toBeNull()
  })

  it('counts only paid out posts in paid mode, and filters the submissions table', async () => {
    const { id } = await reportCampaign()
    const paid = (await campaignReport(db, id, { mode: 'paid', page: 1 }))!
    expect(paid.totals.views).toBe(2_000)
    expect(paid.platforms.map((p) => p.platform)).toEqual(['instagram'])
    // The budget block is always the whole campaign.
    expect(paid.budget.spentCents).toBe(700)
    const rejected = (await campaignReport(db, id, { mode: 'all', page: 1, status: 'rejected' }))!
    expect(rejected.submissions.rows).toHaveLength(1)
    expect(rejected.submissions.total).toBe(1)
    const tiktok = (await campaignReport(db, id, { mode: 'all', page: 1, platform: 'tiktok' }))!
    expect(tiktok.submissions.rows.map((x) => x.platform)).toEqual(['tiktok', 'tiktok'])
    const narrow = (await campaignReport(db, id, { mode: 'all', page: 1, from: new Date(), to: new Date() }))!
    expect(narrow.totals.clips).toBe(0)
    expect(narrow.submissions.total).toBe(1)
  })

  it('names the clipper by their linked account, their link, or their username', () => {
    expect(handleFor({ handle: 'maya', url: '', username: 'x' })).toBe('@maya')
    expect(handleFor({ handle: null, url: 'https://www.tiktok.com/@ben.c/video/1', username: 'x' })).toBe('@ben.c')
    expect(handleFor({ handle: null, url: 'https://x.com/benc/status/1', username: 'x' })).toBe('@benc')
    expect(handleFor({ handle: null, url: 'https://www.instagram.com/reel/ABC/', username: 'benny' })).toBe('@benny')
  })
})
