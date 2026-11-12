// Staff set up a campaign's song (build proposal 7.1), check the provider's match, and type in numbers
// from Spotify for Artists and Apple Music for Artists (7.4). Every change is written to the audit log.
import { tables, writeAudit, type Db } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import {
  parseCountries,
  parseInstagramAudioId,
  parseIsrc,
  parseSpotifyArtistId,
  parseSpotifyTrackId,
  parseTikTokClipId,
  parseYouTubeVideoId,
} from './links'
import { CHART_PLATFORMS, MANUAL_METRICS, isArtistMetric, isFlowMetric, type Source } from './metrics'
import type { MusicDataProvider } from './providers'

const { musicArtists, musicTracks, musicMetricSnapshots, chartEntries } = tables

export type SetupResult = { ok: true; trackId: string } | { ok: false; errors: Record<string, string> }

export type SetupInput = {
  trackId?: string | null
  artistName: string
  spotifyArtistUrl?: string
  tiktokHandle?: string
  instagramHandle?: string
  youtubeChannelId?: string
  s4aAccessStatus?: string
  amfaAccessStatus?: string
  title: string
  spotifyTrackUrl: string
  isrc?: string
  tiktokSoundUrl?: string
  instagramAudioUrl?: string
  youtubeVideoUrl?: string
  releaseDate?: string
  launchDate: string
  targetCountries?: string
  baselineDays?: string
  soundRule?: string
}

const ACCESS = ['not_requested', 'requested', 'granted', 'declined']
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
const opt = (v: string | undefined) => (v && v.trim() ? v.trim() : null)

/** Saves the artist and one song. Links are read into ids; any link that cannot be read is an error. */
export async function saveMusicSetup(
  db: Db,
  actorId: string,
  campaignId: string,
  input: SetupInput,
): Promise<SetupResult> {
  const errors: Record<string, string> = {}
  if (!input.artistName.trim()) errors.artistName = 'Enter the artist name.'
  if (!input.title.trim()) errors.title = 'Enter the song title.'
  const spotifyTrackId = parseSpotifyTrackId(input.spotifyTrackUrl)
  if (!spotifyTrackId) errors.spotifyTrackUrl = 'Paste the song link from Spotify (open.spotify.com/track/...).'
  const spotifyArtistId = opt(input.spotifyArtistUrl) ? parseSpotifyArtistId(input.spotifyArtistUrl!) : null
  if (opt(input.spotifyArtistUrl) && !spotifyArtistId)
    errors.spotifyArtistUrl = 'Paste the artist link from Spotify (open.spotify.com/artist/...).'
  const isrc = opt(input.isrc) ? parseIsrc(input.isrc!) : null
  if (opt(input.isrc) && !isrc) errors.isrc = 'An ISRC has 12 characters, for example GBUM71029604.'
  const tiktokClipId = opt(input.tiktokSoundUrl) ? parseTikTokClipId(input.tiktokSoundUrl!) : null
  if (opt(input.tiktokSoundUrl) && !tiktokClipId)
    errors.tiktokSoundUrl = 'Paste the sound link from TikTok (tiktok.com/music/...).'
  const instagramAudioId = opt(input.instagramAudioUrl) ? parseInstagramAudioId(input.instagramAudioUrl!) : null
  if (opt(input.instagramAudioUrl) && !instagramAudioId)
    errors.instagramAudioUrl = 'Paste the audio link from Instagram (instagram.com/reels/audio/...).'
  const youtubeVideoId = opt(input.youtubeVideoUrl) ? parseYouTubeVideoId(input.youtubeVideoUrl!) : null
  if (opt(input.youtubeVideoUrl) && !youtubeVideoId) errors.youtubeVideoUrl = 'Paste the link of the video on YouTube.'
  if (!isDay(input.launchDate)) errors.launchDate = 'Pick the day clips started going out.'
  const releaseDate = opt(input.releaseDate)
  if (releaseDate && !isDay(releaseDate)) errors.releaseDate = 'Pick a date.'
  const countries = opt(input.targetCountries) ? parseCountries(input.targetCountries!) : []
  if (countries === null) errors.targetCountries = 'Use two letter country codes, for example FR, NG, ZA.'
  const baselineDays = opt(input.baselineDays) ? Number(input.baselineDays) : 28
  if (!Number.isInteger(baselineDays) || baselineDays < 7 || baselineDays > 120)
    errors.baselineDays = 'Between 7 and 120 days.'
  const soundRule = input.soundRule === 'reject' ? 'reject' : 'warn'
  const s4a = ACCESS.includes(input.s4aAccessStatus ?? '') ? input.s4aAccessStatus! : 'not_requested'
  const amfa = ACCESS.includes(input.amfaAccessStatus ?? '') ? input.amfaAccessStatus! : 'not_requested'
  if (Object.keys(errors).length) return { ok: false, errors }

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(musicArtists).where(eq(musicArtists.campaignId, campaignId))
    const artistValues = {
      name: input.artistName.trim(),
      spotifyArtistId,
      tiktokHandle: opt(input.tiktokHandle)?.replace(/^@+/, '') ?? null,
      instagramHandle: opt(input.instagramHandle)?.replace(/^@+/, '') ?? null,
      youtubeChannelId: opt(input.youtubeChannelId),
      s4aAccessStatus: s4a,
      amfaAccessStatus: amfa,
    }
    const [artist] = existing
      ? await tx.update(musicArtists).set(artistValues).where(eq(musicArtists.id, existing.id)).returning()
      : await tx
          .insert(musicArtists)
          .values({ campaignId, ...artistValues })
          .returning()
    const [before] = input.trackId
      ? await tx
          .select()
          .from(musicTracks)
          .where(and(eq(musicTracks.id, input.trackId), eq(musicTracks.campaignId, campaignId)))
      : []
    if (input.trackId && !before) throw new Error('No such song on this campaign')
    const trackValues = {
      musicArtistId: artist!.id,
      title: input.title.trim(),
      isrc,
      spotifyTrackId,
      tiktokSoundUrl: opt(input.tiktokSoundUrl),
      tiktokClipId,
      instagramAudioUrl: opt(input.instagramAudioUrl),
      instagramAudioId,
      youtubeVideoId,
      releaseDate,
      launchDate: input.launchDate,
      targetCountries: countries,
      baselineDays,
      soundRule,
    }
    // A new song link, ISRC or sound means the old match and its id from the sound page no longer hold.
    const relink =
      before && (before.spotifyTrackId !== spotifyTrackId || before.isrc !== isrc)
        ? {
            provider: null,
            providerTrackId: null,
            providerTitle: null,
            providerArtistName: null,
            matchConfirmedAt: null,
            matchConfirmedBy: null,
            baselineStatus: 'pending',
          }
        : {}
    const soundChanged = before && before.tiktokClipId !== tiktokClipId ? { tiktokMusicId: null } : {}
    const relaunch = before && before.launchDate !== input.launchDate ? { baselineStatus: 'pending' } : {}
    const [track] = before
      ? await tx
          .update(musicTracks)
          .set({ ...trackValues, ...relink, ...soundChanged, ...relaunch })
          .where(eq(musicTracks.id, before.id))
          .returning()
      : await tx
          .insert(musicTracks)
          .values({ campaignId, ...trackValues })
          .returning()
    await writeAudit(tx, {
      actorId,
      action: before ? 'music.track_updated' : 'music.track_added',
      entity: 'music_track',
      entityId: track!.id,
      before: before ?? null,
      after: { artist: artistValues, track: trackValues },
    })
    return { ok: true as const, trackId: track!.id }
  })
}

/** Asks the provider which song the ISRC or Spotify link is. Staff confirm before any history is pulled. */
export async function matchTrack(
  db: Db,
  actorId: string,
  trackId: string,
  provider: MusicDataProvider,
): Promise<{ ok: true; title: string; artist: string | null } | { ok: false; message: string }> {
  const [t] = await db.select().from(musicTracks).where(eq(musicTracks.id, trackId))
  if (!t) return { ok: false, message: 'No such song.' }
  if (provider.name === 'none') return { ok: false, message: 'No music data provider is switched on.' }
  const found = await provider.resolveTrack({ isrc: t.isrc, spotifyTrackId: t.spotifyTrackId })
  if (!found)
    return { ok: false, message: 'The provider does not know this song yet. Check the ISRC and Spotify link.' }
  await db.transaction(async (tx) => {
    await tx
      .update(musicTracks)
      .set({
        provider: provider.name,
        providerTrackId: found.providerTrackId,
        providerTitle: found.title,
        providerArtistName: found.artistName,
        matchConfirmedAt: null,
        matchConfirmedBy: null,
        isrc: t.isrc ?? found.isrc,
      })
      .where(eq(musicTracks.id, trackId))
    if (t.musicArtistId && found.providerArtistId)
      await tx
        .update(musicArtists)
        .set({ provider: provider.name, providerArtistId: found.providerArtistId })
        .where(eq(musicArtists.id, t.musicArtistId))
    await writeAudit(tx, {
      actorId,
      action: 'music.track_matched',
      entity: 'music_track',
      entityId: trackId,
      after: found,
    })
  })
  return { ok: true, title: found.title, artist: found.artistName }
}

/** Staff say the provider's match is the right song. History is pulled on the next music pull. */
export async function confirmTrackMatch(db: Db, actorId: string, trackId: string) {
  await db.transaction(async (tx) => {
    const [t] = await tx
      .update(musicTracks)
      .set({ matchConfirmedAt: new Date(), matchConfirmedBy: actorId, baselineStatus: 'pending' })
      .where(eq(musicTracks.id, trackId))
      .returning()
    if (!t?.providerTrackId) throw new Error('Nothing to confirm')
    await writeAudit(tx, {
      actorId,
      action: 'music.track_match_confirmed',
      entity: 'music_track',
      entityId: trackId,
      after: { provider: t.provider, providerTrackId: t.providerTrackId, title: t.providerTitle },
    })
  })
}

export type ManualInput = {
  trackId: string
  source: string
  metric: string
  /** The day, or the first day of a week or month the number covers. */
  periodStart: string
  /** Empty for one day. */
  periodEnd?: string
  value: string
  country?: string
  city?: string
  note?: string
}

/** One number typed in from Spotify for Artists, Apple Music for Artists or another place staff can see. */
export async function addManualMetric(
  db: Db,
  actorId: string,
  input: ManualInput,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const errors: Record<string, string> = {}
  const group = MANUAL_METRICS.find((g) => g.source === input.source)
  if (!group || !group.metrics.includes(input.metric as never)) errors.metric = 'Pick what the number is.'
  if (!isDay(input.periodStart)) errors.periodStart = 'Pick the day.'
  const end = opt(input.periodEnd)
  if (end && (!isDay(end) || end < input.periodStart)) errors.periodEnd = 'The last day is on or after the first.'
  const value = Number(String(input.value).replace(/[\s,]/g, ''))
  if (!Number.isSafeInteger(value) || value < 0) errors.value = 'Enter a whole number.'
  const country = opt(input.country)?.toUpperCase() ?? null
  if (country && !/^[A-Z]{2}$/.test(country)) errors.country = 'A two letter country code, or empty for worldwide.'
  if (Object.keys(errors).length) return { ok: false, errors }
  const [t] = await db.select().from(musicTracks).where(eq(musicTracks.id, input.trackId))
  if (!t) return { ok: false, errors: { metric: 'No such song.' } }
  const artistLevel = isArtistMetric(input.metric)
  if (artistLevel && !t.musicArtistId) return { ok: false, errors: { metric: 'Save the artist first.' } }
  // A level (followers, listeners) is the number on its day; a count over several days keeps its period.
  const flow = isFlowMetric(input.metric)
  const row = {
    musicTrackId: artistLevel ? null : t.id,
    musicArtistId: artistLevel ? t.musicArtistId : null,
    date: flow && end ? end : (end ?? input.periodStart),
    periodStart: flow && end ? input.periodStart : null,
    periodEnd: flow && end ? end : null,
    source: input.source as Source,
    metric: input.metric,
    value,
    isCumulative: false,
    country,
    city: opt(input.city),
    enteredBy: actorId,
    note: opt(input.note),
  }
  await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(musicMetricSnapshots)
      .values(row)
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
        set: {
          value: row.value,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          enteredBy: actorId,
          note: row.note,
        },
      })
      .returning()
    await writeAudit(tx, {
      actorId,
      action: 'music.metric_entered',
      entity: 'music_metric_snapshot',
      entityId: saved!.id,
      after: row,
    })
  })
  return { ok: true }
}

/** Removes a typed-in number (only typed-in ones can be removed). */
export async function deleteManualMetric(db: Db, actorId: string, id: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(musicMetricSnapshots).where(eq(musicMetricSnapshots.id, id))
    if (!row || !row.enteredBy) throw new Error('Only typed-in numbers can be removed')
    await tx.delete(musicMetricSnapshots).where(eq(musicMetricSnapshots.id, id))
    await writeAudit(tx, {
      actorId,
      action: 'music.metric_removed',
      entity: 'music_metric_snapshot',
      entityId: id,
      before: row,
    })
  })
}

export type ChartInput = {
  trackId: string
  date: string
  chartPlatform: string
  chartName: string
  country?: string
  city?: string
  position: string
}

/** A chart place staff saw (Apple Music for Artists, Spotify charts, Shazam charts). */
export async function addChartEntry(
  db: Db,
  actorId: string,
  input: ChartInput,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const errors: Record<string, string> = {}
  if (!isDay(input.date)) errors.date = 'Pick the day.'
  if (!(CHART_PLATFORMS as readonly string[]).includes(input.chartPlatform)) errors.chartPlatform = 'Pick the platform.'
  if (!input.chartName.trim()) errors.chartName = 'Name the chart, for example Top 50.'
  const position = Number(input.position)
  if (!Number.isInteger(position) || position < 1 || position > 1000) errors.position = 'A place from 1.'
  const country = opt(input.country)?.toUpperCase() ?? null
  if (country && !/^[A-Z]{2}$/.test(country)) errors.country = 'A two letter country code, or empty.'
  if (Object.keys(errors).length) return { ok: false, errors }
  const row = {
    musicTrackId: input.trackId,
    date: input.date,
    chartPlatform: input.chartPlatform,
    chartName: input.chartName.trim(),
    country,
    city: opt(input.city),
    position,
    source: 'manual',
    enteredBy: actorId,
  }
  await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(chartEntries)
      .values(row)
      .onConflictDoUpdate({
        target: [
          chartEntries.musicTrackId,
          chartEntries.date,
          chartEntries.chartPlatform,
          chartEntries.chartName,
          chartEntries.country,
          chartEntries.city,
        ],
        set: { position, enteredBy: actorId },
      })
      .returning()
    await writeAudit(tx, {
      actorId,
      action: 'music.chart_entered',
      entity: 'chart_entry',
      entityId: saved!.id,
      after: row,
    })
  })
  return { ok: true }
}
