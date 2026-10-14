import 'server-only'
import {
  campaignFormSchema,
  createClient,
  createDraft,
  fundCampaign,
  publishCampaign,
  recordClientFunding,
} from '@mde/campaigns'
import { db, recordSnapshot, tables } from '@mde/db'
import { accrueEarnings, createPgStore } from '@mde/money'
import { and, eq, sql } from 'drizzle-orm'

// A demo campaign for a showcase video (owner request, 2026-10-14): real public clips with their real
// view counts, inside a campaign that never existed. Marked demo so creators never see it, the worker
// never checks it, and the leaderboard never counts it. Its client, funding and earnings are play money
// in the real ledger, labelled "(demo)" so nobody mistakes them for business.

export type DemoClip = {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'x'
  url: string
  platformPostId: string
  handle: string
  channel: string
  title: string | null
  views: number
  likes: number | null
  comments: number | null
  /** ISO date the clip was posted, or null when unknown. */
  publishedAt: string | null
  thumbnail: string | null
}

export type DemoSpec = {
  slug: string
  title: string
  clientName: string
  brief: string
  coverImageUrl: string
  budgetCents: number
  rateCentsPer1000: number
  minViewsToEarn: number
  platforms: DemoClip['platform'][]
  /** Days before today the campaign started. */
  startedDaysAgo: number
  clips: DemoClip[]
}

const DAY = 86_400_000
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
const slugOf = (handle: string) =>
  handle
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '')
    .slice(0, 30) || 'creator'

/** Where the demo campaign stands: not made yet, or made with these totals. */
export async function demoStatus(spec: DemoSpec) {
  const d = db()
  const [c] = await d
    .select({ id: tables.campaigns.id, status: tables.campaigns.status })
    .from(tables.campaigns)
    .where(and(eq(tables.campaigns.title, spec.title), eq(tables.campaigns.demo, true)))
  if (!c) return null
  const [t] = await d.execute<{ posts: string; views: string; earned: string }>(sql`
    select count(*) as posts, coalesce(sum(counted_views), 0) as views, coalesce(sum(earned_cents), 0) as earned
    from submissions where campaign_id = ${c.id}`)
  return {
    id: c.id,
    status: c.status,
    posts: Number(t?.posts ?? 0),
    views: Number(t?.views ?? 0),
    earnedCents: Number(t?.earned ?? 0),
  }
}

/** Make the demo campaign with every clip in the spec. Running it again changes nothing. */
export async function importDemoCampaign(actorId: string, spec: DemoSpec) {
  const existing = await demoStatus(spec)
  if (existing) return { ...existing, created: false }
  const d = db()
  const now = new Date()
  const startAt = new Date(now.getTime() - spec.startedDaysAgo * DAY)

  const client = await createClient(d, actorId, {
    name: `${spec.clientName} (demo)`,
    contactName: null,
    contactEmail: null,
    serviceFeeBps: 0,
    notes: 'Demo campaign for a showcase video. Not real money.',
  })
  await recordClientFunding(d, actorId, {
    clientId: client.id,
    amountCents: spec.budgetCents,
    reference: `DEMO-${spec.slug}`,
  })
  const c = await createDraft(
    d,
    actorId,
    campaignFormSchema.parse({
      title: spec.title,
      type: 'clipping',
      clientId: client.id,
      coverImageUrl: spec.coverImageUrl,
      briefMarkdown: spec.brief,
      assets: '',
      examplePosts: '',
      platforms: spec.platforms,
      budgetCents: dollars(spec.budgetCents),
      rateCentsPer1000: dollars(spec.rateCentsPer1000),
      capPerPostCents: '',
      capPerCreatorCents: '',
      minViewsToEarn: String(spec.minViewsToEarn),
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
      visibility: 'private',
      accessCode: `demo-${spec.slug}`,
      startAt: startAt.toISOString(),
      endAt: '',
      termsDraftMarkdown: 'Demo campaign.',
      templateFields: {},
    }),
  )
  await d.update(tables.campaigns).set({ demo: true }).where(eq(tables.campaigns.id, c.id))
  await fundCampaign(d, actorId, c.id)
  await publishCampaign(d, actorId, c.id)
  const [campaign] = await d.select().from(tables.campaigns).where(eq(tables.campaigns.id, c.id))
  if (!campaign?.currentTermsVersionId) throw new Error('The demo campaign has no terms version.')

  const store = createPgStore(d)
  let posts = 0
  let views = 0
  const clips = [...spec.clips].sort((a, b) => b.views - a.views)
  for (const clip of clips) {
    const slug = slugOf(clip.handle)
    const email = `${slug}.${clip.platform}@demo.invalid`
    const [u] = await d
      .insert(tables.users)
      .values({ email, name: clip.channel, username: null })
      .onConflictDoNothing({ target: tables.users.email })
      .returning({ id: tables.users.id })
    const userId =
      u?.id ?? (await d.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email)))[0]!.id
    await d.insert(tables.creatorProfiles).values({ userId }).onConflictDoNothing()
    let [acc] = await d
      .select({ id: tables.linkedAccounts.id })
      .from(tables.linkedAccounts)
      .where(and(eq(tables.linkedAccounts.creatorId, userId), eq(tables.linkedAccounts.platform, clip.platform)))
    if (!acc)
      [acc] = await d
        .insert(tables.linkedAccounts)
        .values({
          creatorId: userId,
          platform: clip.platform,
          handle: slug,
          linkMethod: 'bio_code',
          status: 'verified',
          verifiedAt: now,
          platformUserId: `${clip.platform}-${slug}`,
        })
        .returning({ id: tables.linkedAccounts.id })
    await d.insert(tables.campaignMembers).values({ campaignId: c.id, creatorId: userId }).onConflictDoNothing()

    // Posted when the platform says, else somewhere in the campaign; submitted an hour after posting.
    const posted = clip.publishedAt ? new Date(clip.publishedAt) : null
    const publishedAt =
      posted && posted.getTime() > startAt.getTime() && posted.getTime() < now.getTime()
        ? posted
        : new Date(startAt.getTime() + Math.random() * (now.getTime() - startAt.getTime() - DAY))
    const submittedAt = new Date(Math.min(publishedAt.getTime() + 3_600_000, now.getTime() - 3_600_000))
    const [s] = await d
      .insert(tables.submissions)
      .values({
        campaignId: c.id,
        creatorId: userId,
        linkedAccountId: acc!.id,
        platform: clip.platform,
        postUrl: clip.url,
        platformPostId: clip.platformPostId,
        state: 'approved',
        termsVersionId: campaign.currentTermsVersionId,
        rateCentsPer1000Locked: campaign.rateCentsPer1000,
        publishedAt,
        submittedAt,
        baselineViews: 0,
        latestViews: clip.views,
        countedViews: clip.views,
        thumbnailUrl: clip.thumbnail,
        mediaKind: 'video',
        checkResults: [],
        nextCheckAt: null,
        createdAt: submittedAt,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: tables.submissions.id })
    if (!s) continue
    // The views grew from submission to today; the report draws that curve from the day rows.
    const days = Math.max(1, Math.floor((now.getTime() - submittedAt.getTime()) / DAY))
    for (let i = 1; i <= days; i++) {
      const t = i / days
      const share = 1 - Math.exp(-4 * t)
      const at = new Date(submittedAt.getTime() + i * DAY)
      const v = i === days ? clip.views : Math.floor((clip.views * share) / (1 - Math.exp(-4)))
      await d
        .insert(tables.viewSnapshotDays)
        .values({
          submissionId: s.id,
          day: at.toISOString().slice(0, 10),
          takenAt: at,
          views: v,
          likes: clip.likes === null ? null : Math.floor(clip.likes * (v / clip.views)),
          comments: clip.comments === null ? null : Math.floor(clip.comments * (v / clip.views)),
          shares: null,
        })
        .onConflictDoNothing()
    }
    await recordSnapshot(d, {
      submissionId: s.id,
      takenAt: now,
      views: clip.views,
      likes: clip.likes,
      comments: clip.comments,
      shares: null,
      isPublic: true,
      source: 'demo',
    })
    await accrueEarnings(store, { submissionId: s.id })
    // The money was reserved as the views came in, not all today.
    await d.execute(sql`
      update ledger_transactions set created_at = ${new Date(submittedAt.getTime() + DAY).toISOString()}::timestamptz
      where submission_id = ${s.id} and kind = 'earning_accrued'`)
    posts++
    views += clip.views
  }
  const status = await demoStatus(spec)
  return { ...(status ?? { id: c.id, status: 'live', posts, views, earnedCents: 0 }), created: true }
}
