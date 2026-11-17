// Soundcharts (build proposal section 2.2, provider research 10b). Written against Soundcharts' own
// reference, opened 2026-11-12. NONE OF THESE CALLS HAS RUN AGAINST THE REAL API: there is no key yet.
// Tests use fixtures built from the schemas in the reference.
//
// - Base URL and auth: https://developers.soundcharts.com/api/getting-started
//   "https://customer.api.soundcharts.com", the same for sandbox and production. The OpenAPI file
//   (https://developers.soundcharts.com/openapi.json, securitySchemes APP_ID and API_KEY) sends the
//   headers x-app-id and x-api-key. The getting-started page also offers an Authorization access token;
//   its format is not described there, so it is not used.
// - Song by ISRC: GET /api/v2.25/song/by-isrc/{isrc}, 200 SongResponse3 { type, object: Song3, errors }.
// - Song by platform id: GET /api/v2.25/song/by-platform/{platform}/{identifier}, example platform
//   "spotify", same response. Song3 has uuid, name, isrc (Isrc: value, countryCode, countryName),
//   creditName, mainArtists and artists (ArtistLight: uuid, slug, name, appUrl, imageUrl).
// - Song audience: GET /api/v2/song/{uuid}/audience/{platform}
//   (https://developers.soundcharts.com/documentation/reference/song/get-audience). Query startDate,
//   endDate (YYYY-MM-DD), offset, limit (max 100), sort asc|desc. 200 SongPlotCollectionResponse
//   { related: SongLight, items: AudiencePlot[], page: OffsetPage, errors }. AudiencePlot is
//   { date (date-time), plots: Plot[] } and Plot is { identifier, value } (named Plot, not Plot2, in the
//   OpenAPI file as read on 18 Nov). 403 means the endpoint is
//   not in the plan, 404 song not found.
// - Spotify "streams" on that endpoint are the cumulative count, refreshed daily for songs over 1,000
//   streams, held per Spotify identifier; the song's total adds up each unique value
//   (https://help.soundcharts.com/en/articles/10125052-how-do-i-get-the-stream-count-for-an-artist).
//
// - Checked again on 15 Nov against the same reference (soundcharts-fix): paths, query names and the
//   response fields above match the OpenAPI file. Added then: 410 on by-platform/by-isrc ("ISRC
//   Blacklisted due to multiple tracks identified from DSP") is read as "not found"; 429 ("your quota is
//   consumed", help article 10125141) is a refusal with its own message; every answer is noted for the pull
//   diagnostic. Not changed: the reference now calls x-app-id / x-api-key "Deprecated" but says "Legacy API
//   keys remain supported for existing applications" (https://developers.soundcharts.com/api/authorization).
//
// soundcharts-more (18 Nov), read again in the OpenAPI file (https://developers.soundcharts.com/openapi.json)
// and the reference pages named below. NONE OF THESE CALLS HAS RUN AGAINST THE REAL API from this branch.
// - Audience platform codes. The audience page lists Shazam (count), Spotify (streams), YouTube (views),
//   YouTube Shorts (shorts count), Instagram (reel count), TikTok (video count) and others, without codes.
//   The codes come from the "Get songs" page (https://developers.soundcharts.com/api/reference/song/get-songs),
//   whose platform/metricType table names SPOTIFY streams, SHAZAM count, YOUTUBE views, TIKTOK videos and
//   INSTAGRAM reels, and from Soundcharts' own Python SDK (github.com/soundcharts/python-sdk, artist.py:
//   "Available values: instagram, youtube, tiktok"). Every code the reference spells in a path is lower case
//   ("spotify", "apple-music", "deezer", "instagram"), so these are asked in lower case. The audience page
//   answers 400 "Invalid platform code" for a wrong one: that is kept as a refusal for that metric only.
//   YouTube Shorts has no code anywhere in the reference, so it is not asked.
// - Audience values: the Spotify value is a running total (help article above). Shazam and YouTube come from
//   the same endpoint ("the value of streams/plays/favorites/views") and are read as running totals too;
//   TikTok and Instagram are counts of videos so far, read as levels. Not confirmed per platform beyond
//   Spotify: the Music tab shows the stored totals so staff can check.
// - Playlist reach: GET /api/v2/song/{uuid}/playlist/reach/{platform}
//   (https://developers.soundcharts.com/api/reference/song/get-playlist-reach), query type (all), startDate,
//   endDate, offset, limit (max 100). 200 PlaylistReachCollectionResponse2 { related, items: Reach[], page,
//   errors }, Reach { date, playlistCount, playlistReach, playlistEditorialCount, playlistEditorialReach,
//   playlistUserCount, playlistUserReach }. "playlist reach is only available for Spotify, Youtube, Deezer,
//   Jiosaavn and Boomplay".
// - Playlist entries: GET /api/v2.20/song/{uuid}/playlist/current/{platform}
//   (https://developers.soundcharts.com/api/reference/song/get-playlist-entries), query type, currentOnly
//   (1 current, 0 current and past), countryCode, offset, limit (max 100), sortBy (entryDate), sortOrder.
//   200 PositionCollectionResponse2 { related, items: Position2[], page, errors }, Position2 { playlist:
//   PlaylistLight2 { uuid, name, identifier, platform, countryCode, latestSubscriberCount, type }, position,
//   peakPosition, entryDate, exitDate, positionDate, peakPositionDate }.
// - Chart entries: GET /api/v2/song/{uuid}/charts/ranks/{platform}
//   (https://developers.soundcharts.com/api/reference/song/get-chart-entries), query currentOnly, offset,
//   limit, sortBy (position, rankDate), sortOrder. 200 RankCollectionResponse3 { related, items: Rank3[],
//   page, errors }, Rank3 { chart: Chart { name, slug, platform, countryCode, countryName, cityName, ... },
//   position, oldPosition, peakPosition, entryDate, rankDate, current, ... }. "rankDate is the last date the
//   song appeared in this chart", "entryDate is the first date", position "0" means no longer in the chart.
//   Only the song chart code "spotify" is confirmed (sandbox dataset page,
//   https://developers.soundcharts.com/documentation/sandbox-data).
// - Spotify monthly listeners: GET /api/v2/artist/{uuid}/streaming/{platform}
//   (https://developers.soundcharts.com/api/reference/artist/get-local-streaming-audience): "Get daily values
//   for Spotify monthly listeners". 200 StreamingPlotCollectionResponse { related, items: StreamingPlot[]
//   { date, value, cityPlots, countryPlots }, page, errors }.
// - Not used: "Get current stats" (GET /api/v2/song/{uuid}/current/stats, CurrentStatsResponse2 { audience:
//   StatPlot[] { platform, value, date, evolution, percentEvolution } }) gives every platform in one call but
//   is marked "restricted to specific plans" and has no history. Song "local streaming audience" is YouTube
//   views by country only ("Get local values for song YouTube views"), so there are no Spotify streams by
//   country for a song.
// - Cost: "1 call = 1 request" and entries endpoints give at most 100 results a call
//   (https://help.soundcharts.com/en/articles/10104246-what-counts-as-one-api-call-on-soundcharts).
import type { ArtistMetric, TrackMetric } from '../metrics'
import {
  MusicProviderRefused,
  type ChartPoint,
  type MusicDataProvider,
  type PlaylistEntry,
  type ProviderCall,
  type ResolvedTrack,
  type SeriesPoint,
} from './types'

export const SOUNDCHARTS_API = 'https://customer.api.soundcharts.com'

/** Track metrics read from the audience endpoint, its platform code, and whether the value is a running total. */
const AUDIENCE_PLATFORM: Partial<Record<TrackMetric, { code: string; cumulative: boolean }>> = {
  spotify_streams: { code: 'spotify', cumulative: true },
  tiktok_song_video_count: { code: 'tiktok', cumulative: false },
  shazam_count: { code: 'shazam', cumulative: true },
  instagram_song_reel_count: { code: 'instagram', cumulative: false },
  youtube_song_views: { code: 'youtube', cumulative: true },
}

/** Track metrics read from one playlist reach answer (Spotify), and the Reach field that gives each. */
const REACH_FIELD: Partial<Record<TrackMetric, string>> = {
  spotify_playlist_count: 'playlistCount',
  spotify_playlist_reach: 'playlistReach',
  spotify_editorial_playlist_count: 'playlistEditorialCount',
  spotify_editorial_playlist_reach: 'playlistEditorialReach',
}

/** Song chart platform codes asked. Only "spotify" is confirmed (sandbox dataset page). */
const CHART_CODES = ['spotify']
/** Soundcharts chart platform codes as the platform names the OS uses. */
const CHART_PLATFORM: Record<string, string> = {
  spotify: 'spotify',
  'apple-music': 'apple_music',
  shazam: 'shazam',
  youtube: 'youtube',
  tiktok: 'tiktok',
}
/** Playlist entries: pages asked on the first pull (history) and on a daily pull (newest entries first). */
const PLAYLIST_PAGES = { history: 5, daily: 1 }

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null)
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : null)
const dayOf = (v: unknown): string | null => {
  const d = str(v)?.slice(0, 10)
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}
const country = (v: unknown): string | null => {
  const c = str(v)?.toUpperCase()
  return c && /^[A-Z]{2}$/.test(c) ? c : null
}

export class SoundchartsProvider implements MusicDataProvider {
  readonly name = 'soundcharts' as const
  requests = 0
  constructor(
    private appId: string,
    private apiKey: string,
    private http: typeof fetch = fetch,
    private base = SOUNDCHARTS_API,
  ) {}

  private calls: ProviderCall[] = []
  /** One playlist reach answer gives four metrics: asked once per song and window. */
  private reach = new Map<string, Promise<Map<string, SeriesPoint[]>>>()

  /** The calls made since the last time this was asked (pull diagnostic, soundcharts-fix 15 Nov). */
  takeCalls(): ProviderCall[] {
    const out = this.calls
    this.calls = []
    return out
  }

  /**
   * null on 404 (song not found) and 410 (ISRC blacklisted). Every answer is noted in `calls`, with its
   * status, its top-level fields and the messages in its root errors array: Soundcharts says "The response
   * always contains an error array at the root level"
   * (https://help.soundcharts.com/en/articles/10125141-what-do-errors-mean-on-soundcharts-api).
   */
  private async get(path: string, params: Record<string, string> = {}): Promise<Json | null> {
    const url = new URL(path, this.base)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    this.requests++
    const res = await this.http(url, { headers: { 'x-app-id': this.appId, 'x-api-key': this.apiKey } })
    const call: ProviderCall = { path: url.pathname + url.search, status: res.status }
    this.calls.push(call)
    const text = await res.text().catch(() => '')
    let body: Json | null = null
    try {
      body = text ? obj(JSON.parse(text)) : null
    } catch {
      body = null
    }
    if (body) {
      call.fields = Object.keys(body).sort()
      const errs = Array.isArray(body.errors) ? body.errors : []
      const msgs = errs
        .map((e) => {
          const o = obj(e)
          return o
            ? [str(o.key), typeof o.code === 'number' ? String(o.code) : null, str(o.message)].filter(Boolean).join(' ')
            : null
        })
        .filter((m): m is string => !!m)
      if (msgs.length) call.errors = msgs.slice(0, 5).map((m) => m.slice(0, 200))
    }
    const short = text.replace(/\s+/g, ' ').slice(0, 200)
    if (res.status === 404 || res.status === 410) return null
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
      const why =
        res.status === 403
          ? ' (not in the plan)'
          : res.status === 429
            ? ' (request quota used up)'
            : res.status === 400
              ? ' (platform code or date not accepted)'
              : ''
      throw new MusicProviderRefused(
        `Soundcharts ${url.pathname} returned ${res.status}${why}${short ? `: ${short}` : ''}`,
        res.status,
      )
    }
    if (!res.ok) throw new Error(`Soundcharts ${url.pathname} returned ${res.status}${short ? `: ${short}` : ''}`)
    return body
  }

  async resolveTrack(input: { isrc?: string | null; spotifyTrackId?: string | null }): Promise<ResolvedTrack | null> {
    let body: Json | null = null
    if (input.isrc) body = await this.get(`/api/v2.25/song/by-isrc/${encodeURIComponent(input.isrc)}`)
    if (!body && input.spotifyTrackId)
      body = await this.get(`/api/v2.25/song/by-platform/spotify/${encodeURIComponent(input.spotifyTrackId)}`)
    const song = obj(body?.object)
    const uuid = str(song?.uuid)
    if (!song || !uuid) return null
    const main = Array.isArray(song.mainArtists) ? obj(song.mainArtists[0]) : null
    const any = Array.isArray(song.artists) ? obj(song.artists[0]) : null
    const artist = main ?? any
    return {
      providerTrackId: uuid,
      title: str(song.name) ?? '',
      artistName: str(song.creditName) ?? str(artist?.name),
      providerArtistId: str(artist?.uuid),
      isrc: str(obj(song.isrc)?.value),
    }
  }

  async getTrackSeries(providerTrackId: string, metric: TrackMetric, from: string, to: string): Promise<SeriesPoint[]> {
    if (REACH_FIELD[metric]) return (await this.reachSeries(providerTrackId, from, to)).get(metric) ?? []
    const platform = AUDIENCE_PLATFORM[metric]
    if (!platform) return []
    const byDay = new Map<string, Set<number>>()
    const path = `/api/v2/song/${encodeURIComponent(providerTrackId)}/audience/${platform.code}`
    // Pages of up to 100 dates, oldest first, until the page says there is no next one.
    for (let offset = 0, guard = 0; guard < 50; guard++) {
      const body = await this.get(path, {
        startDate: from,
        endDate: to,
        offset: String(offset),
        limit: '100',
        sort: 'asc',
      })
      const items = Array.isArray(body?.items) ? (body.items as unknown[]) : []
      const call = this.calls[this.calls.length - 1]
      const ids = new Set<string>()
      let days = 0
      let withNumbers = 0
      let first = null as string | null
      let last = null as string | null
      for (const it of items) {
        const row = obj(it)
        const day = str(row?.date)?.slice(0, 10)
        if (!row || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
        days++
        if (first === null || day < first) first = day
        if (last === null || day > last) last = day
        const set = byDay.get(day) ?? new Set<number>()
        let had = false
        for (const p of Array.isArray(row.plots) ? row.plots : []) {
          const plot = obj(p)
          const id = str(plot?.identifier)
          if (id) ids.add(id)
          const v = plot?.value
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            set.add(Math.floor(v))
            had = true
          }
        }
        if (had) withNumbers++
        byDay.set(day, set)
      }
      const page = obj(body?.page)
      if (call) {
        call.dates = days
        call.datesWithNumbers = withNumbers
        call.firstDate = first
        call.lastDate = last
        call.identifiers = [...ids].slice(0, 10)
        call.total = typeof page?.total === 'number' ? page.total : null
      }
      if (!items.length || !page || page.next === null || page.next === undefined) break
      offset += items.length
    }
    // Each unique value per identifier, added up (Soundcharts help article above).
    return [...byDay.entries()]
      .filter(([, set]) => set.size > 0)
      .map(([date, set]) => ({
        date,
        value: [...set].reduce((a, v) => a + v, 0),
        isCumulative: platform.cumulative,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /** Pages of an entries endpoint, up to `maxPages`, noting dates and totals on each call. */
  private async pages(path: string, params: Record<string, string>, maxPages: number, dateField?: string) {
    const out: Json[] = []
    for (let offset = 0, n = 0; n < maxPages; n++) {
      const body = await this.get(path, { ...params, offset: String(offset), limit: '100' })
      const items = (Array.isArray(body?.items) ? (body.items as unknown[]) : []).map(obj).filter((x): x is Json => !!x)
      const call = this.calls[this.calls.length - 1]
      const page = obj(body?.page)
      if (call) {
        call.total = typeof page?.total === 'number' ? page.total : null
        if (dateField) {
          const days = items
            .map((it) => dayOf(it[dateField]))
            .filter((d): d is string => !!d)
            .sort()
          call.dates = items.length
          call.datesWithNumbers = days.length
          call.firstDate = days[0] ?? null
          call.lastDate = days[days.length - 1] ?? null
        }
      }
      out.push(...items)
      if (!items.length || !page || page.next === null || page.next === undefined) break
      offset += items.length
    }
    return out
  }

  /** Spotify playlist count and reach per day, all and editorial (one answer, four metrics). */
  private reachSeries(providerTrackId: string, from: string, to: string) {
    const key = `${providerTrackId}|${from}|${to}`
    let p = this.reach.get(key)
    if (!p) {
      p = (async () => {
        const items = await this.pages(
          `/api/v2/song/${encodeURIComponent(providerTrackId)}/playlist/reach/spotify`,
          { type: 'all', startDate: from, endDate: to },
          10,
          'date',
        )
        const out = new Map<string, SeriesPoint[]>()
        for (const [metric, field] of Object.entries(REACH_FIELD)) {
          const byDay = new Map<string, number>()
          for (const it of items) {
            const day = dayOf(it.date)
            const v = int(it[field!])
            if (day && v !== null && v >= 0) byDay.set(day, v)
          }
          out.set(
            metric,
            [...byDay.entries()]
              .map(([date, value]) => ({ date, value, isCumulative: false }))
              .sort((a, b) => a.date.localeCompare(b.date)),
          )
        }
        return out
      })()
      // A refused answer is not kept, so the next metric does not repeat the same error.
      p.catch(() => this.reach.delete(key))
      this.reach.set(key, p)
    }
    return p
  }

  async getPlaylistEntries(providerTrackId: string, history: boolean): Promise<PlaylistEntry[]> {
    const items = await this.pages(
      `/api/v2.20/song/${encodeURIComponent(providerTrackId)}/playlist/current/spotify`,
      { type: 'all', currentOnly: history ? '0' : '1', sortBy: 'entryDate', sortOrder: 'desc' },
      history ? PLAYLIST_PAGES.history : PLAYLIST_PAGES.daily,
      'entryDate',
    )
    const out: PlaylistEntry[] = []
    for (const it of items) {
      const pl = obj(it.playlist)
      const playlistId = str(pl?.uuid) ?? str(pl?.identifier)
      const entryDate = dayOf(it.entryDate)
      if (!pl || !playlistId || !entryDate) continue
      out.push({
        platform: str(pl.platform) ?? 'spotify',
        playlistId,
        playlistIdentifier: str(pl.identifier),
        name: str(pl.name) ?? '',
        type: str(pl.type),
        country: country(pl.countryCode),
        followers: int(pl.latestSubscriberCount),
        entryDate,
        exitDate: dayOf(it.exitDate),
        position: int(it.position),
        peakPosition: int(it.peakPosition),
        positionDate: dayOf(it.positionDate),
      })
    }
    return out
  }

  async getChartEntries(providerTrackId: string, history: boolean): Promise<ChartPoint[]> {
    const out: ChartPoint[] = []
    for (const code of CHART_CODES) {
      const items = await this.pages(
        `/api/v2/song/${encodeURIComponent(providerTrackId)}/charts/ranks/${code}`,
        { currentOnly: history ? '0' : '1', sortBy: 'position', sortOrder: 'asc' },
        history ? 3 : 1,
        'rankDate',
      )
      for (const it of items) {
        const chart = obj(it.chart)
        const date = dayOf(it.rankDate)
        const position = int(it.position)
        const name = str(chart?.name)
        // Position 0: "the song is no longer in the chart".
        if (!chart || !date || !name || position === null || position < 1) continue
        out.push({
          date,
          entryDate: dayOf(it.entryDate),
          chartPlatform: CHART_PLATFORM[str(chart.platform) ?? code] ?? 'other',
          chartName: name,
          country: country(chart.countryCode),
          city: str(chart.cityName),
          position,
          previousPosition: int(it.oldPosition),
        })
      }
    }
    return out
  }

  /**
   * Which Spotify ids Soundcharts holds for the song: GET /api/v2/song/{uuid}/identifiers?platform=spotify
   * (https://developers.soundcharts.com/documentation/reference/song/get-ids, SongIdentifier
   * { platformCode, identifier, song }). The audience page says a missing metric can mean "We may not have
   * the song platform ID!". One request, only after a pull that gave no numbers. Never throws.
   */
  async explainEmpty(providerTrackId: string): Promise<void> {
    try {
      const body = await this.get(`/api/v2/song/${encodeURIComponent(providerTrackId)}/identifiers`, {
        platform: 'spotify',
        offset: '0',
        limit: '100',
      })
      const call = this.calls[this.calls.length - 1]
      const items = Array.isArray(body?.items) ? (body.items as unknown[]) : []
      if (call)
        call.identifiers = items
          .map((it) => str(obj(it)?.identifier))
          .filter((x): x is string => !!x)
          .slice(0, 10)
    } catch {
      // A diagnostic must never stop the pull; the call and its status are already noted.
    }
  }

  async getArtistSeries(
    providerArtistId: string,
    metric: ArtistMetric,
    from: string,
    to: string,
  ): Promise<SeriesPoint[]> {
    if (metric !== 'spotify_monthly_listeners') return []
    const items = await this.pages(
      `/api/v2/artist/${encodeURIComponent(providerArtistId)}/streaming/spotify`,
      { startDate: from, endDate: to, sort: 'asc' },
      10,
      'date',
    )
    const byDay = new Map<string, number>()
    for (const it of items) {
      const day = dayOf(it.date)
      const v = int(it.value)
      if (day && v !== null && v >= 0) byDay.set(day, v)
    }
    return [...byDay.entries()]
      .map(([date, value]) => ({ date, value, isCumulative: false }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  supportedTrackMetrics(): TrackMetric[] {
    return [...Object.keys(AUDIENCE_PLATFORM), ...Object.keys(REACH_FIELD)] as TrackMetric[]
  }
  supportedArtistMetrics(): ArtistMetric[] {
    return ['spotify_monthly_listeners']
  }
}
