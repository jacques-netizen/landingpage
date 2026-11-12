import { tables, type DbOrTx } from '@mde/db'
import { and, eq, isNotNull, or } from 'drizzle-orm'

/**
 * The official TikTok sound of a campaign and its rule, or null when no tracked song has one. With several
 * songs, the first one added that has a sound is used.
 */
export async function officialSound(db: DbOrTx, campaignId: string) {
  const [t] = await db
    .select({
      trackId: tables.musicTracks.id,
      tiktokClipId: tables.musicTracks.tiktokClipId,
      tiktokMusicId: tables.musicTracks.tiktokMusicId,
      soundRule: tables.musicTracks.soundRule,
    })
    .from(tables.musicTracks)
    .where(
      and(
        eq(tables.musicTracks.campaignId, campaignId),
        or(isNotNull(tables.musicTracks.tiktokClipId), isNotNull(tables.musicTracks.tiktokMusicId)),
      ),
    )
    .orderBy(tables.musicTracks.createdAt)
    .limit(1)
  return t ?? null
}
