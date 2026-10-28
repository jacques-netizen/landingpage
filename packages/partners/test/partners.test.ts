import { createHmac } from 'node:crypto'
import {
  campaignFormSchema,
  closeCampaign,
  createClient,
  createDraft,
  fundCampaign,
  publishCampaign,
  recordClientFunding,
} from '@mde/campaigns'
import { createDb, tables, writeAudit } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  checkWebhookUrl,
  createPartnerKey,
  createWebhook,
  dailyStats,
  deleteWebhook,
  deliverWebhooks,
  getCampaign,
  getClip,
  keyFromHeader,
  listCampaigns,
  listClips,
  queueWebhookEvents,
  revokePartnerKey,
  type Send,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())
const BASE = 'https://app.example.com'

let n = 0
const uniq = () => `${Date.now() % 1e9}${++n}`
let staffId: string
let clientA: string
let clientB: string

async function campaign(clientId: string, platforms: string[] = ['tiktok'], demo = false) {
  const c = await createDraft(
    db,
    staffId,
    campaignFormSchema.parse({
      title: `Partner test ${uniq()}`,
      type: 'clipping',
      clientId,
      coverImageUrl: '/designed/camp-clip.png',
      briefMarkdown: 'b',
      assets: '',
      examplePosts: '',
      platforms,
      budgetCents: '$1,000.00',
      rateCentsPer1000: '$1.00',
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
      startAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endAt: '',
      termsDraftMarkdown: 'Rules.',
      templateFields: {},
    }),
  )
  await recordClientFunding(db, staffId, { clientId, amountCents: 100_000, reference: `INV-${c.id}` })
  await fundCampaign(db, staffId, c.id)
  await publishCampaign(db, staffId, c.id)
  if (demo) await db.update(tables.campaigns).set({ demo: true }).where(eq(tables.campaigns.id, c.id))
  const [row] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.id))
  return row!
}

async function post(
  c: { id: string; currentTermsVersionId: string | null },
  state: string,
  f: { platform?: string; views: number; likes: number; comments?: number; shares?: number; earned?: number },
) {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `cr-${uniq()}@test.invalid` })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: u!.id })
  const handle = `page${uniq()}`
  const platform = f.platform ?? 'tiktok'
  const [acc] = await db
    .insert(tables.linkedAccounts)
    .values({
      creatorId: u!.id,
      platform,
      handle,
      linkMethod: 'bio_code',
      status: 'verified',
      platformUserId: `pu-${handle}`,
      followers: 12_000,
    })
    .returning()
  const [s] = await db
    .insert(tables.submissions)
    .values({
      campaignId: c.id,
      creatorId: u!.id,
      linkedAccountId: acc!.id,
      platform,
      postUrl: `https://www.tiktok.com/@${handle}/video/${uniq()}`,
      platformPostId: uniq(),
      state,
      termsVersionId: c.currentTermsVersionId!,
      rateCentsPer1000Locked: 100,
      submittedAt: new Date(Date.now() - n * 60_000),
      latestViews: f.views,
      countedViews: f.views,
      earnedCents: f.earned ?? 0,
    })
    .returning()
  const now = new Date()
  await db.insert(tables.viewSnapshots).values({
    submissionId: s!.id,
    takenAt: now,
    views: f.views,
    likes: f.likes,
    comments: f.comments ?? 0,
    shares: f.shares ?? 0,
  })
  await db.insert(tables.viewSnapshotDays).values({
    submissionId: s!.id,
    day: now.toISOString().slice(0, 10),
    takenAt: now,
    views: f.views,
    likes: f.likes,
    comments: f.comments ?? 0,
    shares: f.shares ?? 0,
  })
  return { id: s!.id, handle }
}

let live: Awaited<ReturnType<typeof campaign>>
let other: Awaited<ReturnType<typeof campaign>>
let demo: Awaited<ReturnType<typeof campaign>>
let approvedClip: string
beforeAll(async () => {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `staff-${uniq()}@test.invalid` })
    .returning()
  staffId = u!.id
  const mk = (name: string) =>
    createClient(db, staffId, { name, contactName: null, contactEmail: null, serviceFeeBps: 0, notes: null })
  clientA = (await mk('A')).id
  clientB = (await mk('B')).id
  live = await campaign(clientA)
  other = await campaign(clientB)
  demo = await campaign(clientA, ['tiktok'], true)
  approvedClip = (await post(live, 'earning', { views: 10_000, likes: 900, comments: 50, shares: 50, earned: 1_000 }))
    .id
  await post(live, 'approved', { views: 5_000, likes: 100 })
  await post(live, 'needs_review', { views: 700, likes: 7 })
  await post(live, 'rejected', { views: 99_999, likes: 1 })
  await post(demo, 'earning', { views: 1_234, likes: 12 })
  // The client report shows spend at twice the clippers' rate on this campaign, against a $500 budget.
  await db
    .update(tables.campaigns)
    .set({ clientSpendFactor: 2, clientBudgetCents: 50_000 })
    .where(eq(tables.campaigns.id, live.id))
})

describe('partner keys', () => {
  it('opens with a valid key only, and never after it is revoked', async () => {
    const { key, row } = await createPartnerKey(db, staffId, { partner: 'Wyde', mode: 'live', clientIds: null })
    expect(key).toMatch(/^mde_live_[A-Za-z0-9]{32}$/)
    expect(row.keyHash).not.toContain(key.slice(9))
    expect((await keyFromHeader(db, `Bearer ${key}`))?.id).toBe(row.id)
    expect(await keyFromHeader(db, `Bearer ${key.slice(0, -1)}x`)).toBeNull()
    expect(await keyFromHeader(db, key)).toBeNull()
    expect(await keyFromHeader(db, null)).toBeNull()
    await revokePartnerKey(db, staffId, row.id)
    expect(await keyFromHeader(db, `Bearer ${key}`)).toBeNull()
    const audit = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, row.id))
    expect(audit.map((a) => a.action).sort()).toEqual(['partner_key.create', 'partner_key.revoke'])
  })
})

describe('what a key sees', () => {
  it('a live key sees live campaigns, never demo ones; a sandbox key only demo ones', async () => {
    const all = (await createPartnerKey(db, staffId, { partner: 'P', mode: 'live', clientIds: null })).row
    const ids = (await listCampaigns(db, all, BASE, { limit: 100, cursor: null, status: null })).data.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining([live.id, other.id]))
    expect(ids).not.toContain(demo.id)
    const sandbox = (await createPartnerKey(db, staffId, { partner: 'P', mode: 'sandbox', clientIds: null })).row
    const sids = (await listCampaigns(db, sandbox, BASE, { limit: 100, cursor: null, status: null })).data.map(
      (c) => c.id,
    )
    expect(sids).toContain(demo.id)
    expect(sids).not.toContain(live.id)
  })

  it('a key limited to a client sees only that client', async () => {
    const a = (await createPartnerKey(db, staffId, { partner: 'P', mode: 'live', clientIds: [clientA] })).row
    expect(await getCampaign(db, a, BASE, live.id)).not.toBeNull()
    expect(await getCampaign(db, a, BASE, other.id)).toBeNull()
    expect(await listClips(db, a, other.id, { limit: 10, cursor: null, status: null })).toBeNull()
  })

  it('gives the client-facing figures: approved posts only, no money amounts, the budget share delivered', async () => {
    const key = (await createPartnerKey(db, staffId, { partner: 'P', mode: 'live', clientIds: null })).row
    const c = (await getCampaign(db, key, BASE, live.id))!
    expect(c).toMatchObject({
      object: 'campaign',
      status: 'live',
      cover_url: 'https://app.example.com/designed/camp-clip.png',
      stats: {
        views: 15_000,
        likes: 1_000,
        comments: 50,
        shares: 50,
        clips_approved: 2,
        clips_in_review: 1,
        pages: 3,
        // $10.00 earned, shown at 2x = $20.00 of the $500.00 client budget = 4%.
        budget_delivered_percent: 4,
        // (1,000 + 50 + 50) / 15,000 = 7.3%
        engagement_rate: 7.3,
      },
    })
    expect(JSON.stringify(c)).not.toMatch(/cents|earned|spent|factor/)
  })

  it('lists clips newest first, page by page, without rejected posts or personal details', async () => {
    const key = (await createPartnerKey(db, staffId, { partner: 'P', mode: 'live', clientIds: null })).row
    const first = (await listClips(db, key, live.id, { limit: 2, cursor: null, status: null }))!
    expect(first.data).toHaveLength(2)
    expect(first.has_more).toBe(true)
    const second = (await listClips(db, key, live.id, { limit: 2, cursor: first.next_cursor, status: null }))!
    expect(second.data).toHaveLength(1)
    expect(second.has_more).toBe(false)
    const all = [...first.data, ...second.data]
    expect(all.map((c) => c.stats.views)).not.toContain(99_999)
    expect(new Set(all.map((c) => c.id)).size).toBe(3)
    expect(all.find((c) => c.id === approvedClip)).toMatchObject({
      status: 'approved',
      page: { followers: 12_000 },
      stats: { views: 10_000, likes: 900, comments: 50, shares: 50 },
    })
    expect(JSON.stringify(all)).not.toMatch(/email|creator_id|earned/)
    const review = (await listClips(db, key, live.id, { limit: 10, cursor: null, status: 'in_review' }))!
    expect(review.data.map((c) => c.status)).toEqual(['in_review'])
    expect((await getClip(db, key, approvedClip))?.id).toBe(approvedClip)
  })

  it('gives views per day', async () => {
    const key = (await createPartnerKey(db, staffId, { partner: 'P', mode: 'live', clientIds: null })).row
    const d = (await dailyStats(db, key, live.id))!
    expect(d.data.at(-1)).toMatchObject({ views_total: 15_000 })
    expect(d.data.reduce((s, x) => s + x.views, 0)).toBe(15_000)
  })
})

describe('webhooks', () => {
  it('refuses addresses that are not public https', () => {
    expect(() => checkWebhookUrl('http://example.com/hook')).toThrow(/https/)
    expect(() => checkWebhookUrl('https://localhost/hook')).toThrow(/public/)
    expect(() => checkWebhookUrl('https://10.0.0.5/hook')).toThrow(/public/)
    expect(() => checkWebhookUrl('https://web.railway.internal/hook')).toThrow(/public/)
    expect(checkWebhookUrl('https://partner.example.com/hook')).toBe('https://partner.example.com/hook')
  })

  it('delivers signed events for campaigns the key sees, once each, and retries a failure', async () => {
    const key = (await createPartnerKey(db, staffId, { partner: 'Hooks', mode: 'live', clientIds: [clientA] })).row
    const { webhook, secret } = await createWebhook(db, key, {
      url: 'https://partner.example.com/hook',
      events: ['clip.approved', 'campaign.ended'],
    })
    // The job starts from now: older events are not sent.
    const t0 = new Date()
    await queueWebhookEvents(db, t0)

    // A post approved on this client's campaign, one on another client's, then both campaigns end.
    const a = await post(live, 'approved', { views: 2_000, likes: 20 })
    const b = await post(other, 'approved', { views: 2_000, likes: 20 })
    await db.insert(tables.reviewDecisions).values([
      { submissionId: a.id, reviewerId: staffId, outcome: 'approve' },
      { submissionId: b.id, reviewerId: staffId, outcome: 'approve' },
    ])
    await db.transaction((tx) => closeCampaign(tx, staffId, live.id))
    await db.transaction((tx) => closeCampaign(tx, staffId, other.id))
    await writeAudit(db, { actorId: staffId, action: 'campaign.publish', entity: 'campaign', entityId: live.id })

    const t1 = new Date(Date.now() + 1000)
    const q = await queueWebhookEvents(db, t1)
    expect(q.queued).toBe(2) // clip.approved on A's campaign, and A's campaign ending; not campaign.started
    expect((await queueWebhookEvents(db, t1)).queued).toBe(0)

    const sent: { url: string; body: string; headers: Record<string, string> }[] = []
    let answer = 500
    const send: Send = async (url, init) => {
      sent.push({ url, body: String(init.body), headers: init.headers as Record<string, string> })
      return { status: answer }
    }
    const first = await deliverWebhooks(db, { now: t1, send })
    expect(first).toMatchObject({ due: 2, delivered: 0 })
    // Not due again until a minute later.
    expect((await deliverWebhooks(db, { now: new Date(t1.getTime() + 30_000), send })).due).toBe(0)
    answer = 200
    const second = await deliverWebhooks(db, { now: new Date(t1.getTime() + 61_000), send })
    expect(second).toMatchObject({ due: 2, delivered: 2 })
    expect((await deliverWebhooks(db, { now: new Date(t1.getTime() + 3_600_000), send })).due).toBe(0)

    const last = sent.at(-1)!
    const types = sent.slice(-2).map((s) => JSON.parse(s.body).type)
    expect(types.sort()).toEqual(['campaign.ended', 'clip.approved'])
    const approved = JSON.parse(sent.find((s) => JSON.parse(s.body).type === 'clip.approved')!.body)
    expect(approved).toMatchObject({
      object: 'event',
      livemode: true,
      data: { clip: { id: a.id }, campaign: { id: live.id } },
    })
    // The signature checks out with the webhook's secret.
    const [, t, v1] = last.headers['mde-signature']!.match(/^t=(\d+),v1=([0-9a-f]{64})$/)!
    expect(createHmac('sha256', secret).update(`${t}.${last.body}`).digest('hex')).toBe(v1)
    expect(last.url).toBe(webhook.url)

    expect(await deleteWebhook(db, key, webhook.id)).toBe(true)
    expect(await deleteWebhook(db, key, webhook.id)).toBe(false)
  })

  it('gives up after the last retry', async () => {
    const key = (await createPartnerKey(db, staffId, { partner: 'Down', mode: 'sandbox', clientIds: null })).row
    await createWebhook(db, key, { url: 'https://down.example.com/hook', events: ['clip.approved'] })
    const t0 = new Date(Date.now() + 5000)
    await queueWebhookEvents(db, t0)
    const c = await post(demo, 'approved', { views: 10, likes: 1 })
    await db.insert(tables.reviewDecisions).values({ submissionId: c.id, reviewerId: staffId, outcome: 'approve' })
    // The decision is stamped now; move the cursor back so this run sees it.
    await db.update(tables.webhookCursors).set({ at: new Date(Date.now() - 60_000) })
    const at = new Date(Date.now() + 6000)
    expect((await queueWebhookEvents(db, at)).queued).toBe(1)
    const send: Send = async () => {
      throw new Error('connection refused')
    }
    let now = at
    let result = { failed: 0 }
    for (let i = 0; i < 8; i++) {
      result = await deliverWebhooks(db, { now, send })
      now = new Date(now.getTime() + 25 * 3_600_000)
    }
    expect(result.failed).toBe(1)
    const [d] = await db
      .select()
      .from(tables.webhookDeliveries)
      .where(eq(tables.webhookDeliveries.event, 'clip.approved'))
      .orderBy(tables.webhookDeliveries.createdAt)
    expect(d).toBeTruthy()
  })
})
