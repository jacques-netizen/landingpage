// The music figures of a campaign, for the staff Music tab and the client report (build proposal
// sections 7.2, 8 and 9). The same calculations feed both; the client gets only the sources it may see,
// never spend or cost figures, and only blocks that have data.
import { tables, type DbOrTx } from '@mde/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  addDays,
  attribution,
  chartRuns,
  dailyBySource,
  flowSummary,
  levelChange,
  mergeDaily,
  mergeLevels,
  soundUse,
  type Attribution,
  type ChartRun,
  type Day,
  type FlowSummary,
  type LevelChange,
  type Row,
  type SoundUse,
} from './calculations'
import type { PullDiagnostic } from './pull'
import { isFlowMetric, METRIC_LABEL, SOURCE_LINE, type Metric, type Source } from './metrics'

const {
  musicTracks,
  musicArtists,
  musicMetricSnapshots,
  musicPlaylistEntries,
  chartEntries,
  submissions,
  musicJobRuns,
  campaigns,
} = tables

/**
 * The numbers shown day by day against the clip timeline, in the owner's order of importance (18 Nov):
 * TikTok videos, Shazams, Spotify streams, playlists, Instagram Reels, YouTube, then the artist.
 */
export const ATTRIBUTION_METRICS: Metric[] = [
  'tiktok_song_video_count',
  'tiktok_sound_video_count',
  'shazam_count',
  'spotify_streams',
  'spotify_playlist_count',
  'spotify_editorial_playlist_count',
  'spotify_playlist_reach',
  'spotify_editorial_playlist_reach',
  'instagram_song_reel_count',
  'instagram_audio_reel_count',
  'youtube_song_views',
  'youtube_views',
  'spotify_monthly_listeners',
  'spotify_followers',
  'tiktok_followers',
  'instagram_followers',
  'youtube_subscribers',
]

/** One number before, during and after the campaign, with the series behind it. */
export type AttributionBlock = { metric: Metric; label: string; sources: Source[]; sourceLines: string[] } & Attribution

export type PlaylistRow = {
  name: string
  type: string | null
  country: string | null
  followers: number | null
  entryDate: string
  exitDate: string | null
  position: number | null
}
export type PlaylistSummary = {
  /** Playlists the song was on the day before launch. */
  onBeforeLaunch: number
  /** Playlists the song was added to from launch on, biggest first. */
  addedSinceLaunch: PlaylistRow[]
  /** Playlists the song is on now (no exit day). */
  current: number
  /** Playlist adds per day, from the start of "before". */
  addsByDay: Day[]
  sourceLines: string[]
}

export type Audience = 'admin' | 'client'
export type ClientDisplay = { soundcharts: boolean }

export type FlowBlock = {
  metric: Metric
  label: string
  sources: Source[]
  sourceLines: string[]
  daily: Day[]
} & FlowSummary
export type LevelBlock = { metric: Metric; label: string; sources: Source[]; sourceLines: string[] } & LevelChange

export type TrackReport = {
  id: string
  title: string
  artist: string | null
  launchDate: string
  releaseDate: string | null
  baselineDays: number
  /** The song came out on or after launch: there is no "before" to compare with. */
  newRelease: boolean
  streams: FlowBlock | null
  /** Streams from Spotify's own recommendations (Spotify for Artists only). */
  algorithmic: FlowBlock | null
  shazams: FlowBlock | null
  listeners: LevelBlock | null
  following: LevelBlock[]
  sound: (SoundUse & { sourceLines: string[] }) | null
  charts: { sinceLaunch: ChartRun[]; beforeLaunch: ChartRun[]; sourceLines: string[] } | null
  /** The campaign's last day once it has closed, else null (soundcharts-more). */
  campaignEnd: string | null
  /** Each number with data, before launch, while clips went out and after, day by day. */
  attribution: AttributionBlock[]
  playlists: PlaylistSummary | null
  /** Staff only. */
  admin?: {
    provider: string | null
    providerTrackId: string | null
    providerTitle: string | null
    providerArtistName: string | null
    matchConfirmedAt: string | null
    baselineStatus: string
    soundRule: string
    tiktokClipId: string | null
    tiktokMusicId: string | null
    soundChecks: Record<string, number>
    health: { metric: string; source: string; lastDate: string; updatedAt: string; rows: number }[]
    runs: {
      runDate: string
      startedAt: string
      status: string
      error: string | null
      requestsUsed: Record<string, number>
      diagnostic: PullDiagnostic | null
    }[]
    manual: {
      id: string
      metric: string
      source: string
      date: string
      periodStart: string | null
      value: number
      country: string | null
      city: string | null
    }[]
  }
}

export type MusicReport = { tracks: TrackReport[] }

const APPROVED = ['approved', 'earning', 'final', 'paid_out']
const PENDING = ['checking', 'needs_review', 'needs_info', 'flagged', 'appealed']

function allowed(source: string, audience: Audience, display: ClientDisplay) {
  if (audience === 'admin') return true
  if (source === 'soundcharts') return display.soundcharts
  return true
}

/** Null when the campaign has no tracked song. */
export async function musicReport(
  db: DbOrTx,
  campaignId: string,
  opts: { audience: Audience; clientDisplay: ClientDisplay },
): Promise<MusicReport | null> {
  const tracks = await db
    .select({ t: musicTracks, artistName: musicArtists.name })
    .from(musicTracks)
    .leftJoin(musicArtists, eq(musicArtists.id, musicTracks.musicArtistId))
    .where(eq(musicTracks.campaignId, campaignId))
    .orderBy(musicTracks.createdAt)
  if (!tracks.length) return null
  const ok = (s: string) => allowed(s, opts.audience, opts.clientDisplay)
  const [camp] = await db
    .select({ status: campaigns.status, endAt: campaigns.endAt })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  const campaignEnd =
    camp && ['closed', 'cancelled'].includes(camp.status) && camp.endAt ? camp.endAt.toISOString().slice(0, 10) : null

  // Sound checks over the campaign's posts the client can see (rejected and removed never count).
  const checks = await db
    .select({ status: submissions.soundCheckStatus, platform: submissions.platform, n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(eq(submissions.campaignId, campaignId), inArray(submissions.state, [...APPROVED, ...PENDING])))
    .groupBy(submissions.soundCheckStatus, submissions.platform)
  const tiktok = checks.filter((c) => c.platform === 'tiktok')
  const matched = tiktok.filter((c) => c.status === 'matched').reduce((a, c) => a + c.n, 0)
  const unchecked = tiktok.filter((c) => c.status === null || c.status === 'not_checked').reduce((a, c) => a + c.n, 0)
  const soundChecks: Record<string, number> = {}
  for (const c of tiktok) soundChecks[c.status ?? 'not_checked'] = (soundChecks[c.status ?? 'not_checked'] ?? 0) + c.n

  const out: TrackReport[] = []
  for (const { t, artistName } of tracks) {
    const where = t.musicArtistId
      ? sql`(${musicMetricSnapshots.musicTrackId} = ${t.id} or ${musicMetricSnapshots.musicArtistId} = ${t.musicArtistId})`
      : eq(musicMetricSnapshots.musicTrackId, t.id)
    const all = await db.select().from(musicMetricSnapshots).where(where)
    const visible = all.filter((r) => ok(r.source))
    // Worldwide numbers only in these blocks; per-country rows are for the country view (not built yet).
    const of = (metric: Metric) =>
      visible.filter((r) => r.metric === metric && r.country === null && r.city === null) as unknown as Row[]
    const flow = (metric: Metric): FlowBlock | null => {
      const rows = of(metric)
      if (!rows.length) return null
      const { daily, sources } = mergeDaily(dailyBySource(rows))
      if (!daily.length) return null
      const s = flowSummary(daily, t.launchDate, t.baselineDays, t.trackingEndDate)
      if (s.since.days === 0 && s.baseline.days === 0) return null
      return { metric, label: METRIC_LABEL[metric], sources, sourceLines: lines(sources), daily, ...s }
    }
    const level = (metric: Metric): LevelBlock | null => {
      const rows = of(metric)
      if (!rows.length) return null
      const { points, sources } = mergeLevels(rows)
      const c = levelChange(points, t.launchDate)
      if (!c.latest) return null
      return { metric, label: METRIC_LABEL[metric], sources, sourceLines: lines(sources), ...c }
    }
    const newRelease = !!t.releaseDate && t.releaseDate >= t.launchDate
    const soundRows = of('tiktok_sound_video_count')
    const soundLevels = mergeLevels(soundRows)
    const sound = soundLevels.points.length
      ? {
          ...soundUse(soundLevels.points, t.launchDate, { matched, unchecked }),
          sourceLines: lines(soundLevels.sources),
        }
      : null
    const chartRows = (await db.select().from(chartEntries).where(eq(chartEntries.musicTrackId, t.id))).filter((r) =>
      ok(r.source),
    )
    const runs = chartRuns(chartRows, t.launchDate)
    const attributionBlocks: AttributionBlock[] = []
    for (const metric of ATTRIBUTION_METRICS) {
      const rows = of(metric)
      if (!rows.length) continue
      const flowKind = isFlowMetric(metric)
      const merged = flowKind ? mergeDaily(dailyBySource(rows)) : null
      const levels = flowKind ? null : mergeLevels(rows)
      const series = merged ? merged.daily : levels!.points
      const sources = merged ? merged.sources : levels!.sources
      const a = attribution(flowKind ? 'flow' : 'level', series, t.launchDate, t.baselineDays, campaignEnd)
      if (!a.series.length) continue
      attributionBlocks.push({ metric, label: METRIC_LABEL[metric], sources, sourceLines: lines(sources), ...a })
    }
    const playlistRows = (
      await db.select().from(musicPlaylistEntries).where(eq(musicPlaylistEntries.musicTrackId, t.id))
    ).filter((r) => ok(r.source))
    let playlists: PlaylistSummary | null = null
    if (playlistRows.length) {
      const dayBefore = addDays(t.launchDate, -1)
      const from = addDays(t.launchDate, -t.baselineDays)
      const adds = new Map<string, number>()
      for (const r of playlistRows) if (r.entryDate >= from) adds.set(r.entryDate, (adds.get(r.entryDate) ?? 0) + 1)
      playlists = {
        onBeforeLaunch: playlistRows.filter((r) => r.entryDate <= dayBefore && (!r.exitDate || r.exitDate > dayBefore))
          .length,
        addedSinceLaunch: playlistRows
          .filter((r) => r.entryDate >= t.launchDate)
          .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0) || a.entryDate.localeCompare(b.entryDate))
          .map((r) => ({
            name: r.name,
            type: r.type,
            country: r.country,
            followers: r.followers,
            entryDate: r.entryDate,
            exitDate: r.exitDate,
            position: r.position,
          })),
        current: playlistRows.filter((r) => !r.exitDate).length,
        addsByDay: [...adds.entries()]
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        sourceLines: lines([...new Set(playlistRows.map((r) => r.source as Source))]),
      }
    }
    const report: TrackReport = {
      id: t.id,
      title: t.title,
      artist: artistName,
      launchDate: t.launchDate,
      releaseDate: t.releaseDate,
      baselineDays: t.baselineDays,
      newRelease,
      streams: flow('spotify_streams'),
      algorithmic: flow('streams_algorithmic'),
      shazams: flow('shazam_count'),
      listeners: level('spotify_monthly_listeners'),
      following: (['spotify_followers', 'tiktok_followers', 'instagram_followers', 'youtube_subscribers'] as Metric[])
        .map(level)
        .filter((b): b is LevelBlock => !!b && b.change !== null),
      sound,
      charts:
        runs.sinceLaunch.length || runs.beforeLaunch.length
          ? { ...runs, sourceLines: lines([...new Set(chartRows.map((r) => r.source as Source))]) }
          : null,
      campaignEnd,
      attribution: attributionBlocks,
      playlists,
    }
    // A new release has no "before": the numbers since launch stay, the comparison goes.
    if (newRelease)
      for (const b of [report.streams, report.algorithmic, report.shazams])
        if (b) {
          b.changePercent = null
          b.extraTotal = null
        }
    if (opts.audience === 'admin') {
      const health = new Map<
        string,
        { metric: string; source: string; lastDate: string; updatedAt: string; rows: number }
      >()
      for (const r of all) {
        const k = `${r.metric}|${r.source}`
        const h = health.get(k)
        if (!h)
          health.set(k, {
            metric: r.metric,
            source: r.source,
            lastDate: r.date,
            updatedAt: r.updatedAt.toISOString(),
            rows: 1,
          })
        else {
          h.rows++
          if (r.date > h.lastDate) h.lastDate = r.date
          if (r.updatedAt.toISOString() > h.updatedAt) h.updatedAt = r.updatedAt.toISOString()
        }
      }
      const jobRuns = await db
        .select()
        .from(musicJobRuns)
        .where(eq(musicJobRuns.musicTrackId, t.id))
        .orderBy(desc(musicJobRuns.startedAt))
        .limit(10)
      report.admin = {
        provider: t.provider,
        providerTrackId: t.providerTrackId,
        providerTitle: t.providerTitle,
        providerArtistName: t.providerArtistName,
        matchConfirmedAt: t.matchConfirmedAt?.toISOString() ?? null,
        baselineStatus: t.baselineStatus,
        soundRule: t.soundRule,
        tiktokClipId: t.tiktokClipId,
        tiktokMusicId: t.tiktokMusicId,
        soundChecks,
        health: [...health.values()].sort((a, b) => a.metric.localeCompare(b.metric)),
        runs: jobRuns.map((r) => ({
          runDate: r.runDate,
          startedAt: r.startedAt.toISOString(),
          status: r.status,
          error: r.error,
          requestsUsed: r.requestsUsed,
          diagnostic: (r.diagnostic as PullDiagnostic | null) ?? null,
        })),
        manual: all
          .filter((r) => r.enteredBy)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((r) => ({
            id: r.id,
            metric: r.metric,
            source: r.source,
            date: r.date,
            periodStart: r.periodStart,
            value: r.value,
            country: r.country,
            city: r.city,
          })),
      }
    }
    out.push(report)
  }
  // The client sees a song only when at least one block has data.
  const tracksOut =
    opts.audience === 'client'
      ? out.filter(
          (t) =>
            t.streams ||
            t.algorithmic ||
            t.shazams ||
            t.listeners ||
            t.following.length ||
            t.sound ||
            t.charts ||
            t.attribution.length ||
            t.playlists,
        )
      : out
  return tracksOut.length ? { tracks: tracksOut } : null
}

const lines = (sources: Source[]) => [...new Set(sources.map((s) => SOURCE_LINE[s] ?? `Source: ${s}`))]

/** Soundcharts requests this calendar month, for the provider status line. */
export async function providerRequestsThisMonth(db: DbOrTx, provider: string, now = new Date()) {
  const month = now.toISOString().slice(0, 7)
  const [r] = await db
    .select({
      n: sql<number>`coalesce(sum((${musicJobRuns.requestsUsed} ->> ${provider})::int), 0)::int`,
    })
    .from(musicJobRuns)
    .where(sql`to_char(${musicJobRuns.runDate}, 'YYYY-MM') = ${month}`)
  return r?.n ?? 0
}

/** Whether a campaign has a tracked song (the Music tab and the report section show only then). */
export async function hasMusicTracking(db: DbOrTx, campaignId: string) {
  const [r] = await db
    .select({ id: musicTracks.id })
    .from(musicTracks)
    .where(eq(musicTracks.campaignId, campaignId))
    .limit(1)
  return !!r
}
