// The music pull (build proposal section 5, jobs 2 and 3): once a day per song whose tracking is open.
// The first run after a match is confirmed pulls the history from before launch (the baseline); later
// runs pull the last 8 days again, so late corrections land. Rows are upserted, so a second run on the
// same day writes nothing new, and a song already pulled today is skipped.
import { tables, type Db } from '@mde/db'
import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { baseline, dailyBySource, mergeDaily, addDays, type Row } from './calculations'
import type { Source, TrackMetric } from './metrics'
import { MusicProviderRefused, type MusicDataProvider } from './providers'
import { fetchTikTokSoundTotal } from './scrape-creators-music'

const { musicTracks, musicMetricSnapshots, musicJobRuns, campaigns } = tables
export const MUSIC_PULL_JOB = 'music-pull'
const RUNNING_LEASE_MS = 30 * 60_000

export type PullDeps = {
  provider: MusicDataProvider
  /** Scrape Creators key (DATA_PROVIDER_API_KEY); without it the sound count is not read. */
  scrapeCreatorsKey?: string
  http?: typeof fetch
  scrapeCreatorsBase?: string
  now?: Date
}

type Point = {
  musicTrackId: string
  date: string
  source: Source
  metric: string
  value: number
  isCumulative: boolean
}

export async function upsertPoints(db: Db, points: Point[]) {
  for (let i = 0; i < points.length; i += 500) {
    const chunk = points.slice(i, i + 500)
    if (!chunk.length) continue
    await db
      .insert(musicMetricSnapshots)
      .values(chunk.map((p) => ({ ...p, musicArtistId: null, country: null, city: null })))
      .onConflictDoUpdate({
        target: [
          musicMetricSnapshots.musicTrackId,
          musicMetricSnapshots.musicArtistId,
          musicMetricSnapshots.date,
          musicMetricSnapshots.source,
          musicMetricSnapshots.metric,
          musicMetricSnapshots.country,
          musicMetricSnapshots.city,
        ],
        set: { value: sql`excluded.value`, isCumulative: sql`excluded.is_cumulative`, updatedAt: new Date() },
      })
  }
}

/** Pulls every open song that has not been pulled today. */
export async function runMusicPulls(db: Db, deps: PullDeps) {
  const now = deps.now ?? new Date()
  const today = now.toISOString().slice(0, 10)
  const tracks = await db
    .select({ t: musicTracks })
    .from(musicTracks)
    .innerJoin(campaigns, eq(campaigns.id, musicTracks.campaignId))
    .where(
      and(
        isNull(campaigns.deletedAt),
        eq(campaigns.demo, false),
        or(isNull(musicTracks.trackingEndDate), gte(musicTracks.trackingEndDate, today)),
      ),
    )
  let pulled = 0
  let failed = 0
  let skipped = 0
  for (const { t } of tracks) {
    const r = await pullTrack(db, t, deps, now)
    if (r === 'ok') pulled++
    else if (r === 'failed') failed++
    else skipped++
  }
  return { tracks: tracks.length, pulled, failed, skipped }
}

export async function pullTrack(
  db: Db,
  t: typeof musicTracks.$inferSelect,
  deps: PullDeps,
  now: Date,
): Promise<'ok' | 'failed' | 'skipped'> {
  const today = now.toISOString().slice(0, 10)
  const runs = await db
    .select()
    .from(musicJobRuns)
    .where(
      and(
        eq(musicJobRuns.musicTrackId, t.id),
        eq(musicJobRuns.jobName, MUSIC_PULL_JOB),
        eq(musicJobRuns.runDate, today),
        inArray(musicJobRuns.status, ['ok', 'running']),
      ),
    )
  // A backfill that is waiting (pending) runs even when today's daily pull already ran.
  const fresh = runs.filter((r) => r.status === 'ok' || now.getTime() - r.startedAt.getTime() < RUNNING_LEASE_MS)
  const providerReady =
    deps.provider.name !== 'none' && t.provider === deps.provider.name && !!t.providerTrackId && !!t.matchConfirmedAt
  const backfill = t.baselineStatus === 'pending' && providerReady
  if (fresh.length && !backfill) return 'skipped'
  if (fresh.some((r) => r.status === 'running')) return 'skipped'

  const [run] = await db
    .insert(musicJobRuns)
    .values({ jobName: MUSIC_PULL_JOB, musicTrackId: t.id, runDate: today, startedAt: now })
    .returning()
  const used: Record<string, number> = {}
  const startRequests = deps.provider.requests
  const errors: string[] = []
  try {
    // 1. The provider's history (from before launch on the first run, the last 8 days after that).
    if (providerReady) {
      const from = backfill ? addDays(t.launchDate, -t.baselineDays - 8) : addDays(today, -8)
      const points: Point[] = []
      for (const metric of deps.provider.supportedTrackMetrics()) {
        try {
          const series = await deps.provider.getTrackSeries(t.providerTrackId!, metric as TrackMetric, from, today)
          for (const p of series)
            points.push({
              musicTrackId: t.id,
              date: p.date,
              source: deps.provider.name as Source,
              metric,
              value: p.value,
              isCumulative: p.isCumulative,
            })
        } catch (e) {
          // A metric the plan does not include must not stop the others.
          if (e instanceof MusicProviderRefused) errors.push(`${metric}: ${e.message}`)
          else throw e
        }
      }
      await upsertPoints(db, points)
    }
    used[deps.provider.name] = deps.provider.requests - startRequests

    // 2. The exact TikTok sound: videos using it so far (Scrape Creators keeps no history: one a day).
    if (deps.scrapeCreatorsKey && t.tiktokClipId) {
      const sound = await fetchTikTokSoundTotal(
        deps.scrapeCreatorsKey,
        t.tiktokClipId,
        deps.http,
        deps.scrapeCreatorsBase,
      )
      used.scrapecreators = 1
      if (sound?.videoCount !== null && sound?.videoCount !== undefined)
        await upsertPoints(db, [
          {
            musicTrackId: t.id,
            date: today,
            source: 'scrapecreators',
            metric: 'tiktok_sound_video_count',
            value: sound.videoCount,
            isCumulative: false,
          },
        ])
      if (sound?.musicId && sound.musicId !== t.tiktokMusicId)
        await db.update(musicTracks).set({ tiktokMusicId: sound.musicId }).where(eq(musicTracks.id, t.id))
    }

    // 3. Whether there is a "before" to compare with, from the streams now stored.
    const rows = await db
      .select()
      .from(musicMetricSnapshots)
      .where(
        and(
          eq(musicMetricSnapshots.musicTrackId, t.id),
          eq(musicMetricSnapshots.metric, 'spotify_streams'),
          isNull(musicMetricSnapshots.country),
        ),
      )
    const { daily } = mergeDaily(dailyBySource(rows as unknown as Row[]))
    const b = baseline(daily, t.launchDate, t.baselineDays)
    // Pending stays pending until the provider's history has been pulled once.
    const status = !providerReady && t.baselineStatus === 'pending' && b.status === 'unavailable' ? 'pending' : b.status
    if (status !== t.baselineStatus)
      await db.update(musicTracks).set({ baselineStatus: status }).where(eq(musicTracks.id, t.id))

    await db
      .update(musicJobRuns)
      .set({
        status: 'ok',
        finishedAt: new Date(),
        requestsUsed: used,
        error: errors.length ? errors.join('; ').slice(0, 2000) : null,
      })
      .where(eq(musicJobRuns.id, run!.id))
    return 'ok'
  } catch (e) {
    used[deps.provider.name] = deps.provider.requests - startRequests
    await db
      .update(musicJobRuns)
      .set({ status: 'failed', finishedAt: new Date(), requestsUsed: used, error: String(e).slice(0, 2000) })
      .where(eq(musicJobRuns.id, run!.id))
    return 'failed'
  }
}
