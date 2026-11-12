// The music figures of a campaign, for the staff Music tab and the client report (build proposal
// sections 7.2, 8 and 9). The same calculations feed both; the client gets only the sources it may see,
// never spend or cost figures, and only blocks that have data.
import { tables, type DbOrTx } from '@mde/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  chartRuns,
  dailyBySource,
  flowSummary,
  levelChange,
  mergeDaily,
  mergeLevels,
  soundUse,
  type ChartRun,
  type Day,
  type FlowSummary,
  type LevelChange,
  type Row,
  type SoundUse,
} from './calculations'
import { METRIC_LABEL, SOURCE_LINE, type Metric, type Source } from './metrics'

const { musicTracks, musicArtists, musicMetricSnapshots, chartEntries, submissions, musicJobRuns } = tables

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
    runs: { runDate: string; status: string; error: string | null; requestsUsed: Record<string, number> }[]
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
          status: r.status,
          error: r.error,
          requestsUsed: r.requestsUsed,
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
          (t) => t.streams || t.algorithmic || t.shazams || t.listeners || t.following.length || t.sound || t.charts,
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
