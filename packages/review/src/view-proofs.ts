// View verification (owner brief, 2026-10-15): a creator shows a post's views from their own insights
// when the platform does not give them. Always for Instagram picture posts, which never show views
// publicly; for any other approved post when the scraped count is 0 or has not moved for two days. The
// creator uploads a screen recording of their insights (and a screenshot if they like) with the count
// it shows; staff watch it inside the campaign and approve at that count, at a different one, or
// reject with a reason. A post's views are the higher of the scraped count and the newest approved
// verification, so a verified count stands until the scraper passes it. Money moves only through the
// engine, from the views that result. Every decision is audited and the creator is told.
import crypto from 'node:crypto'
import { notify, recordSnapshot, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { accrueEarnings, createPgStore } from '@mde/money'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ReviewError } from './errors'

const { submissions, campaigns, viewProofs, viewSnapshots, files, users, linkedAccounts } = tables

/** Posts whose views a verification may set: approved posts still in the campaign. */
export const PROVABLE_STATES = ['approved', 'earning']
/** After an approved verification, the next one may be sent this many hours later. */
export const VERIFY_AGAIN_HOURS = 72
/** A scraped count that has not moved for this long opens verification on any post. */
export const STALE_HOURS = 48
/** The recording's limits. */
export const RECORDING_MAX_SECONDS = 60
export const RECORDING_MAX_BYTES = 100 * 1024 * 1024
/** This many rejected verifications in one campaign block the creator from it. */
export const REJECTIONS_TO_BLOCK = 3
/** A claim over this many times the scraped count is flagged for staff (reels, TikToks, videos). */
export const FLAG_RATIO = 10
/** A claim over this on an Instagram picture post, or on a post with no scraped count, is flagged. */
export const FLAG_ABSOLUTE = 50_000

export const VERIFY_INSTRUCTION =
  "Record your screen: start on your profile so we can see it's your account, open the post, open its insights, and show the view count."
export const VERIFY_LIMITS = 'MP4 or MOV, up to 60 seconds and 100 MB.'
export const INSTAGRAM_POST_TEXT = "Posts don't show views publicly. Upload your insights to get your views counted."
/** Kept for the creator form's checklist. */
export const PROOF_RULES = [
  VERIFY_INSTRUCTION,
  'One continuous recording with no cuts or edits, up to 60 seconds.',
  'The number you enter is the view count the insights show.',
  'A recording that does not show your account, the post and its insights is rejected. Three rejected verifications in one campaign block you from it.',
]

const EARNING = ['approved', 'earning']
// No look-alike characters, like the bio code (03_SYSTEMS.md 2.3). The code is kept on each
// verification as a reference staff and the creator can quote; it is not shown in the recording.
const ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY'
const HOUR = 3_600_000

export type VerifyWhy = 'instagram_post' | 'picture' | 'no_views' | 'stale'

/** An Instagram picture post (a /p/ address, not a reel). */
export const isInstagramPost = (platform: string, postUrl: string) =>
  platform === 'instagram' && /instagram\.com\/(?:[^/?#]+\/)?p\//i.test(postUrl)

/** A post the platform describes as a picture, or a TikTok photo post by its address. */
export function isPicturePost(s: { platform: string; postUrl: string; mediaKind: string | null }) {
  if (isInstagramPost(s.platform, s.postUrl)) return true
  if (s.mediaKind === 'image') return true
  return s.platform === 'tiktok' && /tiktok\.com\/[^?#]*\/photo\//i.test(s.postUrl)
}

export type ScrapedState = {
  /** The newest count a check read, null when none has. */
  scrapedViews: number | null
  /** When the scraped count last changed; the first check when it never has; null with no check. */
  scrapedChangedAt: Date | null
}

/**
 * Why the post may be verified now, or null. Instagram picture posts and other picture posts always;
 * any other approved post when the scraper has read 0 views or the count has not moved for 48 hours.
 */
export function canVerifyViews(
  s: { state: string; platform: string; postUrl: string; mediaKind: string | null; submittedAt: Date } & ScrapedState,
  now = new Date(),
): VerifyWhy | null {
  if (!PROVABLE_STATES.includes(s.state)) return null
  if (isInstagramPost(s.platform, s.postUrl)) return 'instagram_post'
  if (isPicturePost(s)) return 'picture'
  if (!s.scrapedViews) return 'no_views'
  const since = s.scrapedChangedAt ?? s.submittedAt
  return now.getTime() - since.getTime() >= STALE_HOURS * HOUR ? 'stale' : null
}

/** The scraped count and when it last moved, per post (manual snapshots from verifications left out). */
export async function scrapedState(d: DbOrTx, submissionIds: string[]): Promise<Map<string, ScrapedState>> {
  if (!submissionIds.length) return new Map()
  const rows = await d.execute<{ id: string; scraped: string | null; changed_at: Date | null }>(sql`
    select s.id, l.views as scraped,
      coalesce(
        (select max(v.taken_at) from view_snapshots v where v.submission_id = s.id
           and coalesce(v.source, '') <> 'manual' and v.views is not null and v.views <> l.views),
        (select min(v.taken_at) from view_snapshots v where v.submission_id = s.id
           and coalesce(v.source, '') <> 'manual' and v.views is not null)
      ) as changed_at
    from submissions s
    left join lateral (
      select views from view_snapshots v where v.submission_id = s.id
        and coalesce(v.source, '') <> 'manual' and v.views is not null
      order by taken_at desc limit 1
    ) l on true
    where s.id in (${sql.join(
      submissionIds.map((x) => sql`${x}`),
      sql`, `,
    )})`)
  return new Map(
    rows.map((r) => [
      r.id,
      {
        scrapedViews: r.scraped === null ? null : Number(r.scraped),
        scrapedChangedAt: r.changed_at ? new Date(r.changed_at) : null,
      },
    ]),
  )
}

const link = (submissionId: string) => `/submissions?open=${submissionId}`

function newCode() {
  let s = ''
  for (let i = 0; i < 4; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return `MDE-${s}`
}

async function ownPost(d: DbOrTx, submissionId: string, creatorId: string) {
  const [row] = await d
    .select({ s: submissions, status: campaigns.status })
    .from(submissions)
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .where(and(eq(submissions.id, submissionId), eq(submissions.creatorId, creatorId)))
  if (!row) throw new ReviewError('not_found', 'This post was not found.')
  return row
}

/** The newest verification on a post, whatever its status. */
export async function latestViewProof(d: DbOrTx, submissionId: string) {
  const [p] = await d
    .select()
    .from(viewProofs)
    .where(eq(viewProofs.submissionId, submissionId))
    .orderBy(desc(viewProofs.createdAt))
    .limit(1)
  return p ?? null
}

/** How many of the creator's verifications in the campaign were rejected. */
export async function rejectedVerifications(d: DbOrTx, creatorId: string, campaignId: string) {
  const [r] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(viewProofs)
    .innerJoin(submissions, eq(submissions.id, viewProofs.submissionId))
    .where(
      and(
        eq(viewProofs.creatorId, creatorId),
        eq(viewProofs.status, 'rejected'),
        eq(submissions.campaignId, campaignId),
      ),
    )
  return r?.n ?? 0
}

/** Three rejected verifications in one campaign block the creator from it: no new posts, no new verifications. */
export async function verificationBlocked(d: DbOrTx, creatorId: string, campaignId: string) {
  return (await rejectedVerifications(d, creatorId, campaignId)) >= REJECTIONS_TO_BLOCK
}

export type VerifyOption = {
  /** Why the post may be verified now; null when it may not. */
  why: VerifyWhy | null
  /** A verification is waiting for staff. */
  pending: boolean
  /** The creator is blocked from verifying in this campaign. */
  blocked: boolean
  /** When the next verification may be sent after an approved one, if that is what stops it now. */
  nextAt: Date | null
}

/**
 * Whether each of a creator's posts offers "Verify views" now (owner brief, 2026-10-15): eligible by the
 * rules above, nothing pending, not blocked, and 72 hours past the last approved verification.
 */
export async function verifyOptions(
  d: DbOrTx,
  creatorId: string,
  posts: {
    id: string
    campaignId: string
    state: string
    platform: string
    postUrl: string
    mediaKind: string | null
    submittedAt: Date
  }[],
  now = new Date(),
): Promise<Map<string, VerifyOption>> {
  const out = new Map<string, VerifyOption>()
  const eligible = posts.filter((p) => PROVABLE_STATES.includes(p.state))
  if (!eligible.length) return out
  const [scraped, proofs, rejected] = await Promise.all([
    scrapedState(
      d,
      eligible.map((p) => p.id),
    ),
    d
      .select()
      .from(viewProofs)
      .where(
        inArray(
          viewProofs.submissionId,
          eligible.map((p) => p.id),
        ),
      )
      .orderBy(desc(viewProofs.createdAt)),
    d
      .select({ campaignId: submissions.campaignId, n: sql<number>`count(*)::int` })
      .from(viewProofs)
      .innerJoin(submissions, eq(submissions.id, viewProofs.submissionId))
      .where(and(eq(viewProofs.creatorId, creatorId), eq(viewProofs.status, 'rejected')))
      .groupBy(submissions.campaignId),
  ])
  const blockedIn = new Set(rejected.filter((r) => r.n >= REJECTIONS_TO_BLOCK).map((r) => r.campaignId))
  for (const p of eligible) {
    const last = proofs.find((x) => x.submissionId === p.id) ?? null
    const st = scraped.get(p.id) ?? { scrapedViews: null, scrapedChangedAt: null }
    const why = canVerifyViews({ ...p, ...st }, now)
    const pending = last?.status === 'submitted'
    const blocked = blockedIn.has(p.campaignId)
    const nextAt =
      last?.status === 'approved' && last.reviewedAt
        ? new Date(last.reviewedAt.getTime() + VERIFY_AGAIN_HOURS * HOUR)
        : null
    out.set(p.id, { why, pending, blocked, nextAt: nextAt && nextAt > now ? nextAt : null })
  }
  return out
}

/**
 * Open a verification for the creator to fill in. The same open one comes back while it is unsent; one
 * waiting for staff, a block, or an approval in the last 72 hours stops a new one.
 */
export async function requestViewProof(db: Db, i: { submissionId: string; creatorId: string; now?: Date }) {
  const now = i.now ?? new Date()
  const { s, status } = await ownPost(db, i.submissionId, i.creatorId)
  if (!PROVABLE_STATES.includes(s.state))
    throw new ReviewError('wrong_state', 'Views can only be verified on an approved post.')
  if (!['live', 'closing'].includes(status))
    throw new ReviewError('campaign_closed', 'This campaign is no longer running.')
  const [opt] = (await verifyOptions(db, i.creatorId, [s], now)).values()
  if (opt?.blocked)
    throw new ReviewError(
      'blocked',
      'Three of your verifications in this campaign were rejected, so you cannot send more here.',
    )
  if (!opt?.why)
    throw new ReviewError(
      'wrong_state',
      'This post cannot be verified right now. Verification opens on Instagram posts, on posts with no scraped views, and when the count has not moved for two days.',
    )
  const last = await latestViewProof(db, i.submissionId)
  if (last) {
    if (last.status === 'submitted')
      throw new ReviewError('waiting', 'Your last verification is still waiting for review.')
    if (last.status === 'requested') return { id: last.id, code: last.code }
    if (opt.nextAt)
      throw new ReviewError(
        'too_soon',
        'A verification was approved on this post less than three days ago. You can send the next one after that.',
      )
  }
  const [p] = await db
    .insert(viewProofs)
    .values({ submissionId: i.submissionId, creatorId: i.creatorId, code: newCode(), createdAt: now, updatedAt: now })
    .returning()
  return { id: p!.id, code: p!.code }
}

async function ownFile(d: DbOrTx, id: string | null, creatorId: string, what: string, kind: 'image' | 'video') {
  if (!id) throw new ReviewError('file_required', `Add the ${what}.`)
  const [f] = await d
    .select({ id: files.id, by: files.uploadedBy, type: files.contentType })
    .from(files)
    .where(eq(files.id, id))
  if (!f || f.by !== creatorId || !f.type.startsWith(`${kind}/`))
    throw new ReviewError('bad_file', `The ${what} could not be used. Upload it again.`)
  return f.id
}

/** The safeguard flag a claim raises, if any. */
export function claimFlag(
  s: { platform: string; postUrl: string; mediaKind: string | null },
  claimedViews: number,
  scrapedViews: number | null,
): string | null {
  if (isPicturePost(s) || !scrapedViews) return claimedViews > FLAG_ABSOLUTE ? 'claim_over_50k' : null
  return claimedViews > scrapedViews * FLAG_RATIO ? 'claim_over_10x' : null
}

/** The creator sends the recording, the count their insights show, and a screenshot if they have one. */
export async function submitViewProof(
  db: Db,
  i: {
    proofId: string
    creatorId: string
    claimedViews: number
    screenshotFileId: string | null
    recordingFileId: string | null
    note: string | null
    now?: Date
  },
) {
  const now = i.now ?? new Date()
  const [p] = await db
    .select()
    .from(viewProofs)
    .where(and(eq(viewProofs.id, i.proofId), eq(viewProofs.creatorId, i.creatorId)))
  if (!p) throw new ReviewError('not_found', 'This verification was not found.')
  if (p.status !== 'requested') throw new ReviewError('wrong_state', 'This verification was already sent.')
  const { s } = await ownPost(db, p.submissionId, i.creatorId)
  if (!Number.isInteger(i.claimedViews) || i.claimedViews <= 0)
    throw new ReviewError('views_required', 'Enter the view count shown in your insights.')
  const recording = await ownFile(db, i.recordingFileId, i.creatorId, 'screen recording', 'video')
  const screenshot = i.screenshotFileId
    ? await ownFile(db, i.screenshotFileId, i.creatorId, 'screenshot', 'image')
    : null
  const scraped = (await scrapedState(db, [s.id])).get(s.id)?.scrapedViews ?? null
  await db
    .update(viewProofs)
    .set({
      status: 'submitted',
      claimedViews: i.claimedViews,
      screenshotFileId: screenshot,
      recordingFileId: recording,
      note: i.note?.trim() || null,
      flag: claimFlag(s, i.claimedViews, scraped),
      submittedAt: now,
      updatedAt: now,
    })
    .where(eq(viewProofs.id, p.id))
}

/**
 * Staff approve at the claimed count or at a different one, or reject with a reason. Approving keeps the
 * count as the post's verified views, sets the post's views to the higher of scraped and verified,
 * records a manual snapshot, and pays through the engine. The third rejection in a campaign blocks the
 * creator from it.
 */
export async function decideViewProof(
  db: Db,
  reviewerId: string,
  proofId: string,
  d: { outcome: 'approve'; views: number; note: string | null } | { outcome: 'reject'; note: string },
) {
  const now = new Date()
  const note = d.note?.trim() || null
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(viewProofs).where(eq(viewProofs.id, proofId)).for('update')
    if (!p) throw new ReviewError('not_found', 'This verification was not found.')
    if (p.status !== 'submitted') throw new ReviewError('wrong_state', 'This verification was already decided.')
    const [s] = await tx.select().from(submissions).where(eq(submissions.id, p.submissionId)).for('update')
    if (!s) throw new ReviewError('not_found', 'This post was not found.')
    const [c] = await tx.select({ title: campaigns.title }).from(campaigns).where(eq(campaigns.id, s.campaignId))
    if (d.outcome === 'reject') {
      if (!note) throw new ReviewError('note_required', 'Tell the creator why the verification was not accepted.')
      await tx
        .update(viewProofs)
        .set({ status: 'rejected', reviewerId, reviewedAt: now, decisionNote: note, updatedAt: now })
        .where(eq(viewProofs.id, p.id))
      await writeAudit(tx, {
        actorId: reviewerId,
        action: 'submission.verification_rejected',
        entity: 'submission',
        entityId: s.id,
        before: { proofId: p.id, claimedViews: p.claimedViews, flag: p.flag },
        after: { note },
      })
      await notify(tx, s.creatorId, 'view_proof', {
        title: 'Your view verification was not accepted',
        body: `${c?.title ?? 'Your campaign'}: ${note}`,
        link: link(s.id),
      })
      const rejected = await rejectedVerifications(tx, s.creatorId, s.campaignId)
      if (rejected === REJECTIONS_TO_BLOCK) {
        await writeAudit(tx, {
          actorId: reviewerId,
          action: 'creator.verifications_blocked',
          entity: 'user',
          entityId: s.creatorId,
          after: { campaignId: s.campaignId, rejected },
        })
        await notify(tx, s.creatorId, 'view_proof', {
          title: 'Verification blocked in a campaign',
          body: `${c?.title ?? 'A campaign'}: three of your verifications were rejected, so you can no longer send verifications or new posts there.`,
          link: link(s.id),
        })
      }
      return { accrue: false, submissionId: s.id, blocked: rejected >= REJECTIONS_TO_BLOCK }
    }
    const views = d.views
    if (!Number.isInteger(views) || views < 0) throw new ReviewError('views_required', 'Enter the views to approve.')
    const earning = await applyVerifiedViews(tx, {
      s,
      proofId: p.id,
      reviewerId,
      views,
      claimedViews: p.claimedViews,
      flag: p.flag,
      note,
      campaignTitle: c?.title ?? null,
      byStaff: false,
      now,
    })
    return { accrue: earning, submissionId: s.id, blocked: false }
  })
  if (!result.accrue) return { deltaCents: 0, blocked: result.blocked }
  const r = await accrueEarnings(createPgStore(db), { submissionId: result.submissionId })
  return { deltaCents: r.deltaCents, blocked: false }
}

/** Verifications for staff: waiting ones oldest first, decided ones newest first, each with its post and creator. */
export async function listViewProofs(db: Db, status: 'submitted' | 'decided', f: { campaignId?: string } = {}) {
  const rows = await db
    .select({
      p: viewProofs,
      submission: {
        id: submissions.id,
        platform: submissions.platform,
        platformPostId: submissions.platformPostId,
        postUrl: submissions.postUrl,
        state: submissions.state,
        mediaKind: submissions.mediaKind,
        latestViews: submissions.latestViews,
        verifiedViews: submissions.verifiedViews,
        baselineViews: submissions.baselineViews,
        countedViews: submissions.countedViews,
        earnedCents: submissions.earnedCents,
        thumbnailUrl: submissions.thumbnailUrl,
        videoUrl: submissions.videoUrl,
        publishedAt: submissions.publishedAt,
        submittedAt: submissions.submittedAt,
      },
      campaign: { id: campaigns.id, title: campaigns.title },
      creator: { id: users.id, email: users.email, username: users.username, name: users.name },
      handle: linkedAccounts.handle,
    })
    .from(viewProofs)
    .innerJoin(submissions, eq(submissions.id, viewProofs.submissionId))
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .innerJoin(users, eq(users.id, viewProofs.creatorId))
    .leftJoin(linkedAccounts, eq(linkedAccounts.id, submissions.linkedAccountId))
    .where(
      and(
        status === 'submitted'
          ? eq(viewProofs.status, 'submitted')
          : inArray(viewProofs.status, ['approved', 'rejected']),
        f.campaignId ? eq(submissions.campaignId, f.campaignId) : undefined,
      ),
    )
    .orderBy(status === 'submitted' ? viewProofs.submittedAt : desc(viewProofs.reviewedAt))
    .limit(200)
  const ids = rows.map((r) => r.submission.id)
  const [scraped, names] = await Promise.all([
    scrapedState(db, ids),
    (() => {
      const fileIds = rows.flatMap((r) => [r.p.screenshotFileId, r.p.recordingFileId]).filter((x): x is string => !!x)
      return fileIds.length
        ? db.select({ id: files.id, name: files.name }).from(files).where(inArray(files.id, fileIds))
        : Promise.resolve([] as { id: string; name: string }[])
    })(),
  ])
  const url = (id: string | null) => {
    const f = names.find((n) => n.id === id)
    return f ? `/files/${f.id}/${f.name}` : null
  }
  return rows.map((r) => ({
    id: r.p.id,
    status: r.p.status,
    code: r.p.code,
    claimedViews: r.p.claimedViews,
    setViews: r.p.setViews,
    flag: r.p.flag,
    note: r.p.note,
    decisionNote: r.p.decisionNote,
    requestedAt: r.p.createdAt,
    submittedAt: r.p.submittedAt,
    reviewedAt: r.p.reviewedAt,
    screenshotUrl: url(r.p.screenshotFileId),
    recordingUrl: url(r.p.recordingFileId),
    scrapedViews: scraped.get(r.submission.id)?.scrapedViews ?? null,
    submission: r.submission,
    campaign: r.campaign,
    creator: { ...r.creator, handle: r.handle },
  }))
}

/** Verifications waiting per campaign, for the campaigns list. */
export async function verificationsWaiting(d: DbOrTx): Promise<Map<string, number>> {
  const rows = await d
    .select({ campaignId: submissions.campaignId, n: sql<number>`count(*)::int` })
    .from(viewProofs)
    .innerJoin(submissions, eq(submissions.id, viewProofs.submissionId))
    .where(eq(viewProofs.status, 'submitted'))
    .groupBy(submissions.campaignId)
  return new Map(rows.map((r) => [r.campaignId, r.n]))
}

/** Per creator in a campaign: verifications waiting, rejected and approved, and whether they are blocked. */
export async function creatorVerificationStats(d: DbOrTx, campaignId: string) {
  const rows = await d
    .select({
      creatorId: viewProofs.creatorId,
      pending: sql<number>`count(*) filter (where ${viewProofs.status} = 'submitted')::int`,
      rejected: sql<number>`count(*) filter (where ${viewProofs.status} = 'rejected')::int`,
      approved: sql<number>`count(*) filter (where ${viewProofs.status} = 'approved')::int`,
    })
    .from(viewProofs)
    .innerJoin(submissions, eq(submissions.id, viewProofs.submissionId))
    .where(eq(submissions.campaignId, campaignId))
    .groupBy(viewProofs.creatorId)
  return new Map(rows.map((r) => [r.creatorId, { ...r, blocked: r.rejected >= REJECTIONS_TO_BLOCK }]))
}

/**
 * Keep an approved count as the post's verified views, set its views to the higher of scraped and
 * verified, record a manual snapshot, mark the verification approved, audit it and tell the creator.
 * Returns whether the post earns (so the caller pays it through the engine).
 */
async function applyVerifiedViews(
  tx: DbOrTx,
  i: {
    s: typeof submissions.$inferSelect
    proofId: string
    reviewerId: string
    views: number
    claimedViews: number | null
    flag: string | null
    note: string | null
    campaignTitle: string | null
    /** Staff set the count themselves from analytics the creator sent them outside the app. */
    byStaff: boolean
    /** Likes, comments and shares the analytics show, when staff entered them. */
    engagement?: { likes: number | null; comments: number | null; shares: number | null }
    now: Date
  },
) {
  const { s, views, now, note } = i
  const scraped = (await scrapedState(tx, [s.id])).get(s.id)?.scrapedViews ?? 0
  const effective = Math.max(scraped, views)
  // The snapshot keeps the post's likes, comments and shares: the ones staff entered, else the last
  // ones a check read, so the report never drops them to zero (owner report, 2026-10-17).
  const [last] = await tx
    .select({ likes: viewSnapshots.likes, comments: viewSnapshots.comments, shares: viewSnapshots.shares })
    .from(viewSnapshots)
    .where(
      and(
        eq(viewSnapshots.submissionId, s.id),
        sql`(${viewSnapshots.likes} is not null or ${viewSnapshots.comments} is not null or ${viewSnapshots.shares} is not null)`,
      ),
    )
    .orderBy(desc(viewSnapshots.takenAt))
    .limit(1)
  const keep = (entered: number | null | undefined, before: number | null | undefined) => entered ?? before ?? null
  await recordSnapshot(tx, {
    submissionId: s.id,
    takenAt: now,
    views: effective,
    likes: keep(i.engagement?.likes, last?.likes),
    comments: keep(i.engagement?.comments, last?.comments),
    shares: keep(i.engagement?.shares, last?.shares),
    source: 'manual',
    raw: {
      proofId: i.proofId,
      reviewerId: i.reviewerId,
      claimedViews: i.claimedViews,
      verifiedViews: views,
      scrapedViews: scraped,
      byStaff: i.byStaff,
    },
  })
  const earning = EARNING.includes(s.state)
  await tx
    .update(submissions)
    .set({
      verifiedViews: views,
      latestViews: effective,
      countedViews: earning ? Math.max(0, effective - s.baselineViews) : s.countedViews,
      updatedAt: now,
    })
    .where(eq(submissions.id, s.id))
  await tx
    .update(viewProofs)
    .set({
      status: 'approved',
      reviewerId: i.reviewerId,
      reviewedAt: now,
      setViews: views,
      decisionNote: note,
      updatedAt: now,
    })
    .where(eq(viewProofs.id, i.proofId))
  await writeAudit(tx, {
    actorId: i.reviewerId,
    action: 'submission.views_verified',
    entity: 'submission',
    entityId: s.id,
    before: {
      latestViews: s.latestViews,
      verifiedViews: s.verifiedViews,
      countedViews: s.countedViews,
      claimedViews: i.claimedViews,
      flag: i.flag,
    },
    after: {
      verifiedViews: views,
      latestViews: effective,
      scrapedViews: scraped,
      proofId: i.proofId,
      note,
      byStaff: i.byStaff,
    },
  })
  const title = i.campaignTitle ?? 'Your campaign'
  await notify(tx, s.creatorId, 'view_proof', {
    title: i.byStaff ? 'Your views were updated from your analytics' : 'Your view verification was approved',
    body: i.byStaff
      ? `${title}: ${views.toLocaleString('en-US')} views verified from the analytics you sent us.${note ? ` ${note}` : ''}`
      : `${title}: ${views.toLocaleString('en-US')} views verified.${
          views !== i.claimedViews ? ` You reported ${(i.claimedViews ?? 0).toLocaleString('en-US')}.` : ''
        }${note ? ` ${note}` : ''}`,
    link: link(s.id),
  })
  return earning
}

/**
 * Staff set a post's views from analytics the creator sent them outside the app (owner request,
 * 2026-10-16: a screenshot over WhatsApp). It is kept as an approved verification on the post, with the
 * screenshot when there is one, and counts like any other: the post's views become the higher of the
 * scraped count and this, the report marks it Verified, and the post earns from it.
 */
export async function staffVerifyViews(
  db: Db,
  reviewerId: string,
  i: {
    submissionId: string
    views: number
    screenshotFileId: string | null
    note: string | null
    /** Likes, comments and shares from the same analytics; any left out keep the last ones read. */
    likes?: number | null
    comments?: number | null
    shares?: number | null
    now?: Date
  },
) {
  const now = i.now ?? new Date()
  const note = i.note?.trim() || null
  if (!Number.isInteger(i.views) || i.views <= 0)
    throw new ReviewError('views_required', 'Enter the views the analytics show.')
  const result = await db.transaction(async (tx) => {
    const [s] = await tx.select().from(submissions).where(eq(submissions.id, i.submissionId)).for('update')
    if (!s) throw new ReviewError('not_found', 'This post was not found.')
    if (!PROVABLE_STATES.includes(s.state))
      throw new ReviewError('wrong_state', 'Views can only be set on an approved post that is still in the campaign.')
    const [c] = await tx.select({ title: campaigns.title }).from(campaigns).where(eq(campaigns.id, s.campaignId))
    if (i.screenshotFileId) {
      const [f] = await tx
        .select({ id: files.id, type: files.contentType })
        .from(files)
        .where(eq(files.id, i.screenshotFileId))
      if (!f || !f.type.startsWith('image/'))
        throw new ReviewError('bad_file', 'The screenshot could not be used. Upload it again.')
    }
    // An unsent verification the creator opened is replaced by this one.
    await tx.delete(viewProofs).where(and(eq(viewProofs.submissionId, s.id), eq(viewProofs.status, 'requested')))
    const scraped = (await scrapedState(tx, [s.id])).get(s.id)?.scrapedViews ?? null
    const [p] = await tx
      .insert(viewProofs)
      .values({
        submissionId: s.id,
        creatorId: s.creatorId,
        code: newCode(),
        status: 'submitted',
        claimedViews: i.views,
        screenshotFileId: i.screenshotFileId,
        note: 'Set by staff from analytics the creator sent.',
        flag: claimFlag(s, i.views, scraped),
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    const earning = await applyVerifiedViews(tx, {
      s,
      proofId: p!.id,
      reviewerId,
      views: i.views,
      claimedViews: i.views,
      flag: p!.flag,
      note,
      campaignTitle: c?.title ?? null,
      byStaff: true,
      engagement: { likes: i.likes ?? null, comments: i.comments ?? null, shares: i.shares ?? null },
      now,
    })
    return { accrue: earning, submissionId: s.id, proofId: p!.id }
  })
  if (!result.accrue) return { deltaCents: 0, proofId: result.proofId }
  const r = await accrueEarnings(createPgStore(db), { submissionId: result.submissionId })
  return { deltaCents: r.deltaCents, proofId: result.proofId }
}

/** Ask the creator to verify a post's views: a notification with the link to the form. Audited. */
export async function askForVerification(db: Db, reviewerId: string, submissionId: string, note: string | null) {
  const [row] = await db
    .select({ s: submissions, title: campaigns.title })
    .from(submissions)
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .where(eq(submissions.id, submissionId))
  if (!row) throw new ReviewError('not_found', 'This post was not found.')
  if (!PROVABLE_STATES.includes(row.s.state))
    throw new ReviewError('wrong_state', 'Only an approved post that is still in the campaign can be verified.')
  const text = note?.trim() || null
  await db.transaction(async (tx) => {
    await writeAudit(tx, {
      actorId: reviewerId,
      action: 'submission.verification_requested',
      entity: 'submission',
      entityId: row.s.id,
      after: { note: text },
    })
    await notify(tx, row.s.creatorId, 'view_proof', {
      title: 'Please verify the views on your post',
      body: `${row.title}: open the post, press Verify views, and upload a screen recording of its insights with the view count.${text ? ` ${text}` : ''}`,
      link: link(row.s.id),
    })
  })
}
