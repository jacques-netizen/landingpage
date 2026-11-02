import 'server-only'
import { db, recordSnapshot, tables, writeAudit } from '@mde/db'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { ARCHIVED_PREFIX } from './archived-clips-id'

// Clips that are no longer online, added from their video files (owner decision, 2026-11-02: "show on
// the client report"). Each one is a post on the campaign with the figures staff typed, shown on the
// campaign and the client report and counted in their totals. It is never checked (archived) and never
// earns: its rate is 0 and no money moves, so no money rule changes.

export type ArchivedClipInput = {
  fileId: string
  thumbnailFileId: string | null
  platform: string
  handle: string
  postedOn: string // YYYY-MM-DD
  views: number
  likes: number | null
  comments: number | null
  shares: number | null
}

export type ArchivedClipResult = { ok: true } | { ok: false; error: string }

const PROFILE: Record<string, (h: string) => string> = {
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  instagram: (h) => `https://www.instagram.com/${h}/`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
}

export async function addArchivedClip(
  campaignId: string,
  staffId: string,
  input: ArchivedClipInput,
): Promise<ArchivedClipResult> {
  const d = db()
  const [c] = await d.select().from(tables.campaigns).where(eq(tables.campaigns.id, campaignId))
  if (!c || c.deletedAt) return { ok: false, error: 'That campaign is gone.' }
  if (!['live', 'closing', 'closed'].includes(c.status) || !c.currentTermsVersionId)
    return { ok: false, error: 'Clips can only be added to a campaign that has gone live.' }
  if (!PROFILE[input.platform]) return { ok: false, error: 'Choose the platform it was posted on.' }
  const handle = input.handle.trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(handle))
    return { ok: false, error: 'Enter the page it was posted on, like @page.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.postedOn) || Number.isNaN(Date.parse(input.postedOn)))
    return { ok: false, error: 'Enter the day it was posted.' }
  const postedAt = new Date(`${input.postedOn}T12:00:00Z`)
  if (postedAt.getTime() > Date.now()) return { ok: false, error: 'The day it was posted cannot be in the future.' }
  const count = (v: number | null) => (v === null ? null : Math.max(0, Math.floor(v)))
  const views = count(input.views) ?? 0

  const [file] = await d.select().from(tables.files).where(eq(tables.files.id, input.fileId))
  if (!file) return { ok: false, error: 'The video did not upload. Try again.' }
  const [thumb] = input.thumbnailFileId
    ? await d.select().from(tables.files).where(eq(tables.files.id, input.thumbnailFileId))
    : []

  // The page: a clipper's account with that handle, else a stand-in for the page. The stand-in's
  // account is marked removed, so a clipper who links that page later is never blocked by it.
  const like = handle.replace(/[\\%_]/g, '\\$&')
  const [found] = await d
    .select()
    .from(tables.linkedAccounts)
    .where(
      and(
        eq(tables.linkedAccounts.platform, input.platform),
        ilike(tables.linkedAccounts.handle, like),
        sql`${tables.linkedAccounts.status} <> 'removed'`,
      ),
    )
    .limit(1)
  let account = found
  if (!account) {
    const email = `archived+${input.platform}-${handle.toLowerCase()}@clippers.invalid`
    await d
      .insert(tables.users)
      .values({ email, name: `@${handle}` })
      .onConflictDoNothing()
    const [u] = await d.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email))
    await d.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
    ;[account] = await d
      .select()
      .from(tables.linkedAccounts)
      .where(and(eq(tables.linkedAccounts.creatorId, u!.id), eq(tables.linkedAccounts.platform, input.platform)))
      .limit(1)
    if (!account)
      [account] = await d
        .insert(tables.linkedAccounts)
        .values({ creatorId: u!.id, platform: input.platform, handle, linkMethod: 'bio_code', status: 'removed' })
        .returning()
  }

  const fileUrl = `/files/${file.id}/${encodeURIComponent(file.name)}`
  const [s] = await d
    .insert(tables.submissions)
    .values({
      campaignId,
      creatorId: account!.creatorId,
      linkedAccountId: account!.id,
      platform: input.platform,
      postUrl: PROFILE[input.platform]!(handle),
      platformPostId: `${ARCHIVED_PREFIX}${file.id}`,
      state: 'approved',
      termsVersionId: c.currentTermsVersionId,
      rateCentsPer1000Locked: 0,
      publishedAt: postedAt,
      submittedAt: postedAt,
      baselineViews: 0,
      latestViews: views,
      countedViews: views,
      checkResults: [],
      creatorNote: 'Added by staff from the video file; the post is no longer online.',
      nextCheckAt: null,
      videoUrl: fileUrl,
      thumbnailUrl: thumb ? `/files/${thumb.id}/${encodeURIComponent(thumb.name)}` : null,
      mediaKind: 'video',
      archived: true,
    })
    .onConflictDoNothing()
    .returning({ id: tables.submissions.id })
  if (!s) return { ok: false, error: 'That video is already in this campaign.' }
  await recordSnapshot(d, {
    submissionId: s.id,
    takenAt: postedAt,
    views,
    likes: count(input.likes),
    comments: count(input.comments),
    shares: count(input.shares),
    source: 'staff_archived',
  })
  await writeAudit(d, {
    actorId: staffId,
    action: 'submissions.archived_add',
    entity: 'submission',
    entityId: s.id,
    after: { campaignId, platform: input.platform, handle, postedOn: input.postedOn, views, fileId: file.id },
  })
  return { ok: true }
}
