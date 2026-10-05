import {
  campaignFormSchema,
  closeCampaign,
  createClient,
  createDraft,
  fundCampaign,
  joinCampaign,
  publishCampaign,
  recordClientFunding,
  type CampaignFormInput,
} from '@mde/campaigns'
import { createDb, tables } from '@mde/db'
import { MockProvider, ProviderRouter, type MockState } from '@mde/platforms'
import { submitPost } from '@mde/submissions'
import { and, eq, sql as dsql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { recheckAccount, runDueViewChecks, runReleases, runViewCheck, type CheckOutcome } from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

let state: MockState = {}
const router = new ProviderRouter([new MockProvider(() => state)], { backoffMs: 1, attempts: 1, log: () => {} })
const HOUR = 3_600_000

let n = 0
const uniq = () => `${Date.now() % 1e9}${++n}`
let staffId: string
let clientId: string
beforeAll(async () => {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `staff-${uniq()}@test.invalid` })
    .returning()
  staffId = u!.id
  clientId = (
    await createClient(db, staffId, { name: 'C', contactName: null, contactEmail: null, serviceFeeBps: 0, notes: null })
  ).id
})

async function setup(over: Partial<CampaignFormInput> = {}, followers = 50_000) {
  const c = await createDraft(
    db,
    staffId,
    campaignFormSchema.parse({
      title: 'Tracking test',
      type: 'clipping',
      clientId,
      coverImageUrl: '/designed/camp-clip.png',
      briefMarkdown: 'b',
      assets: '',
      examplePosts: '',
      platforms: ['tiktok'],
      budgetCents: '$1,000.00',
      rateCentsPer1000: '$2.00',
      capPerPostCents: '$300.00',
      capPerCreatorCents: '',
      minViewsToEarn: '1000',
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
      startAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endAt: '',
      termsDraftMarkdown: 'Rules.',
      templateFields: {},
      ...over,
    }),
  )
  await recordClientFunding(db, staffId, { clientId, amountCents: 100_000, reference: `INV-${c.id}` })
  await fundCampaign(db, staffId, c.id)
  await publishCampaign(db, staffId, c.id)

  const [creator] = await db
    .insert(tables.users)
    .values({ email: `cr-${uniq()}@test.invalid` })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: creator!.id })
  const handle = `maya${uniq()}`
  const [acc] = await db
    .insert(tables.linkedAccounts)
    .values({
      creatorId: creator!.id,
      platform: 'tiktok',
      handle,
      linkMethod: 'bio_code',
      status: 'verified',
      platformUserId: `tt-${handle}`,
      followers,
    })
    .returning()
  await joinCampaign(db, creator!.id, c.id)

  const pid = `75${uniq()}`.padEnd(19, '0').slice(0, 19)
  const key = `tiktok:${pid}`
  const post = (views: number, extra: object = {}) => {
    state = {
      ...state,
      posts: {
        ...state.posts,
        [key]: {
          authorPlatformUserId: acc!.platformUserId,
          publishedAt: new Date(Date.now() - HOUR).toISOString(),
          views,
          likes: Math.floor(views / 20),
          comments: Math.floor(views / 200),
          shares: 0,
          ...extra,
        },
      },
    }
  }
  post(500)
  const t0 = new Date()
  const r = await submitPost(
    db,
    { creatorId: creator!.id, campaignId: c.id, postUrl: `https://www.tiktok.com/@${handle}/video/${pid}` },
    { router, now: t0 },
  )
  expect(r.outcome).toBe('needs_review')
  const id = r.submissionId!
  // Review arrives in Phase 5; here a reviewer approves directly.
  await db.update(tables.submissions).set({ state: 'approved' }).where(eq(tables.submissions.id, id))
  const sub = async () => (await db.select().from(tables.submissions).where(eq(tables.submissions.id, id)))[0]!
  const pending = async () => {
    const rows = await db.execute(dsql`select coalesce(sum(e.amount_cents),0)::bigint as b from ledger_entries e
      join ledger_accounts a on a.id = e.account_id where a.kind = 'creator_pending' and a.owner_id = ${creator!.id}`)
    return Number((rows[0] as { b: string }).b)
  }
  /** Run the check due at t (hours after submission). */
  // Tests read the details of checks that ran; a check that did not run reads as { ran: false }.
  const check = async (hours: number) =>
    (await runViewCheck(db, id, { router, now: new Date(t0.getTime() + hours * HOUR) })) as Extract<
      CheckOutcome,
      { ran: true }
    >
  return { c, id, sub, pending, post, check, account: acc! }
}

describe('view checks and earnings', () => {
  it('grows pending earnings with rising views, matching a hand calculation', async () => {
    const t = await setup()
    // Baseline 500 at submission. Rate $2.00 per 1,000, minimum 1,000 counted views, cap $300.00 a post.
    const steps: [number, number, number][] = [
      // [views, counted, expected pending cents]
      [1_400, 900, 0], // below the minimum: nothing yet
      [1_500, 1_000, 200], // 1,000 x $2.00 / 1,000 = $2.00
      [6_500, 6_000, 1_200], // $12.00
      [61_234, 60_734, 12_146], // floor(60,734 x 200 / 1,000) = 12,146
      [250_500, 250_000, 30_000], // $500.00 capped at $300.00
    ]
    let hours = 2
    for (const [views, counted, cents] of steps) {
      t.post(views)
      expect((await t.check(hours)).ran).toBe(true)
      const s = await t.sub()
      expect(s.countedViews).toBe(counted)
      expect(s.earnedCents).toBe(cents)
      expect(await t.pending()).toBe(cents)
      hours += 2
    }
    expect((await t.sub()).state).toBe('earning')
  })

  it('running the same check twice changes nothing', async () => {
    const t = await setup()
    t.post(5_500)
    expect((await t.check(2)).ran).toBe(true)
    const before = await t.sub()
    const snaps = async () =>
      (await db.select().from(tables.viewSnapshots).where(eq(tables.viewSnapshots.submissionId, t.id))).length
    const snapCount = await snaps()
    // The same slot again: already claimed, so nothing runs.
    expect(await t.check(2)).toEqual({ ran: false })
    expect(await snaps()).toBe(snapCount)
    // Forced due again with the same data: a snapshot is kept, but no money or views move.
    await db
      .update(tables.submissions)
      .set({ nextCheckAt: new Date(0) })
      .where(eq(tables.submissions.id, t.id))
    const again = await t.check(2)
    expect(again).toMatchObject({ ran: true, deltaCents: 0 })
    const after = await t.sub()
    expect(after.earnedCents).toBe(before.earnedCents)
    expect(after.countedViews).toBe(before.countedViews)
    expect(await t.pending()).toBe(before.earnedCents)
    const tx = await db.select().from(tables.ledgerTransactions).where(eq(tables.ledgerTransactions.submissionId, t.id))
    expect(tx).toHaveLength(1)
  })

  it('a scripted view jump creates a flag and pauses earnings', async () => {
    const t = await setup()
    let hours = 2
    let views = 500
    for (let i = 0; i < 6; i++) {
      views += 1_000
      t.post(views)
      await t.check(hours)
      hours += 2
    }
    const earned = (await t.sub()).earnedCents
    t.post(views + 50_000) // 50 times the usual growth
    const r = await t.check(hours)
    expect(r).toMatchObject({ ran: true, flags: ['view_jump'], deltaCents: 0 })
    const s = await t.sub()
    expect(s.state).toBe('flagged')
    expect(s.earnedCents).toBe(earned)
    const flags = await db
      .select()
      .from(tables.fraudFlags)
      .where(and(eq(tables.fraudFlags.submissionId, t.id), eq(tables.fraudFlags.kind, 'view_jump')))
    expect(flags).toMatchObject([{ status: 'open', detail: { previousState: 'earning' } }])
    // Paused: more views earn nothing until staff clear the flag.
    t.post(views + 60_000)
    expect((await t.check(hours + 2)).deltaCents).toBe(0)
  })

  it('flags a post whose author changed and one with too little engagement', async () => {
    const t = await setup()
    t.post(2_000, { authorPlatformUserId: 'someone-else' })
    expect((await t.check(2)).flags).toEqual(['wrong_author'])
    const u = await setup()
    u.post(20_000, { likes: 10, comments: 2, shares: 0 })
    expect((await u.check(2)).flags).toEqual(['engagement_below_floor'])
  })

  it('removes a post missing for the grace period and reverses its pending earnings', async () => {
    const t = await setup()
    t.post(10_500)
    await t.check(2)
    expect(await t.pending()).toBe(2_000)
    t.post(0, { exists: false })
    expect((await t.check(4)).result).toBe('missing')
    expect((await t.sub()).state).toBe('earning')
    expect((await t.check(30)).result).toBe('missing')
    expect((await t.check(52)).result).toBe('removed') // 48 hours after it went missing
    const s = await t.sub()
    expect(s).toMatchObject({
      state: 'removed',
      reasonCode: 'deleted_or_edited_post',
      earnedCents: 0,
      nextCheckAt: null,
    })
    expect(await t.pending()).toBe(0)
    const [note] = await db
      .select()
      .from(tables.notifications)
      .where(eq(tables.notifications.userId, t.account.creatorId))
    expect(note).toMatchObject({ kind: 'submission_removed', title: 'Your post was removed' })
    expect(note!.body).toContain('You can appeal from your submissions.')
  })

  it('a post that comes back during the grace period carries on', async () => {
    const t = await setup()
    t.post(0, { exists: false })
    await t.check(2)
    t.post(3_000)
    expect((await t.check(20)).result).toBe('checked')
    expect((await t.sub()).missingSince).toBeNull()
  })

  it('runs every due check, and the next is scheduled by the interval table', async () => {
    const t = await setup()
    t.post(1_200)
    const now = new Date(Date.now() + 3 * HOUR)
    const totals = await runDueViewChecks(db, { router, now })
    expect(totals.checked).toBeGreaterThanOrEqual(1)
    expect((await t.sub()).nextCheckAt!.getTime()).toBe(now.getTime() + 2 * HOUR)
  })

  it('a follower drop on the account flags its posts and pauses the ones earning', async () => {
    const t = await setup({}, 10_000)
    t.post(3_000)
    await t.check(2)
    expect((await t.sub()).state).toBe('earning')
    state = {
      ...state,
      profiles: { [`tiktok:${t.account.handle}`]: { platformUserId: t.account.platformUserId!, followers: 4_000 } },
    }
    expect(await recheckAccount(db, t.account, { router })).toBe('follower_drop')
    const [flag] = await db.select().from(tables.fraudFlags).where(eq(tables.fraudFlags.submissionId, t.id))
    expect(flag).toMatchObject({
      kind: 'follower_drop',
      status: 'open',
      detail: { before: 10_000, after: 4_000, previousState: 'earning' },
    })
    expect((await t.sub()).state).toBe('flagged')
  })

  it('releases final posts after the review window and returns unused budget; flagged posts wait', async () => {
    const t = await setup()
    t.post(10_500)
    await t.check(2) // earns $20.00
    const u = await setup()
    const closedAt = new Date()
    await db.transaction((tx) => closeCampaign(tx, staffId, t.c.id, closedAt))
    expect((await t.sub()).state).toBe('final')
    // Not yet: the review window (7 days) is still running.
    expect((await runReleases(db, new Date(closedAt.getTime() + 6 * 86_400_000))).released).toBe(0)
    const later = new Date(closedAt.getTime() + 7 * 86_400_000 + 1)
    const r = await runReleases(db, later)
    expect(r.released).toBeGreaterThanOrEqual(1)
    expect((await t.sub()).state).toBe('paid_out')
    expect(await t.pending()).toBe(0)
    // Running again releases nothing new.
    const again = await runReleases(db, later)
    expect(again.releasedCents).toBe(0)
    // The creator hears once, with the amount and the date.
    const released = await db
      .select()
      .from(tables.notifications)
      .where(
        and(eq(tables.notifications.userId, t.account.creatorId), eq(tables.notifications.kind, 'earnings_released')),
      )
    expect(released).toHaveLength(1)
    expect(released[0]!.body).toBe(
      `$20.00 from ${t.c.title} became available to withdraw on ${later.toISOString().slice(0, 10)}.`,
    )

    // A post with an open flag stays held.
    u.post(2_000, { authorPlatformUserId: 'someone-else' })
    await u.check(2)
    await db.update(tables.submissions).set({ state: 'final' }).where(eq(tables.submissions.id, u.id))
    await db.transaction((tx) => closeCampaign(tx, staffId, u.c.id, closedAt))
    const held = await runReleases(db, later)
    expect(held.held).toBeGreaterThanOrEqual(1)
    expect((await u.sub()).state).toBe('final')
  })
})
