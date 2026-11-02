import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { writeAudit } from './audit'
import type { DbOrTx } from './client'
import * as tables from './schema'
import { recordSnapshot } from './snapshots'

// One-off: the One Billion Dollar Billboard clips that are no longer online, which the owner sent as
// video files on 2026-11-02 and asked us to add for them. They are added the same way as "Add clips that
// are no longer online" on the Clips tab (apps/web/src/server/archived-clips.ts): approved, archived,
// rate 0, never checked and never paid. Runs with the migrations on every deploy and adds only what is
// not there yet, so it does nothing once done or where the campaign does not exist.

type Clip = { file: string; platform: string; handle: string | null }
type Manifest = { campaignTitle: string; clips: Clip[] }

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'archived-clips')
const PREFIX = 'archived:'
// The owner's rule for this campaign (2026-11-02): every post was paid $10 flat, outside the platform.
// Kept on each post so staff see it; nothing here moves money.
// $10 a post plus $3 per 1,000 views (owner, 2026-11-02), rounded down to the cent like all money here.
export const BILLBOARD_FEE_CENTS = 1000
export const BILLBOARD_CPM_CENTS = 300
export const BILLBOARD_FEE_NOTE = 'Paid $10 per post plus $3 per 1,000 views, outside the platform (owner, 2026-11-02).'
// The first wording, still on posts an earlier deploy added; replaced below.
const OLD_FEE_NOTE = 'Paid $10 per post, flat, outside the platform (owner, 2026-11-02).'
const CLIP_NOTE = `Added by staff from the video file; the post is no longer online. ${BILLBOARD_FEE_NOTE}`
const POST_NOTE = `Added by staff from the campaign's report file of 2026-08-27, with its figures. ${BILLBOARD_FEE_NOTE}`

type ReportPost = {
  creator: string
  platform: string
  url: string
  postId: string
  handle: string | null
  postedOn: string
  views: number
  likes: number
  comments: number
  shares: number
}

export async function importArchivedClips(d: DbOrTx, log: (m: string) => void = console.log) {
  const manifest = JSON.parse(await readFile(path.join(DATA, 'manifest.json'), 'utf8')) as Manifest
  const found = await d
    .select()
    .from(tables.campaigns)
    .where(
      and(
        ilike(tables.campaigns.title, manifest.campaignTitle),
        isNull(tables.campaigns.deletedAt),
        inArray(tables.campaigns.status, ['live', 'closing', 'closed']),
      ),
    )
  if (!found.length) return
  // More than one match: the one holding the most posts (the live one the CSV posts went into).
  let c = found[0]!
  if (found.length > 1) {
    const counts = await d
      .select({ id: tables.submissions.campaignId, n: sql<number>`count(*)::int` })
      .from(tables.submissions)
      .where(
        inArray(
          tables.submissions.campaignId,
          found.map((x) => x.id),
        ),
      )
      .groupBy(tables.submissions.campaignId)
    const best = counts.sort((a, b) => b.n - a.n)[0]
    c = found.find((x) => x.id === best?.id) ?? c
    log(`${found.length} campaigns match "${manifest.campaignTitle}"; using "${c.title}"`)
  }
  if (!c.currentTermsVersionId) return

  let added = 0
  for (const clip of manifest.clips) {
    const postId = `${PREFIX}${clip.file}`
    const [have] = await d
      .select({ id: tables.submissions.id })
      .from(tables.submissions)
      .where(
        and(
          eq(tables.submissions.campaignId, c.id),
          eq(tables.submissions.platform, clip.platform),
          eq(tables.submissions.platformPostId, postId),
        ),
      )
    if (have) continue

    const [video] = await d
      .insert(tables.files)
      .values({
        name: `${clip.file}.mp4`,
        contentType: 'video/mp4',
        sizeBytes: 0,
        storage: 'db',
        data: await readFile(path.join(DATA, `${clip.file}.mp4`)),
      })
      .returning({ id: tables.files.id })
    await d.execute(sql`update files set size_bytes = octet_length(data) where id = ${video!.id}`)
    const [poster] = await d
      .insert(tables.files)
      .values({
        name: `${clip.file}.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 0,
        storage: 'db',
        data: await readFile(path.join(DATA, `${clip.file}.jpg`)),
      })
      .returning({ id: tables.files.id })
    await d.execute(sql`update files set size_bytes = octet_length(data) where id = ${poster!.id}`)

    const { creatorId, accountId } = await pageOf(d, clip)
    // The day the video was sent to us, from its file name (VIDEO-2026-07-05-10-55-53).
    const day = clip.file.match(/(\d{4}-\d{2}-\d{2})/)![1]
    const postedAt = new Date(`${day}T12:00:00Z`)
    await d.insert(tables.campaignMembers).values({ campaignId: c.id, creatorId }).onConflictDoNothing()
    const [s] = await d
      .insert(tables.submissions)
      .values({
        campaignId: c.id,
        creatorId,
        linkedAccountId: accountId,
        platform: clip.platform,
        postUrl: clip.handle ? `https://www.tiktok.com/@${clip.handle}` : 'https://www.tiktok.com/',
        platformPostId: postId,
        state: 'approved',
        termsVersionId: c.currentTermsVersionId,
        rateCentsPer1000Locked: 0,
        publishedAt: postedAt,
        submittedAt: postedAt,
        baselineViews: 0,
        checkResults: [],
        creatorNote: CLIP_NOTE,
        nextCheckAt: null,
        videoUrl: `/files/${video!.id}/${clip.file}.mp4`,
        thumbnailUrl: `/files/${poster!.id}/${clip.file}.jpg`,
        mediaKind: 'video',
        archived: true,
      })
      .onConflictDoNothing()
      .returning({ id: tables.submissions.id })
    if (!s) continue
    await recordSnapshot(d, { submissionId: s.id, takenAt: postedAt, views: 0, source: 'staff_archived' })
    await writeAudit(d, {
      actorId: null,
      action: 'submissions.archived_add',
      entity: 'submission',
      entityId: s.id,
      after: {
        campaignId: c.id,
        platform: clip.platform,
        handle: clip.handle,
        postedOn: day,
        views: 0,
        by: 'owner files 2026-11-02',
      },
    })
    added++
  }
  if (added) log(`Added ${added} clips that are no longer online to "${c.title}"`)
  // Clips added by an earlier deploy get the $10 note too.
  await d
    .update(tables.submissions)
    .set({ creatorNote: CLIP_NOTE })
    .where(
      and(
        eq(tables.submissions.campaignId, c.id),
        inArray(
          tables.submissions.platformPostId,
          manifest.clips.map((x) => `${PREFIX}${x.file}`),
        ),
      ),
    )
  await importReportPosts(d, c, log)
  await d
    .update(tables.submissions)
    .set({ creatorNote: sql`replace(${tables.submissions.creatorNote}, ${OLD_FEE_NOTE}, ${BILLBOARD_FEE_NOTE})` })
    .where(
      and(
        eq(tables.submissions.campaignId, c.id),
        eq(tables.submissions.archived, true),
        sql`strpos(${tables.submissions.creatorNote}, ${OLD_FEE_NOTE}) > 0`,
      ),
    )
  // The $10 a post is the campaign's flat fee per approved post, which the client report adds to every
  // post's spend, whether it came in through the app, a CSV or this step.
  await d
    .update(tables.campaigns)
    .set({ postFeeCents: BILLBOARD_FEE_CENTS })
    .where(and(eq(tables.campaigns.id, c.id), sql`${tables.campaigns.postFeeCents} <> ${BILLBOARD_FEE_CENTS}`))
  // Posts added here never earn on the platform, so their $3 per 1,000 views is recorded as paid outside
  // it too, in whole cents, rounded down. Posts that came in through the app or a CSV earn that rate
  // through the ledger already.
  const fee = sql`(${tables.submissions.countedViews} * ${BILLBOARD_CPM_CENTS}) / 1000`
  await d
    .update(tables.submissions)
    .set({ outsidePaidCents: fee })
    .where(
      and(
        eq(tables.submissions.campaignId, c.id),
        eq(tables.submissions.archived, true),
        sql`strpos(${tables.submissions.creatorNote}, ${BILLBOARD_FEE_NOTE}) > 0`,
        sql`${tables.submissions.outsidePaidCents} <> ${fee}`,
      ),
    )
}

/**
 * The 77 posts of the campaign's report file (owner, 2026-11-02: "I just need all of them in"). Each was
 * paid $10 flat outside the platform, so like the clips above they are archived and rate 0: shown with
 * the file's figures, never checked (no provider credits) and never paid again here. A post already in
 * the campaign is left as it is.
 */
async function importReportPosts(d: DbOrTx, c: typeof tables.campaigns.$inferSelect, log: (m: string) => void) {
  const posts = JSON.parse(await readFile(path.join(DATA, 'report-posts.json'), 'utf8')) as ReportPost[]
  // The figures are as the report file had them on the day it was made.
  const asOf = new Date('2026-08-27T12:00:00Z')
  let added = 0
  for (const p of posts) {
    const [have] = await d
      .select({ id: tables.submissions.id })
      .from(tables.submissions)
      .where(
        and(
          eq(tables.submissions.campaignId, c.id),
          eq(tables.submissions.platform, p.platform),
          eq(tables.submissions.platformPostId, p.postId),
        ),
      )
    if (have) continue
    const { creatorId, accountId } = await clipperOf(d, p)
    const postedAt = new Date(`${p.postedOn}T12:00:00Z`)
    await d.insert(tables.campaignMembers).values({ campaignId: c.id, creatorId }).onConflictDoNothing()
    const [s] = await d
      .insert(tables.submissions)
      .values({
        campaignId: c.id,
        creatorId,
        linkedAccountId: accountId,
        platform: p.platform,
        postUrl: p.url,
        platformPostId: p.postId,
        state: 'approved',
        termsVersionId: c.currentTermsVersionId!,
        rateCentsPer1000Locked: 0,
        publishedAt: postedAt,
        submittedAt: postedAt,
        baselineViews: 0,
        latestViews: p.views,
        countedViews: p.views,
        checkResults: [],
        creatorNote: POST_NOTE,
        nextCheckAt: null,
        mediaKind: 'video',
        archived: true,
      })
      .onConflictDoNothing()
      .returning({ id: tables.submissions.id })
    if (!s) continue
    await recordSnapshot(d, {
      submissionId: s.id,
      takenAt: asOf,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      source: 'staff_report_file',
    })
    await writeAudit(d, {
      actorId: null,
      action: 'submissions.archived_add',
      entity: 'submission',
      entityId: s.id,
      after: { campaignId: c.id, url: p.url, creator: p.creator, views: p.views, note: BILLBOARD_FEE_NOTE },
    })
    added++
  }
  if (added) log(`Added ${added} posts from the report file to "${c.title}"`)
}

/**
 * The clipper the file names: a user with that name or username, else the clipper who linked that page,
 * else a stand-in named after them. A TikTok page gets a removed account on the stand-in so the report
 * shows its handle without ever blocking a real link.
 */
async function clipperOf(d: DbOrTx, p: ReportPost): Promise<{ creatorId: string; accountId: string | null }> {
  if (p.handle) {
    const [a] = await d
      .select()
      .from(tables.linkedAccounts)
      .where(
        and(
          eq(tables.linkedAccounts.platform, p.platform),
          ilike(tables.linkedAccounts.handle, p.handle),
          sql`${tables.linkedAccounts.status} <> 'removed'`,
        ),
      )
      .limit(1)
    if (a) return { creatorId: a.creatorId, accountId: a.id }
  }
  const [named] = await d
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(
      sql`lower(${tables.users.name}) = lower(${p.creator}) or lower(${tables.users.username}) = lower(${p.creator})`,
    )
    .limit(1)
  let creatorId = named?.id
  if (!creatorId) {
    const slug =
      p.creator
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'unknown'
    const email = `archived+${slug}@clippers.invalid`
    await d.insert(tables.users).values({ email, name: p.creator }).onConflictDoNothing()
    const [u] = await d.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email))
    await d.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
    creatorId = u!.id
  }
  if (!p.handle) return { creatorId, accountId: null }
  const [have] = await d
    .select()
    .from(tables.linkedAccounts)
    .where(
      and(
        eq(tables.linkedAccounts.creatorId, creatorId),
        eq(tables.linkedAccounts.platform, p.platform),
        ilike(tables.linkedAccounts.handle, p.handle),
      ),
    )
    .limit(1)
  if (have) return { creatorId, accountId: have.id }
  const [a] = await d
    .insert(tables.linkedAccounts)
    .values({ creatorId, platform: p.platform, handle: p.handle, linkMethod: 'bio_code', status: 'removed' })
    .returning()
  return { creatorId, accountId: a!.id }
}

/** The clipper with that page, else a stand-in (its account marked removed, so it never blocks a real link). */
async function pageOf(d: DbOrTx, clip: Clip): Promise<{ creatorId: string; accountId: string | null }> {
  if (clip.handle) {
    const [a] = await d
      .select()
      .from(tables.linkedAccounts)
      .where(
        and(
          eq(tables.linkedAccounts.platform, clip.platform),
          ilike(tables.linkedAccounts.handle, clip.handle),
          sql`${tables.linkedAccounts.status} <> 'removed'`,
        ),
      )
      .limit(1)
    if (a) return { creatorId: a.creatorId, accountId: a.id }
  }
  const slug = clip.handle ? `${clip.platform}-${clip.handle.toLowerCase()}` : 'unknown-page'
  const email = `archived+${slug}@clippers.invalid`
  await d
    .insert(tables.users)
    .values({ email, name: clip.handle ? `@${clip.handle}` : 'Unknown page' })
    .onConflictDoNothing()
  const [u] = await d.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email))
  await d.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
  if (!clip.handle) return { creatorId: u!.id, accountId: null }
  const [have] = await d
    .select()
    .from(tables.linkedAccounts)
    .where(and(eq(tables.linkedAccounts.creatorId, u!.id), eq(tables.linkedAccounts.platform, clip.platform)))
    .limit(1)
  if (have) return { creatorId: u!.id, accountId: have.id }
  const [a] = await d
    .insert(tables.linkedAccounts)
    .values({
      creatorId: u!.id,
      platform: clip.platform,
      handle: clip.handle,
      linkMethod: 'bio_code',
      status: 'removed',
    })
    .returning()
  return { creatorId: u!.id, accountId: a!.id }
}
