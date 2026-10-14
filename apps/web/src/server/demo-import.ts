import 'server-only'
import {
  campaignFormSchema,
  createClient,
  createDraft,
  fundCampaign,
  publishCampaign,
  recordClientFunding,
} from '@mde/campaigns'
import { db, recordSnapshot, tables, writeAudit, type Db } from '@mde/db'
import { accrueEarnings, createPgStore } from '@mde/money'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { saveUpload } from './storage'

// A demo campaign for a showcase video (owner request, 2026-10-14): real public clips with their real
// view, like and comment counts and their real post dates, inside a campaign that never existed. Marked
// demo so creators never see it, the worker never checks it, the leaderboard never counts it, and the
// lifecycle and release jobs leave it alone. Its client, funding and earnings are play money in the real
// ledger, labelled "(demo)". It is built in small steps from the admin page so no request runs long:
// start, clips from the platforms' search, YouTube clips from the file, finish.

export type DemoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'x'

export type DemoClip = {
  platform: DemoPlatform
  url: string
  platformPostId: string
  handle: string
  channel: string
  title: string | null
  views: number
  likes: number | null
  comments: number | null
  /** ISO time the clip was posted. Clips outside the campaign's window are never used. */
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
  /** The most one post can earn, in cents; 0 for no cap. */
  capPerPostCents: number
  minViewsToEarn: number
  platforms: DemoPlatform[]
  /** The campaign ran from startAt to endAt (ISO). Every clip was posted inside this window. */
  startAt: string
  endAt: string
  /** Search for clips on the other platforms through the data provider, within a credit limit. */
  search: {
    queries: string[]
    /** A clip's caption must mention one of these words. */
    mustMention: string[]
    minViews: number
    /** The most credits one build may spend. */
    creditCap: number
    /** The share of the budget each searched platform may take; YouTube fills the rest. */
    shares: Partial<Record<'tiktok' | 'instagram' | 'x', number>>
    /** Pages per query per platform. */
    pages: Partial<Record<'tiktok' | 'instagram' | 'x', number>>
    /** Per searched platform: this many clips may earn more than overCents; the rest must earn less. */
    bigClips: { count: number; overCents: number }
  }
  /** YouTube clips, found for free, used last to fill what the budget has left. */
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
const earnFor = (spec: Pick<DemoSpec, 'rateCentsPer1000' | 'capPerPostCents'>, views: number) => {
  const raw = Math.floor((views * spec.rateCentsPer1000) / 1000)
  return spec.capPerPostCents ? Math.min(raw, spec.capPerPostCents) : raw
}

export type DemoStatus = {
  id: string
  status: string
  posts: number
  views: number
  earnedCents: number
  budgetCents: number
  byPlatform: Record<string, { posts: number; earnedCents: number }>
}

async function current(d: Db, spec: DemoSpec) {
  const [c] = await d
    .select()
    .from(tables.campaigns)
    .where(
      and(eq(tables.campaigns.title, spec.title), eq(tables.campaigns.demo, true), isNull(tables.campaigns.deletedAt)),
    )
  return c ?? null
}

/** Where the demo campaign stands: not made yet, or made with these totals. */
export async function demoStatus(spec: DemoSpec): Promise<DemoStatus | null> {
  const d = db()
  const c = await current(d, spec)
  if (!c) return null
  const rows = await d.execute<{ platform: string; posts: string; views: string; earned: string }>(sql`
    select platform, count(*) as posts, coalesce(sum(counted_views), 0) as views, coalesce(sum(earned_cents), 0) as earned
    from submissions where campaign_id = ${c.id} group by platform`)
  const byPlatform: DemoStatus['byPlatform'] = {}
  let posts = 0
  let views = 0
  let earnedCents = 0
  for (const r of rows) {
    byPlatform[r.platform] = { posts: Number(r.posts), earnedCents: Number(r.earned) }
    posts += Number(r.posts)
    views += Number(r.views)
    earnedCents += Number(r.earned)
  }
  return { id: c.id, status: c.status, posts, views, earnedCents, budgetCents: c.budgetCents, byPlatform }
}

/**
 * The empty demo campaign: its client, funding, campaign and terms. With replace, a demo already under
 * this title is hidden first (its play money stays in the ledger, labelled demo). Audited.
 */
export async function startDemo(actorId: string, spec: DemoSpec, opts: { replace?: boolean } = {}) {
  const d = db()
  const existing = await current(d, spec)
  if (existing) {
    if (!opts.replace) return existing.id
    await d.transaction(async (tx) => {
      await tx
        .update(tables.campaigns)
        .set({ deletedAt: new Date(), status: 'closed', releaseAt: null })
        .where(eq(tables.campaigns.id, existing.id))
      await writeAudit(tx, {
        actorId,
        action: 'campaign.demo_replaced',
        entity: 'campaign',
        entityId: existing.id,
        before: { status: existing.status },
        after: { deleted: true },
      })
    })
  }
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
    reference: `DEMO-${spec.slug}-${Date.now()}`,
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
      capPerPostCents: spec.capPerPostCents ? dollars(spec.capPerPostCents) : '',
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
      startAt: spec.startAt,
      endAt: '',
      termsDraftMarkdown: 'Demo campaign.',
      templateFields: {},
    }),
  )
  // Marked demo before it goes live, so no job ever sees it as a real campaign.
  await d.update(tables.campaigns).set({ demo: true }).where(eq(tables.campaigns.id, c.id))
  await fundCampaign(d, actorId, c.id)
  await publishCampaign(d, actorId, c.id)
  return c.id
}

/** A copy of a platform picture in our own storage: platform links expire, ours do not. Null when it cannot be fetched. */
async function keepPicture(url: string | null, actorId: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('/') || url.includes('i.ytimg.com')) return url
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, cache: 'no-store' })
    if (!res.ok || !res.body) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const data = new Uint8Array(await res.arrayBuffer())
    if (data.length > 2_000_000) return null
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const f = await saveUpload(
      { name: `demo-thumb.${ext}`, contentType: type, size: data.length, body: new Response(data).body! },
      actorId,
    )
    return f.url
  } catch {
    return null
  }
}

/** One clip into the demo campaign: its creator, account, post, day rows, snapshot and earnings. False when it was there already. */
async function insertDemoClip(
  d: Db,
  c: { id: string; termsVersionId: string; rate: number; endAt: Date },
  clip: DemoClip,
  thumbnail: string | null,
  now: Date,
) {
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

  const publishedAt = new Date(clip.publishedAt!)
  const submittedAt = new Date(Math.min(publishedAt.getTime() + 3_600_000, c.endAt.getTime()))
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
      termsVersionId: c.termsVersionId,
      rateCentsPer1000Locked: c.rate,
      publishedAt,
      submittedAt,
      baselineViews: 0,
      latestViews: clip.views,
      countedViews: clip.views,
      thumbnailUrl: thumbnail,
      mediaKind: 'video',
      checkResults: [],
      nextCheckAt: null,
      createdAt: submittedAt,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: tables.submissions.id })
  if (!s) return false
  // The views grew fast in the first days and settled by the campaign's end; one row a day, in one insert.
  const days = Math.max(1, Math.ceil((c.endAt.getTime() - submittedAt.getTime()) / DAY))
  const norm = 1 - Math.exp(-days / 4)
  const rows = Array.from({ length: days }, (_, i) => {
    const at = new Date(submittedAt.getTime() + (i + 1) * DAY)
    const v = i === days - 1 ? clip.views : Math.floor((clip.views * (1 - Math.exp(-(i + 1) / 4))) / norm)
    const part = (n: number | null) => (n === null ? null : Math.floor((n * v) / Math.max(1, clip.views)))
    return {
      submissionId: s.id,
      day: at.toISOString().slice(0, 10),
      takenAt: at,
      views: v,
      likes: part(clip.likes),
      comments: part(clip.comments),
      shares: null,
    }
  })
  await d.insert(tables.viewSnapshotDays).values(rows).onConflictDoNothing()
  await recordSnapshot(d, {
    submissionId: s.id,
    takenAt: c.endAt,
    views: clip.views,
    likes: clip.likes,
    comments: clip.comments,
    shares: null,
    isPublic: true,
    source: 'demo',
  })
  await accrueEarnings(createPgStore(d), { submissionId: s.id })
  return true
}

/**
 * Clips into the demo campaign, biggest first, each in its own transaction, while the budget (and this
 * platform's share of it, when given) has room. Clips posted outside the campaign's window are skipped.
 */
export async function addDemoClips(
  actorId: string,
  spec: DemoSpec,
  clips: DemoClip[],
  opts: { platformShare?: number; limit?: number; bigClips?: { count: number; overCents: number } } = {},
) {
  const d = db()
  const campaign = await current(d, spec)
  if (!campaign?.currentTermsVersionId) throw new Error('Start the demo campaign first.')
  const status = (await demoStatus(spec))!
  const start = new Date(spec.startAt).getTime()
  const end = new Date(spec.endAt)
  let room = campaign.budgetCents - status.earnedCents
  const platform = clips[0]?.platform
  let platformRoom =
    opts.platformShare !== undefined && platform
      ? Math.floor(campaign.budgetCents * opts.platformShare) - (status.byPlatform[platform]?.earnedCents ?? 0)
      : Number.POSITIVE_INFINITY
  const have = new Set(
    (
      await d
        .select({ p: tables.submissions.platform, id: tables.submissions.platformPostId })
        .from(tables.submissions)
        .where(
          and(
            eq(tables.submissions.campaignId, campaign.id),
            inArray(
              tables.submissions.platformPostId,
              clips.map((c) => c.platformPostId),
            ),
          ),
        )
    ).map((r) => `${r.p}:${r.id}`),
  )
  // After a few viral clips per platform, only smaller ones: the budget spreads over many more posts.
  let bigLeft = Number.POSITIVE_INFINITY
  if (opts.bigClips && platform) {
    const [b] = await d.execute<{ n: string }>(sql`
      select count(*) as n from submissions
      where campaign_id = ${campaign.id} and platform = ${platform} and earned_cents > ${opts.bigClips.overCents}`)
    bigLeft = opts.bigClips.count - Number(b?.n ?? 0)
  }
  const ref = {
    id: campaign.id,
    termsVersionId: campaign.currentTermsVersionId,
    rate: campaign.rateCentsPer1000,
    endAt: end,
  }
  const now = new Date()
  let added = 0
  let views = 0
  for (const clip of [...clips].sort((a, b) => b.views - a.views)) {
    if (opts.limit !== undefined && added >= opts.limit) break
    if (room < 100 || platformRoom < 100) break
    if (have.has(`${clip.platform}:${clip.platformPostId}`)) continue
    const at = clip.publishedAt ? new Date(clip.publishedAt).getTime() : NaN
    if (!(at >= start && at < end.getTime())) continue
    if (clip.views < spec.minViewsToEarn) continue
    const cost = earnFor(spec, clip.views)
    if (cost > room || cost > platformRoom) continue
    const big = !!opts.bigClips && cost > opts.bigClips.overCents
    if (big && bigLeft <= 0) continue
    const thumbnail = await keepPicture(clip.thumbnail, actorId)
    const ok = await d.transaction((tx) => insertDemoClip(tx as unknown as Db, ref, clip, thumbnail, now))
    if (!ok) continue
    have.add(`${clip.platform}:${clip.platformPostId}`)
    room -= cost
    platformRoom -= cost
    if (big) bigLeft--
    added++
    views += clip.views
  }
  return { added, views, roomCents: room }
}

/** The campaign ends on its last day: closed, its posts final, nothing to release (play money). Audited. */
export async function finishDemo(actorId: string, spec: DemoSpec) {
  const d = db()
  const c = await current(d, spec)
  if (!c) throw new Error('Start the demo campaign first.')
  const end = new Date(spec.endAt)
  await d.transaction(async (tx) => {
    await tx
      .update(tables.campaigns)
      .set({ status: 'closed', closedAt: end, endAt: end, releaseAt: null })
      .where(eq(tables.campaigns.id, c.id))
    await tx
      .update(tables.submissions)
      .set({ state: 'final' })
      .where(and(eq(tables.submissions.campaignId, c.id), inArray(tables.submissions.state, ['approved', 'earning'])))
    await writeAudit(tx, {
      actorId,
      action: 'campaign.demo_finished',
      entity: 'campaign',
      entityId: c.id,
      after: { closedAt: end.toISOString() },
    })
  })
  return demoStatus(spec)
}
