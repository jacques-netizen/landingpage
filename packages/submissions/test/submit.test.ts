import {
  campaignFormSchema,
  createClient,
  createDraft,
  fundCampaign,
  joinCampaign,
  publishCampaign,
  recordClientFunding,
  type CampaignFormInput,
} from '@mde/campaigns'
import { createDb, tables, updateSetting } from '@mde/db'
import { MockProvider, ProviderRouter, type MockState } from '@mde/platforms'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { submitPost } from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

let state: MockState = {}
const router = new ProviderRouter([new MockProvider(() => state)], { backoffMs: 1, attempts: 1, log: () => {} })
const deps = () => ({ router, now: new Date() })

let n = 0
const uniq = () => `${Date.now() % 1e9}${++n}`
async function user(prefix: string) {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `${prefix}-${uniq()}@test.invalid` })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
  return u!.id
}

let staffId: string
let clientId: string
beforeAll(async () => {
  staffId = await user('staff')
  const client = await createClient(db, staffId, {
    name: 'Client',
    contactName: null,
    contactEmail: null,
    serviceFeeBps: 0,
    notes: null,
  })
  clientId = client.id
})

async function liveCampaign(over: Partial<CampaignFormInput> = {}) {
  const c = await createDraft(
    db,
    staffId,
    campaignFormSchema.parse({
      title: 'Submit test',
      type: 'clipping',
      clientId,
      coverImageUrl: '/designed/camp-clip.png',
      briefMarkdown: 'Cut the best moments.',
      assets: '',
      examplePosts: '',
      platforms: ['tiktok', 'youtube'],
      budgetCents: '$1,000.00',
      rateCentsPer1000: '$2.00',
      capPerPostCents: '',
      capPerCreatorCents: '',
      minViewsToEarn: '1000',
      minEngagementBps: '',
      maxPostsPerAccount: '',
      minFollowers: '',
      minAccountAgeDays: '',
      languages: '',
      allowedRegions: '',
      blockedRegions: '',
      requiredHashtags: '#client',
      requireAdDisclosure: false,
      minDurationSeconds: '',
      keepLiveDays: '30',
      visibility: 'public',
      accessCode: '',
      startAt: new Date(Date.now() - 86_400_000).toISOString(),
      endAt: '',
      termsDraftMarkdown: 'Post on your own account.',
      templateFields: {},
      ...over,
    }),
  )
  await recordClientFunding(db, staffId, { clientId, amountCents: 100_000, reference: `INV-${c.id}` })
  await fundCampaign(db, staffId, c.id)
  await publishCampaign(db, staffId, c.id)
  return c
}

/** A joined creator with a verified TikTok account. */
async function creatorIn(campaignId: string) {
  const id = await user('creator')
  const handle = `maya${uniq()}`
  const [acc] = await db
    .insert(tables.linkedAccounts)
    .values({
      creatorId: id,
      platform: 'tiktok',
      handle,
      linkMethod: 'bio_code',
      status: 'verified',
      platformUserId: `tt-${handle}`,
      followers: 5000,
      verifiedAt: new Date(),
    })
    .returning()
  await joinCampaign(db, id, campaignId)
  return { id, account: acc! }
}

function post(over: object = {}) {
  const pid = `73${uniq().padStart(17, '0')}`.slice(0, 19)
  return {
    pid,
    url: `https://www.tiktok.com/@x/video/${pid}`,
    data: {
      publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
      views: 420,
      caption: 'new clip #client',
      durationSeconds: 30,
      ...over,
    },
  }
}
function script(pid: string, data: object) {
  state = { ...state, posts: { ...state.posts, [`tiktok:${pid}`]: data } }
}

describe('submitting a post', () => {
  it('passes every check, goes to review, and locks the terms and rate', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    const p = post()
    script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
    const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url, note: ' first one ' }, deps())
    expect(r.outcome).toBe('needs_review')
    expect(r.checks.map((x) => [x.check, x.status])).toEqual([
      [1, 'pass'],
      [2, 'pass'],
      [3, 'pass'],
      [4, 'pass'],
      [5, 'pass'],
      [6, 'pass'],
      [7, 'pass'],
      [8, 'pass'],
      [9, 'pass'],
      [10, 'pass'],
      [11, 'pass'],
    ])
    const [s] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, r.submissionId!))
    const [camp] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.id))
    expect(s).toMatchObject({
      state: 'needs_review',
      linkedAccountId: me.account.id,
      platformPostId: p.pid,
      termsVersionId: camp!.currentTermsVersionId,
      rateCentsPer1000Locked: 200,
      baselineViews: 420,
      latestViews: 420,
      countedViews: 0,
      creatorNote: 'first one',
    })
    const snaps = await db.select().from(tables.viewSnapshots).where(eq(tables.viewSnapshots.submissionId, s!.id))
    expect(snaps).toHaveLength(1)
    expect(snaps[0]).toMatchObject({ views: 420, isPublic: true, source: 'provider:mock' })
  })

  it('stores nothing when the creator has not joined', async () => {
    const c = await liveCampaign()
    const outsider = await user('outsider')
    const p = post()
    const r = await submitPost(db, { creatorId: outsider, campaignId: c.id, postUrl: p.url }, deps())
    expect(r).toMatchObject({ outcome: 'not_submitted' })
    expect(r.checks).toHaveLength(1)
    expect(await db.select().from(tables.submissions).where(eq(tables.submissions.campaignId, c.id))).toHaveLength(0)
  })

  it("rejects a post from someone else's account with not_linked_account, and records the decision", async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    const p = post()
    script(p.pid, { ...p.data, authorPlatformUserId: 'tt-somebody-else' })
    const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url }, deps())
    expect(r.outcome).toBe('rejected_auto')
    expect(r.checks.at(-1)).toMatchObject({ check: 3, status: 'fail', reason: 'not_linked_account' })
    const [s] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, r.submissionId!))
    expect(s).toMatchObject({ state: 'rejected_auto', reasonCode: 'not_linked_account', linkedAccountId: null })
    const decisions = await db
      .select()
      .from(tables.reviewDecisions)
      .where(eq(tables.reviewDecisions.submissionId, s!.id))
    expect(decisions).toMatchObject([{ outcome: 'reject', reasonCode: 'not_linked_account', reviewerId: null }])
  })

  it('refuses the same post twice, but lets a post that failed be checked again once fixed', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    const p = post({ caption: 'forgot the tag' })
    script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
    const first = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url }, deps())
    expect(first.checks.at(-1)).toMatchObject({ check: 10, reason: 'missing_hashtag' })

    script(p.pid, { ...p.data, caption: 'fixed #client', authorPlatformUserId: me.account.platformUserId })
    const again = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url }, deps())
    expect(again.outcome).toBe('needs_review')
    expect(again.submissionId).toBe(first.submissionId)

    const twice = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url }, deps())
    expect(twice.outcome).toBe('not_submitted')
    expect(twice.checks.at(-1)).toMatchObject({ check: 4, reason: 'duplicate_post' })
  })

  it('counts posts per account and stops at the limit', async () => {
    const c = await liveCampaign({ maxPostsPerAccount: '1' })
    const me = await creatorIn(c.id)
    for (const expected of ['needs_review', 'rejected_auto']) {
      const p = post()
      script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
      const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url }, deps())
      expect(r.outcome).toBe(expected)
      if (expected === 'rejected_auto')
        expect(r.checks.at(-1)).toMatchObject({ check: 5, reason: 'post_limit_reached' })
    }
  })

  it('flags a clip that matches another post for review, and never rejects it', async () => {
    const c = await liveCampaign()
    const [a, b] = [await creatorIn(c.id), await creatorIn(c.id)]
    const p1 = post()
    const p2 = post()
    script(p1.pid, { ...p1.data, authorPlatformUserId: a.account.platformUserId, mediaHash: 'f0f0f0f0f0f0f0f0' })
    script(p2.pid, { ...p2.data, authorPlatformUserId: b.account.platformUserId, mediaHash: 'f0f0f0f0f0f0f0f1' })
    expect((await submitPost(db, { creatorId: a.id, campaignId: c.id, postUrl: p1.url }, deps())).outcome).toBe(
      'needs_review',
    )
    const r = await submitPost(db, { creatorId: b.id, campaignId: c.id, postUrl: p2.url }, deps())
    expect(r.outcome).toBe('flagged')
    expect(r.checks.at(-1)).toMatchObject({ check: 11, status: 'review' })
    const flags = await db.select().from(tables.fraudFlags).where(eq(tables.fraudFlags.submissionId, r.submissionId!))
    expect(flags).toMatchObject([{ kind: 'duplicate_media', status: 'open' }])
  })

  it("follows a short share link from the TikTok app to the post (owner's clippers, 2026-10-10)", async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    const p = post()
    script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
    const http = (async (u: string | URL) =>
      String(u) === 'https://vm.tiktok.com/ZN8BSNUM/'
        ? new Response(null, { status: 302, headers: { location: `${p.url}?_r=1` } })
        : new Response('', { status: 200 })) as unknown as typeof fetch
    const r = await submitPost(
      db,
      { creatorId: me.id, campaignId: c.id, postUrl: 'https://vm.tiktok.com/ZN8BSNUM/' },
      { ...deps(), http },
    )
    expect(r.outcome).toBe('needs_review')
    const [row] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, r.submissionId!))
    // The full link is what is stored, and the short link is still refused when it leads nowhere.
    expect(row).toMatchObject({ postUrl: `${p.url}?_r=1`, platformPostId: p.pid })
    const r2 = await submitPost(
      db,
      { creatorId: me.id, campaignId: c.id, postUrl: 'https://vm.tiktok.com/nothing/' },
      { ...deps(), http },
    )
    expect(r2.outcome).toBe('not_submitted')
    expect(r2.checks.at(-1)).toMatchObject({ check: 2, status: 'fail' })
  })

  // Owner request (2026-10-10): clippers were turned away with "We could not reach the platform". A post
  // is never refused for that: it is kept for a reviewer, and its stats come with the next view check.
  it('keeps the post for review when the platform cannot be reached, with nothing counted yet', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    state = { ...state, down: true }
    // Without the post's data, the handle in the link must be the creator's own.
    const url = `https://www.tiktok.com/@${me.account.handle}/video/${post().pid}`
    const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: url }, deps())
    state = { ...state, down: false }
    expect(r.outcome).toBe('needs_review')
    expect(r.checks.some((x) => x.status === 'fail')).toBe(false)
    // What needs the post's data waits for a reviewer; what does not still runs.
    expect(r.checks.find((x) => x.check === 6)).toMatchObject({
      status: 'review',
      detail: expect.stringMatching(/could not be reached/),
    })
    expect(r.checks.find((x) => x.check === 7)).toMatchObject({ status: 'review' })
    expect(r.checks.find((x) => x.check === 10)).toMatchObject({ status: 'review' })
    expect(r.checks.find((x) => x.check === 4)).toMatchObject({ status: 'pass' })
    const [row] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, r.submissionId!))
    expect(row).toMatchObject({
      state: 'needs_review',
      baselineViews: 0,
      latestViews: 0,
      countedViews: 0,
      publishedAt: null,
    })
    expect(row!.nextCheckAt).not.toBeNull()
    const snaps = await db.select().from(tables.viewSnapshots).where(eq(tables.viewSnapshots.submissionId, row!.id))
    expect(snaps).toMatchObject([{ views: null, source: 'unavailable' }])
  })

  it('approves at once for clean creators only when the setting is on', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    await updateSetting(db, staffId, 'auto_approve_clean_creators', true)
    try {
      const p = post()
      script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
      const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url }, deps())
      expect(r.outcome).toBe('approved')
      const decisions = await db
        .select()
        .from(tables.reviewDecisions)
        .where(eq(tables.reviewDecisions.submissionId, r.submissionId!))
      expect(decisions).toMatchObject([{ outcome: 'approve', reviewerId: null }])
    } finally {
      await updateSetting(db, staffId, 'auto_approve_clean_creators', false)
    }
  })
})

describe('while account linking is switched off', () => {
  async function joinedWithoutAccount(campaignId: string) {
    const id = await user('creator')
    await joinCampaign(db, id, campaignId)
    return id
  }
  const off = { requireLinkedAccount: false }

  it('sends a post from an unlinked creator to a reviewer instead of rejecting it', async () => {
    const c = await liveCampaign()
    const me = await joinedWithoutAccount(c.id)
    const p = post()
    script(p.pid, { ...p.data, authorPlatformUserId: 'someone-unknown' })
    const r = await submitPost(db, { creatorId: me, campaignId: c.id, postUrl: p.url, ...off }, deps())
    expect(r.outcome).toBe('needs_review')
    expect(r.checks.find((x) => x.check === 3)).toMatchObject({ status: 'review' })
    expect(r.checks.some((x) => x.status === 'fail')).toBe(false)
    const [s] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, r.submissionId!))
    expect(s).toMatchObject({ state: 'needs_review', linkedAccountId: null })
  })

  it('still runs the other checks: a missing hashtag is rejected', async () => {
    const c = await liveCampaign()
    const me = await joinedWithoutAccount(c.id)
    const p = post({ caption: 'no tag here' })
    script(p.pid, p.data)
    const r = await submitPost(db, { creatorId: me, campaignId: c.id, postUrl: p.url, ...off }, deps())
    expect(r.outcome).toBe('rejected_auto')
    expect(r.checks.find((x) => x.status === 'fail')?.reason).toBe('missing_hashtag')
  })

  it('never auto-approves, even for clean creators', async () => {
    await updateSetting(db, staffId, 'auto_approve_clean_creators', true)
    try {
      const c = await liveCampaign()
      const me = await joinedWithoutAccount(c.id)
      const p = post()
      script(p.pid, p.data)
      const r = await submitPost(db, { creatorId: me, campaignId: c.id, postUrl: p.url, ...off }, deps())
      expect(r.outcome).toBe('needs_review')
    } finally {
      await updateSetting(db, staffId, 'auto_approve_clean_creators', false)
    }
  })

  it('counts the post limit per creator', async () => {
    const c = await liveCampaign({ maxPostsPerAccount: '1' })
    const me = await joinedWithoutAccount(c.id)
    const a = post()
    script(a.pid, a.data)
    expect((await submitPost(db, { creatorId: me, campaignId: c.id, postUrl: a.url, ...off }, deps())).outcome).toBe(
      'needs_review',
    )
    const b = post()
    script(b.pid, b.data)
    const r = await submitPost(db, { creatorId: me, campaignId: c.id, postUrl: b.url, ...off }, deps())
    expect(r.checks.find((x) => x.status === 'fail')?.reason).toBe('post_limit_reached')
  })

  it('uses a verified account when the creator has one', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    const p = post()
    script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
    const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: p.url, ...off }, deps())
    expect(r.checks.find((x) => x.check === 3)?.status).toBe('pass')
  })
})

describe('the account the creator picks', () => {
  it('must be the one the post came from', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    const [other] = await db
      .insert(tables.linkedAccounts)
      .values({
        creatorId: me.id,
        platform: 'tiktok',
        handle: `alt${uniq()}`,
        linkMethod: 'bio_code',
        status: 'verified',
        platformUserId: `tt-alt-${uniq()}`,
      })
      .returning()
    const p = post()
    script(p.pid, { ...p.data, authorPlatformUserId: me.account.platformUserId })
    const wrong = await submitPost(
      db,
      { creatorId: me.id, campaignId: c.id, postUrl: p.url, linkedAccountId: other!.id },
      deps(),
    )
    expect(wrong.checks.at(-1)).toMatchObject({ check: 3, reason: 'not_linked_account' })
    const right = await submitPost(
      db,
      { creatorId: me.id, campaignId: c.id, postUrl: p.url, linkedAccountId: me.account.id },
      deps(),
    )
    expect(right.outcome).toBe('needs_review')
  })
})

describe('suspended creators', () => {
  it('cannot submit', async () => {
    const c = await liveCampaign()
    const me = await creatorIn(c.id)
    await db.update(tables.users).set({ status: 'suspended' }).where(eq(tables.users.id, me.id))
    const r = await submitPost(db, { creatorId: me.id, campaignId: c.id, postUrl: post().url }, deps())
    expect(r).toMatchObject({ outcome: 'not_submitted', checks: [] })
    expect(r.message).toMatch(/suspended/)
  })
})
