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
  if (found.length !== 1) {
    if (found.length > 1) log(`Archived clips not added: ${found.length} campaigns match "${manifest.campaignTitle}"`)
    return
  }
  const c = found[0]!
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
        creatorNote: 'Added by staff from the video file; the post is no longer online.',
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
