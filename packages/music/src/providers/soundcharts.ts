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
//   { date (date-time), plots: Plot2[] } and Plot2 is { identifier, value }. 403 means the endpoint is
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
// Only the platform code "spotify" is confirmed for the audience endpoint (it is the reference's own
// example). The page lists Shazam, TikTok, Instagram and YouTube as platforms too, but not their codes,
// so those metrics are not pulled until the codes are checked (TODO in the build notes).
import type { ArtistMetric, TrackMetric } from '../metrics'
import {
  MusicProviderRefused,
  type MusicDataProvider,
  type ProviderCall,
  type ResolvedTrack,
  type SeriesPoint,
} from './types'

export const SOUNDCHARTS_API = 'https://customer.api.soundcharts.com'

/** Track metrics and the audience platform code that gives them. Only confirmed codes are listed. */
const AUDIENCE_PLATFORM: Partial<Record<TrackMetric, string>> = { spotify_streams: 'spotify' }

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null)

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
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      const why = res.status === 403 ? ' (not in the plan)' : res.status === 429 ? ' (request quota used up)' : ''
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
    const platform = AUDIENCE_PLATFORM[metric]
    if (!platform) return []
    const byDay = new Map<string, Set<number>>()
    const path = `/api/v2/song/${encodeURIComponent(providerTrackId)}/audience/${platform}`
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
      .map(([date, set]) => ({ date, value: [...set].reduce((a, v) => a + v, 0), isCumulative: true }))
      .sort((a, b) => a.date.localeCompare(b.date))
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

  async getArtistSeries(_id: string, _metric: ArtistMetric): Promise<SeriesPoint[]> {
    // GET /api/v2/artist/{uuid}/streaming/{platform}/listening is described as "Global platform listening
    // audience for a period"; whether that is monthly listeners, and its response fields, are not in the
    // part of the reference that could be read. Not pulled until confirmed (TODO in the build notes).
    return []
  }

  supportedTrackMetrics(): TrackMetric[] {
    return Object.keys(AUDIENCE_PLATFORM) as TrackMetric[]
  }
  supportedArtistMetrics(): ArtistMetric[] {
    return []
  }
}
