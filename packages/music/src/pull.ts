// The music pull (build proposal section 5, jobs 2 and 3): once a day per song whose tracking is open.
// The first run after a match is confirmed pulls the history from before launch (the baseline); later
// runs pull the last 8 days again, so late corrections land. Rows are upserted, so a second run on the
// same day writes nothing new, and a song already pulled today is skipped.
//
// soundcharts-fix (15 Nov): every run keeps a diagnostic (what the provider answered: status, dates,
// field names, ids, errors), so "no numbers" can be told apart from "wrong shape". While nothing from the
// provider is stored yet, each daily run asks for the whole window from before launch again, so a song
// that was empty on its first pull still gets its history once the provider has it. Staff can also pull a
// song again at once (`force`).
import { tables, writeAudit, type Db } from '@mde/db'
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { baseline, dailyBySource, mergeDaily, addDays, type Row } from './calculations'
import type { ArtistMetric, Source, TrackMetric } from './metrics'
import {
  MusicProviderRefused,
  type ChartPoint,
  type MusicDataProvider,
  type PlaylistEntry,
  type ProviderCall,
} from './providers'
import { fetchTikTokSoundTotal } from './scrape-creators-music'

const { musicTracks, musicArtists, musicMetricSnapshots, musicJobRuns, musicPlaylistEntries, chartEntries, campaigns } =
  tables
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

/** Stored on music_job_runs.diagnostic. */
export type PullDiagnostic = {
  provider: string
  /** Why the provider was not asked, when it was not. */
  skippedProvider?: string
  window?: { from: string; to: string; wide: boolean }
  calls: ProviderCall[]
  /** Points written per metric in this run. */
  stored: Record<string, number>
  forced?: boolean
  /** Numbers asked with their history from before launch on this run (soundcharts-more). */
  historyFor?: string[]
}

type Point = {
  musicTrackId: string | null
  musicArtistId?: string | null
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
      .values(chunk.map((p) => ({ ...p, musicArtistId: p.musicArtistId ?? null, country: null, city: null })))
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

/** The provider's playlist places for a song, kept as they are now (soundcharts-more). */
export async function upsertPlaylistEntries(db: Db, trackId: string, source: string, entries: PlaylistEntry[]) {
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500)
    if (!chunk.length) continue
    await db
      .insert(musicPlaylistEntries)
      .values(chunk.map((e) => ({ ...e, musicTrackId: trackId, source })))
      .onConflictDoUpdate({
        target: [
          musicPlaylistEntries.musicTrackId,
          musicPlaylistEntries.source,
          musicPlaylistEntries.platform,
          musicPlaylistEntries.playlistId,
          musicPlaylistEntries.entryDate,
        ],
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          country: sql`excluded.country`,
          followers: sql`excluded.followers`,
          exitDate: sql`excluded.exit_date`,
          position: sql`excluded.position`,
          peakPosition: sql`excluded.peak_position`,
          positionDate: sql`excluded.position_date`,
          updatedAt: new Date(),
        },
      })
  }
}

/** The provider's chart places. A place staff typed in for the same chart and day is never overwritten. */
export async function upsertProviderCharts(db: Db, trackId: string, source: string, points: ChartPoint[]) {
  for (const p of points)
    await db
      .insert(chartEntries)
      .values({ ...p, musicTrackId: trackId, source })
      .onConflictDoUpdate({
        target: [
          chartEntries.musicTrackId,
          chartEntries.date,
          chartEntries.chartPlatform,
          chartEntries.chartName,
          chartEntries.country,
          chartEntries.city,
        ],
        set: {
          position: p.position,
          previousPosition: p.previousPosition,
          entryDate: p.entryDate,
          updatedAt: new Date(),
        },
        setWhere: sql`${chartEntries.source} = ${source}`,
      })
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
  opts: { force?: boolean } = {},
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
  if (fresh.length && !backfill && !opts.force) return 'skipped'
  if (fresh.some((r) => r.status === 'running')) return 'skipped'

  const [run] = await db
    .insert(musicJobRuns)
    .values({ jobName: MUSIC_PULL_JOB, musicTrackId: t.id, runDate: today, startedAt: now })
    .returning()
  const used: Record<string, number> = {}
  const startRequests = deps.provider.requests
  const errors: string[] = []
  const diag: PullDiagnostic = { provider: deps.provider.name, calls: [], stored: {} }
  if (opts.force) diag.forced = true
  if (!providerReady)
    diag.skippedProvider =
      deps.provider.name === 'none'
        ? 'no provider switched on'
        : t.provider !== deps.provider.name || !t.providerTrackId
          ? 'song not matched with this provider'
          : 'match not confirmed'
  deps.provider.takeCalls?.()
  try {
    // 1. The provider's history, per metric: from before launch while nothing of that metric from the
    //    provider is stored yet (the first run, every run until the provider has numbers, and the first run
    //    after a metric is added), the last 8 days after that. Asking for more days costs nothing extra up to
    //    100 days a call (help article 10104246).
    if (providerReady) {
      const have = await db
        .selectDistinct({ metric: musicMetricSnapshots.metric })
        .from(musicMetricSnapshots)
        .where(and(eq(musicMetricSnapshots.musicTrackId, t.id), eq(musicMetricSnapshots.source, deps.provider.name)))
      const stored = new Set(have.map((h) => h.metric))
      const wideFrom = addDays(t.launchDate, -t.baselineDays - 8)
      const windowFor = (metric: string) => (backfill || !stored.has(metric) ? wideFrom : addDays(today, -8))
      const main = windowFor('spotify_streams')
      diag.window = { from: main, to: today, wide: main === wideFrom }
      const points: Point[] = []
      const wideFor: string[] = []
      for (const metric of deps.provider.supportedTrackMetrics()) {
        const from = windowFor(metric)
        if (from === wideFrom) wideFor.push(metric)
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
      // The song's artist: Spotify monthly listeners, history the same way.
      const [artist] = t.musicArtistId
        ? await db.select().from(musicArtists).where(eq(musicArtists.id, t.musicArtistId))
        : []
      if (artist?.providerArtistId && artist.provider === deps.provider.name) {
        const artistHave = await db
          .selectDistinct({ metric: musicMetricSnapshots.metric })
          .from(musicMetricSnapshots)
          .where(
            and(eq(musicMetricSnapshots.musicArtistId, artist.id), eq(musicMetricSnapshots.source, deps.provider.name)),
          )
        const artistStored = new Set(artistHave.map((h) => h.metric))
        for (const metric of deps.provider.supportedArtistMetrics()) {
          const from = backfill || !artistStored.has(metric) ? wideFrom : addDays(today, -8)
          if (from === wideFrom) wideFor.push(metric)
          try {
            const series = await deps.provider.getArtistSeries(
              artist.providerArtistId,
              metric as ArtistMetric,
              from,
              today,
            )
            for (const p of series)
              points.push({
                musicTrackId: null,
                musicArtistId: artist.id,
                date: p.date,
                source: deps.provider.name as Source,
                metric,
                value: p.value,
                isCumulative: p.isCumulative,
              })
          } catch (e) {
            if (e instanceof MusicProviderRefused) errors.push(`${metric}: ${e.message}`)
            else throw e
          }
        }
      }
      for (const p of points) diag.stored[p.metric] = (diag.stored[p.metric] ?? 0) + 1
      // No Spotify streams: ask which Spotify ids the provider holds, so staff can see why.
      if (!points.some((p) => p.metric === 'spotify_streams') && !errors.some((e) => e.startsWith('spotify_streams')))
        await deps.provider.explainEmpty?.(t.providerTrackId!)
      await upsertPoints(db, points)

      // Playlist and chart places: past ones too until some are stored, the current ones after that.
      if (deps.provider.getPlaylistEntries) {
        const [anyEntry] = await db
          .select({ id: musicPlaylistEntries.id })
          .from(musicPlaylistEntries)
          .where(and(eq(musicPlaylistEntries.musicTrackId, t.id), eq(musicPlaylistEntries.source, deps.provider.name)))
          .limit(1)
        const history = backfill || !anyEntry
        if (history) wideFor.push('playlist_entries')
        try {
          const entries = await deps.provider.getPlaylistEntries(t.providerTrackId!, history)
          await upsertPlaylistEntries(db, t.id, deps.provider.name, entries)
          if (entries.length) diag.stored.playlist_entries = entries.length
        } catch (e) {
          if (e instanceof MusicProviderRefused) errors.push(`playlist_entries: ${e.message}`)
          else throw e
        }
      }
      if (deps.provider.getChartEntries) {
        const [anyChart] = await db
          .select({ id: chartEntries.id })
          .from(chartEntries)
          .where(and(eq(chartEntries.musicTrackId, t.id), eq(chartEntries.source, deps.provider.name)))
          .limit(1)
        const history = backfill || !anyChart
        if (history) wideFor.push('chart_entries')
        try {
          const charts = await deps.provider.getChartEntries(t.providerTrackId!, history)
          await upsertProviderCharts(db, t.id, deps.provider.name, charts)
          if (charts.length) diag.stored.chart_entries = charts.length
        } catch (e) {
          if (e instanceof MusicProviderRefused) errors.push(`chart_entries: ${e.message}`)
          else throw e
        }
      }
      if (wideFor.length) diag.historyFor = wideFor
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
        diagnostic: { ...diag, calls: [...diag.calls, ...(deps.provider.takeCalls?.() ?? [])] },
      })
      .where(eq(musicJobRuns.id, run!.id))
    return 'ok'
  } catch (e) {
    used[deps.provider.name] = deps.provider.requests - startRequests
    await db
      .update(musicJobRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        requestsUsed: used,
        error: String(e).slice(0, 2000),
        diagnostic: { ...diag, calls: [...diag.calls, ...(deps.provider.takeCalls?.() ?? [])] },
      })
      .where(eq(musicJobRuns.id, run!.id))
    return 'failed'
  }
}

/** A staff "Pull again now" waits this long after the song's last run started, so a double click asks once. */
export const PULL_AGAIN_GAP_MS = 60_000

/**
 * Staff pull one song again at once (soundcharts-fix, 15 Nov, to-do note 449): the daily "already pulled
 * today" rule is skipped, a run still going is not. Audited. Returns the run's diagnostic in plain words.
 */
export async function pullTrackNow(
  db: Db,
  actorId: string,
  campaignId: string,
  trackId: string,
  deps: PullDeps,
): Promise<{ ok: true; result: 'ok' | 'failed'; summary: string } | { ok: false; message: string }> {
  const now = deps.now ?? new Date()
  const [t] = await db
    .select()
    .from(musicTracks)
    .where(and(eq(musicTracks.id, trackId), eq(musicTracks.campaignId, campaignId)))
  if (!t) return { ok: false, message: 'This song is not on this campaign.' }
  const [last] = await db
    .select()
    .from(musicJobRuns)
    .where(and(eq(musicJobRuns.musicTrackId, t.id), eq(musicJobRuns.jobName, MUSIC_PULL_JOB)))
    .orderBy(desc(musicJobRuns.startedAt))
    .limit(1)
  if (last && now.getTime() - last.startedAt.getTime() < PULL_AGAIN_GAP_MS)
    return { ok: false, message: 'A pull for this song started less than a minute ago. Wait a minute and try again.' }
  const r = await pullTrack(db, t, deps, now, { force: true })
  if (r === 'skipped')
    return { ok: false, message: 'A pull for this song is still running. Try again in a few minutes.' }
  const [run] = await db
    .select()
    .from(musicJobRuns)
    .where(and(eq(musicJobRuns.musicTrackId, t.id), eq(musicJobRuns.jobName, MUSIC_PULL_JOB)))
    .orderBy(desc(musicJobRuns.startedAt))
    .limit(1)
  await writeAudit(db, {
    actorId,
    action: 'music.pull_requested',
    entity: 'music_track',
    entityId: t.id,
    after: { result: r, runId: run?.id ?? null },
  })
  const summary = describePull((run?.diagnostic as PullDiagnostic | null) ?? null, run?.error ?? null)
  return { ok: true, result: r, summary }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** One call in plain words, for the Music tab. */
export function describeCall(c: ProviderCall): string {
  const what = c.path.includes('/identifiers')
    ? 'Spotify ids held'
    : c.path.includes('/playlist/reach/')
      ? 'playlist reach'
      : c.path.includes('/playlist/current/')
        ? 'playlist entries'
        : c.path.includes('/charts/ranks/')
          ? 'chart entries'
          : c.path.includes('/artist/') && c.path.includes('/streaming/')
            ? 'artist monthly listeners'
            : c.path.includes('/audience/')
              ? `audience ${c.path.split('/audience/')[1]?.split('?')[0] ?? ''}`.trim()
              : c.path.includes('/by-isrc/')
                ? 'song by ISRC'
                : c.path.includes('/by-platform/')
                  ? 'song by Spotify id'
                  : c.path.split('?')[0]!
  const parts = [`${what}: answered ${c.status}`]
  if (c.status === 404) parts.push('song not found')
  if (c.dates !== undefined)
    parts.push(
      c.dates
        ? `${plural(c.dates, 'day')} (${c.datesWithNumbers ?? 0} with numbers, ${c.firstDate} to ${c.lastDate})`
        : 'no days',
    )
  if (c.identifiers !== undefined)
    parts.push(
      c.identifiers.length
        ? `ids ${c.identifiers.join(', ')}`
        : c.path.includes('/identifiers')
          ? 'no Spotify id'
          : 'no ids',
    )
  if (c.errors?.length) parts.push(`errors: ${c.errors.join(' | ')}`)
  if (c.fields?.length && !c.dates && c.status === 200) parts.push(`fields ${c.fields.join(', ')}`)
  return parts.join(', ')
}

/** A run's diagnostic in plain words. Null for runs from before the diagnostic existed. */
export function describePull(d: PullDiagnostic | null, error: string | null = null): string {
  if (!d) return error ?? 'No details kept for this run (it ran before details were recorded).'
  const out: string[] = []
  if (d.skippedProvider) out.push(`Provider not asked: ${d.skippedProvider}.`)
  if (d.window)
    out.push(`Asked for ${d.window.from} to ${d.window.to}${d.window.wide ? ' (history from before launch)' : ''}.`)
  if (d.historyFor?.length) out.push(`History from before launch asked for ${d.historyFor.join(', ')}.`)
  for (const c of d.calls) out.push(`${describeCall(c)}.`)
  const stored = Object.entries(d.stored).filter(([, v]) => v > 0)
  out.push(
    stored.length ? `Stored ${stored.map(([k, v]) => `${plural(v, 'day')} of ${k}`).join(', ')}.` : 'Stored nothing.',
  )
  if (error) out.push(error)
  return out.join(' ')
}
