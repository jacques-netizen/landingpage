import { createDb, tables } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  campaignFormSchema,
  CampaignError,
  cancelCampaign,
  copyCampaign,
  createClient,
  createDraft,
  fundCampaign,
  getPublicCampaign,
  goLive,
  joinCampaign,
  listPublicCampaigns,
  publishCampaign,
  recordClientFunding,
  runCampaignLifecycle,
  updateCampaign,
  type CampaignFormInput,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

let n = 0
async function staff() {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `staff-${Date.now()}-${++n}@test.invalid` })
    .returning()
  return u!.id
}
async function creator() {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `creator-${Date.now()}-${++n}@test.invalid` })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: u!.id })
  return u!.id
}

function form(clientId: string, over: Partial<CampaignFormInput> = {}) {
  return campaignFormSchema.parse({
    title: 'Test campaign',
    type: 'clipping',
    clientId,
    coverImageUrl: '/designed/camp-clip.png',
    briefMarkdown: 'Cut the best moments.',
    assets: 'Footage | https://example.com/footage',
    examplePosts: '',
    platforms: ['tiktok', 'instagram'],
    budgetCents: '$1,000.00',
    rateCentsPer1000: '$2.00',
    capPerPostCents: '$300.00',
    capPerCreatorCents: '$500.00',
    minViewsToEarn: '1000',
    minEngagementBps: '',
    maxPostsPerAccount: '',
    minFollowers: '',
    minAccountAgeDays: '',
    languages: '',
    allowedRegions: '',
    blockedRegions: '',
    requiredHashtags: '#ad, #client',
    requireAdDisclosure: true,
    minDurationSeconds: '',
    keepLiveDays: '30',
    visibility: 'public',
    accessCode: '',
    startAt: '',
    endAt: '',
    termsDraftMarkdown: 'Post on your own account. Keep the post up for 30 days.',
    templateFields: {},
    ...over,
  })
}

async function audits(entityId: string) {
  return db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, entityId))
}

describe('the campaign builder form', () => {
  it('turns dollars into whole cents and explains mistakes', () => {
    const f = form('00000000-0000-0000-0000-000000000000')
    expect(f).toMatchObject({
      budgetCents: 100_000,
      rateCentsPer1000: 200,
      capPerPostCents: 30_000,
      capPerCreatorCents: 50_000,
      minViewsToEarn: 1000,
    })
    expect(f.requiredHashtags).toEqual(['#ad', '#client'])
    const bad = campaignFormSchema.safeParse({ ...form('00000000-0000-0000-0000-000000000000'), budgetCents: '12.345' })
    expect(bad.success).toBe(false)
  })
})

describe('publishing and funding', () => {
  it('a staff user creates, funds and publishes a campaign, and every step is audited', async () => {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client A',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 1000,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id))
    expect(c.status).toBe('draft')
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 110_000, reference: 'INV-1' })
    expect(await fundCampaign(db, actor, c.id)).toBe('draft')
    expect(await publishCampaign(db, actor, c.id)).toBe('live')
    const pub = await getPublicCampaign(db, c.id)
    expect(pub!.figures).toMatchObject({ budgetCents: 100_000, leftCents: 100_000, paidCents: 0 })
    expect(pub!.terms!.bodyMarkdown).toContain('Keep the post up')
    expect((await audits(c.id)).map((a) => a.action)).toEqual(
      expect.arrayContaining(['campaign.create', 'campaign.fund', 'terms.create', 'campaign.publish']),
    )
  })

  it('tells staff and matching creators when a public campaign goes live', async () => {
    const actor = await staff()
    await db.insert(tables.staffRoles).values({ userId: actor, role: 'admin' })
    const account = async (who: string, platform: string, status = 'verified') =>
      db.insert(tables.linkedAccounts).values({
        creatorId: who,
        platform,
        handle: `h${++n}`,
        platformUserId: `p${Date.now()}${n}`,
        linkMethod: 'bio_code',
        status,
      })
    const tiktok = await creator()
    await account(tiktok, 'tiktok')
    const youtubeOnly = await creator()
    await account(youtubeOnly, 'youtube')
    const pending = await creator()
    await account(pending, 'tiktok', 'pending')
    const optedOut = await creator()
    await account(optedOut, 'instagram')
    await db.update(tables.users).set({ notifyNewCampaigns: false }).where(eq(tables.users.id, optedOut))

    const client = await createClient(db, actor, {
      name: 'Client N',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 1000,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id, { title: 'Alert campaign' }))
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 110_000, reference: 'INV-N' })
    await fundCampaign(db, actor, c.id)
    await publishCampaign(db, actor, c.id)

    const kinds = async (who: string) =>
      (await db.select().from(tables.notifications).where(eq(tables.notifications.userId, who))).map((x) => x.kind)
    const [alert] = await db.select().from(tables.notifications).where(eq(tables.notifications.userId, tiktok))
    expect(alert).toMatchObject({
      kind: 'new_campaign',
      title: 'New campaign: Alert campaign',
      body: 'Pays $2.00 per 1,000 views.',
      link: `/campaigns/${c.id}`,
    })
    expect(await kinds(youtubeOnly)).toEqual([])
    expect(await kinds(pending)).toEqual([])
    expect(await kinds(optedOut)).toEqual([])
    expect(await kinds(actor)).toEqual(expect.arrayContaining(['campaign_event', 'campaign_event']))
    expect(
      (await db.select().from(tables.notifications).where(eq(tables.notifications.userId, actor))).map((x) => x.title),
    ).toEqual(expect.arrayContaining(['Funding recorded', 'Campaign is live']))
  })

  it('goes live in one step: records only what the client still owes, funds and publishes', async () => {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client G',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 1000,
      notes: null,
    })
    // $300 already paid in; the campaign needs $2,000 budget + $200 fee = $2,200, so $1,900 is recorded.
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 30_000, reference: 'DEPOSIT' })
    const c = await createDraft(db, actor, form(client.id, { budgetCents: '2k' }))
    const r = await goLive(db, actor, c.id, { reference: 'INV-77' })
    expect(r).toEqual({ status: 'live', recordedCents: 190_000 })
    const pub = await getPublicCampaign(db, c.id)
    expect(pub!.figures).toMatchObject({ budgetCents: 200_000, leftCents: 200_000 })
    expect((await audits(c.id)).map((a) => a.action)).toEqual(
      expect.arrayContaining(['campaign.fund', 'campaign.publish']),
    )
    expect((await audits(client.id)).map((a) => a.after)).toEqual(
      expect.arrayContaining([{ amountCents: 190_000, reference: 'INV-77' }]),
    )
    // Running it again changes nothing.
    expect(await goLive(db, actor, c.id, { reference: 'INV-77' })).toEqual({ status: 'live', recordedCents: 0 })
  })

  it('will not go live until the campaign has everything it needs, and records nothing', async () => {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client H',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 0,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id, { briefMarkdown: '' }))
    await expect(goLive(db, actor, c.id, {})).rejects.toMatchObject({ code: 'incomplete' })
    expect((await audits(client.id)).filter((a) => a.action === 'funding.record')).toHaveLength(0)
  })

  it('a campaign cannot go live with partial funding', async () => {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client B',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 1000,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id))
    // Published before funding: it waits.
    expect(await publishCampaign(db, actor, c.id)).toBe('awaiting_funding')
    // The client paid the budget but not the fee: still not enough.
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 100_000, reference: 'INV-2' })
    await expect(fundCampaign(db, actor, c.id)).rejects.toMatchObject({ code: 'insufficient_client_funds' })
    const [still] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.id))
    expect(still!.status).toBe('awaiting_funding')
    // The rest arrives: it is funded and goes live.
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 10_000, reference: 'INV-3' })
    expect(await fundCampaign(db, actor, c.id)).toBe('live')
  })

  it('needs a brief, cover image and rules text before publishing', async () => {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client C',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 0,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id, { briefMarkdown: '', termsDraftMarkdown: '' }))
    await expect(publishCampaign(db, actor, c.id)).rejects.toThrow(/brief, rules text/)
  })
})

describe('changes after publishing', () => {
  async function liveCampaign() {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client D',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 0,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id))
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 100_000, reference: `INV-${c.id}` })
    await fundCampaign(db, actor, c.id)
    await publishCampaign(db, actor, c.id)
    return { actor, client, c }
  }

  it('keeps the money rules fixed but lets the rate change for new posts', async () => {
    const { actor, client, c } = await liveCampaign()
    await expect(
      updateCampaign(db, actor, c.id, form(client.id, { capPerPostCents: '$400.00' })),
    ).rejects.toBeInstanceOf(CampaignError)
    await expect(updateCampaign(db, actor, c.id, form(client.id, { budgetCents: '$2,000.00' }))).rejects.toThrow(
      /budget/,
    )
    const after = await updateCampaign(db, actor, c.id, form(client.id, { rateCentsPer1000: '$3.00' }))
    expect(after.rateCentsPer1000).toBe(300)
  })

  it('saves changed rules as a new terms version and keeps the old one', async () => {
    const { actor, client, c } = await liveCampaign()
    const before = (await getPublicCampaign(db, c.id))!.terms!
    await updateCampaign(
      db,
      actor,
      c.id,
      form(client.id, { termsDraftMarkdown: 'New rules: keep the post up for 45 days.' }),
    )
    const after = (await getPublicCampaign(db, c.id))!.terms!
    expect(after.id).not.toBe(before.id)
    const versions = await db.select().from(tables.termsVersions).where(eq(tables.termsVersions.campaignId, c.id))
    expect(versions).toHaveLength(2)
  })

  it('closes when the end date passes and moves earning posts to final', async () => {
    const { actor, client, c } = await liveCampaign()
    await updateCampaign(db, actor, c.id, form(client.id, { endAt: new Date(Date.now() - 1000).toISOString() }))
    const r = await runCampaignLifecycle(db)
    expect(r.closed).toBeGreaterThanOrEqual(1)
    const [closed] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.id))
    expect(closed!.status).toBe('closed')
    expect(closed!.releaseAt!.getTime() - closed!.closedAt!.getTime()).toBe(7 * 86_400_000)
    expect((await runCampaignLifecycle(db)).closed).toBe(0) // safe to run twice
  })

  it('cancels only campaigns that were never funded', async () => {
    const { actor, c } = await liveCampaign()
    await expect(cancelCampaign(db, actor, c.id)).rejects.toThrow(/Close a live campaign/)
  })

  it('copies a campaign as a new draft in the same series', async () => {
    const { actor, c } = await liveCampaign()
    const copy = await copyCampaign(db, actor, c.id)
    expect(copy).toMatchObject({ status: 'draft', seriesId: c.id, budgetCents: c.budgetCents })
  })
})

describe('joining', () => {
  it('public campaigns are listed; private ones need the access code', async () => {
    const actor = await staff()
    const client = await createClient(db, actor, {
      name: 'Client E',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 0,
      notes: null,
    })
    const c = await createDraft(db, actor, form(client.id, { visibility: 'private', accessCode: 'MDE-7K4Q' }))
    await recordClientFunding(db, actor, { clientId: client.id, amountCents: 100_000, reference: `INV-${c.id}` })
    await fundCampaign(db, actor, c.id)
    await publishCampaign(db, actor, c.id)
    expect((await listPublicCampaigns(db)).some((x) => x.campaign.id === c.id)).toBe(false)

    const me = await creator()
    await expect(joinCampaign(db, me, c.id, 'WRONG')).rejects.toMatchObject({ code: 'access_code' })
    await joinCampaign(db, me, c.id, 'mde-7k4q')
    await joinCampaign(db, me, c.id, 'MDE-7K4Q') // joining twice is fine
    const rows = await db
      .select()
      .from(tables.campaignMembers)
      .where(and(eq(tables.campaignMembers.campaignId, c.id), eq(tables.campaignMembers.creatorId, me)))
    expect(rows).toHaveLength(1)
  })
})
