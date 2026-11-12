import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  baseline,
  buildMusicProvider,
  chartRuns,
  dailyBySource,
  dailyFromCumulative,
  fetchTikTokSoundTotal,
  flowSummary,
  levelChange,
  mergeDaily,
  MusicProviderRefused,
  NoMusicProvider,
  parseCountries,
  parseInstagramAudioId,
  parseIsrc,
  parseSpotifyTrackId,
  parseTikTokClipId,
  parseYouTubeVideoId,
  soundCheckStatus,
  SoundchartsProvider,
  soundUse,
  addDays,
  type Day,
} from '../src'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } })

describe('links', () => {
  it('reads Spotify track links with and without ?si=', () => {
    expect(parseSpotifyTrackId('https://open.spotify.com/track/0bYg9bo50gSsH3LtXe2SQn')).toBe('0bYg9bo50gSsH3LtXe2SQn')
    expect(parseSpotifyTrackId('https://open.spotify.com/intl-fr/track/0bYg9bo50gSsH3LtXe2SQn?si=abc123')).toBe(
      '0bYg9bo50gSsH3LtXe2SQn',
    )
    expect(parseSpotifyTrackId('spotify:track:0bYg9bo50gSsH3LtXe2SQn')).toBe('0bYg9bo50gSsH3LtXe2SQn')
    expect(parseSpotifyTrackId('https://open.spotify.com/album/0bYg9bo50gSsH3LtXe2SQn')).toBeNull()
    expect(parseSpotifyTrackId('not a link')).toBeNull()
  })
  it('reads the clip id at the end of a TikTok sound link', () => {
    expect(parseTikTokClipId('https://www.tiktok.com/music/Different-Acoustic-7439295283975702544')).toBe(
      '7439295283975702544',
    )
    expect(parseTikTokClipId('https://www.tiktok.com/music/original-sound-7439295283975702544?lang=en')).toBe(
      '7439295283975702544',
    )
    expect(parseTikTokClipId('https://www.tiktok.com/@someone/video/7439295283975702544')).toBeNull()
  })
  it('reads Instagram audio, YouTube, ISRC and countries', () => {
    expect(parseInstagramAudioId('https://www.instagram.com/reels/audio/1234567890123/')).toBe('1234567890123')
    expect(parseInstagramAudioId('https://www.instagram.com/p/ABCDEF/')).toBeNull()
    expect(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ')
    expect(parseIsrc('gb-um7-10-29604')).toBe('GBUM71029604')
    expect(parseIsrc('GBUM7102960')).toBeNull()
    expect(parseCountries('fr, NG za')).toEqual(['FR', 'NG', 'ZA'])
    expect(parseCountries('France')).toBeNull()
  })
})

const series = (start: string, values: (number | null)[]): Day[] =>
  values.flatMap((v, i) => (v === null ? [] : [{ date: addDays(start, i), value: v }]))

describe('calculations', () => {
  it('turns running totals into days and leaves a missing day as a gap', () => {
    const { daily, drops } = dailyFromCumulative(series('2026-10-01', [100, 150, null, 260, 250]))
    expect(daily).toEqual([
      { date: '2026-10-02', value: 50 },
      { date: '2026-10-05', value: -10 },
    ])
    expect(drops).toEqual(['2026-10-05'])
  })

  it('sets the baseline from the days before launch', () => {
    const launch = '2026-10-29'
    const full = series('2026-10-01', Array(28).fill(1000))
    expect(baseline(full, launch, 28)).toMatchObject({ status: 'ready', days: 28, average: 1000 })
    expect(baseline(series('2026-10-22', Array(7).fill(10)), launch, 28)).toMatchObject({ status: 'ready', days: 7 })
    expect(baseline(series('2026-10-26', [1, 2, 3]), launch, 28)).toMatchObject({ status: 'short', days: 3 })
    expect(baseline([], launch, 28)).toMatchObject({ status: 'unavailable', average: null })
  })

  it('compares since launch with before, negatives allowed', () => {
    const launch = '2026-10-29'
    const up = flowSummary([...series('2026-10-01', Array(28).fill(1000)), ...series(launch, [1500, 1500])], launch, 28)
    expect(up.changePercent).toBe(50)
    expect(up.extraTotal).toBe(1000)
    const down = flowSummary([...series('2026-10-01', Array(28).fill(1000)), ...series(launch, [800])], launch, 28)
    expect(down.changePercent).toBe(-20)
    expect(down.extraTotal).toBe(-200)
    // Not enough days before launch: no comparison.
    const short = flowSummary([...series('2026-10-26', [1, 2, 3]), ...series(launch, [10])], launch, 28)
    expect(short.changePercent).toBeNull()
    expect(short.since.total).toBe(10)
  })

  it('lets a typed-in Spotify for Artists number win over the provider for the same day', () => {
    const rows = [
      { date: '2026-10-01', value: 100, isCumulative: true, source: 'soundcharts' as const },
      { date: '2026-10-02', value: 160, isCumulative: true, source: 'soundcharts' as const },
      { date: '2026-10-03', value: 230, isCumulative: true, source: 'soundcharts' as const },
      { date: '2026-10-02', value: 55, isCumulative: false, source: 'spotify_for_artists_manual' as const },
    ]
    const { daily, sources } = mergeDaily(dailyBySource(rows))
    expect(daily).toEqual([
      { date: '2026-10-02', value: 55 },
      { date: '2026-10-03', value: 70 },
    ])
    expect(sources.sort()).toEqual(['soundcharts', 'spotify_for_artists_manual'])
  })

  it('spreads a week typed in as one row over its days', () => {
    const rows = [
      {
        date: '2026-10-07',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-07',
        value: 700,
        isCumulative: false,
        source: 'spotify_for_artists_manual' as const,
      },
    ]
    const days = dailyBySource(rows).get('spotify_for_artists_manual')!
    expect(days).toHaveLength(7)
    expect(days.every((d) => d.value === 100)).toBe(true)
  })

  it('counts sound use since launch and floors videos outside the campaign at zero', () => {
    const pts = series('2026-10-27', [100, null, 130, 180])
    const u = soundUse(pts, '2026-10-28', { matched: 20, unchecked: 0 })
    expect(u.atLaunch).toEqual({ date: '2026-10-27', value: 100 })
    expect(u.newSinceLaunch).toBe(80)
    expect(u.outsideCampaign).toBe(60)
    expect(u.outsideIsEstimate).toBe(false)
    expect(soundUse(pts, '2026-10-28', { matched: 500, unchecked: 3 })).toMatchObject({
      outsideCampaign: 0,
      outsideIsEstimate: true,
    })
    // Counting started after launch: no "new since launch".
    expect(
      soundUse(series('2026-11-01', [10, 20]), '2026-10-28', { matched: 0, unchecked: 0 }).newSinceLaunch,
    ).toBeNull()
  })

  it('takes the last level before launch against the latest', () => {
    expect(levelChange(series('2026-10-26', [10, 12, 15, 20]), '2026-10-28')).toMatchObject({
      before: { date: '2026-10-27', value: 12 },
      latest: { date: '2026-10-29', value: 20 },
      change: 8,
    })
    expect(levelChange(series('2026-10-29', [5]), '2026-10-28').change).toBeNull()
  })

  it('keeps charts held before launch apart from new ones', () => {
    const base = { chartPlatform: 'shazam', city: null, source: 'manual' }
    const r = chartRuns(
      [
        { ...base, date: '2026-10-20', chartName: 'Top 200', country: 'NG', position: 80 },
        { ...base, date: '2026-11-02', chartName: 'Top 200', country: 'NG', position: 30 },
        { ...base, date: '2026-11-03', chartName: 'Top 50', country: 'FR', position: 40 },
        { ...base, date: '2026-11-05', chartName: 'Top 50', country: 'FR', position: 12 },
      ],
      '2026-10-28',
    )
    expect(r.beforeLaunch).toEqual([expect.objectContaining({ chartName: 'Top 200', bestPosition: 30 })])
    expect(r.sinceLaunch).toEqual([
      expect.objectContaining({ chartName: 'Top 50', bestPosition: 12, firstDate: '2026-11-03' }),
    ])
  })
})

describe('sound check', () => {
  const official = { tiktokClipId: '7439295283975702544', tiktokMusicId: '6717159721276540930' }
  it('labels each case', () => {
    expect(soundCheckStatus({ id: '7439295283975702544', title: null, isOriginal: false }, official)).toBe('matched')
    expect(soundCheckStatus({ id: '6717159721276540930', title: null, isOriginal: false }, official)).toBe('matched')
    expect(soundCheckStatus({ id: '1', title: 'original sound', isOriginal: true }, official)).toBe('original_sound')
    expect(soundCheckStatus({ id: '2', title: 'Other song', isOriginal: false }, official)).toBe('different_sound')
    expect(soundCheckStatus(null, official)).toBe('not_checked')
    expect(
      soundCheckStatus({ id: '2', title: null, isOriginal: null }, { tiktokClipId: null, tiktokMusicId: null }),
    ).toBe('not_checked')
  })
})

describe('providers', () => {
  it('builds none without a key, whatever MUSIC_DATA_PROVIDER says', () => {
    expect(buildMusicProvider({ MUSIC_DATA_PROVIDER: 'soundcharts' })).toBeInstanceOf(NoMusicProvider)
    expect(
      buildMusicProvider({ MUSIC_DATA_PROVIDER: 'none', SOUNDCHARTS_APP_ID: 'a', SOUNDCHARTS_API_KEY: 'b' }),
    ).toBeInstanceOf(NoMusicProvider)
    expect(
      buildMusicProvider({ MUSIC_DATA_PROVIDER: 'soundcharts', SOUNDCHARTS_APP_ID: 'a', SOUNDCHARTS_API_KEY: 'b' }),
    ).toBeInstanceOf(SoundchartsProvider)
  })

  it('Soundcharts: looks a song up by ISRC with both headers', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = []
    const http = (async (u: URL, init: RequestInit) => {
      calls.push({ url: String(u), headers: init.headers as Record<string, string> })
      return json(fixture('soundcharts-song-by-isrc.json'))
    }) as unknown as typeof fetch
    const p = new SoundchartsProvider('app', 'key', http, 'https://sc.test')
    const t = await p.resolveTrack({ isrc: 'USSM19400325', spotifyTrackId: null })
    expect(t).toEqual({
      providerTrackId: '11e82612-052b-f4f4-a20c-a0369fe50396',
      title: 'Test Song',
      artistName: 'Test Artist',
      providerArtistId: 'aaaaaaaa-0000-0000-0000-000000000001',
      isrc: 'USSM19400325',
    })
    expect(calls[0]!.url).toBe('https://sc.test/api/v2.25/song/by-isrc/USSM19400325')
    expect(calls[0]!.headers).toEqual({ 'x-app-id': 'app', 'x-api-key': 'key' })
    expect(p.requests).toBe(1)
  })

  it('Soundcharts: falls back to the Spotify id when the ISRC is unknown', async () => {
    const urls: string[] = []
    const http = (async (u: URL) => {
      urls.push(String(u))
      return urls.length === 1 ? json('{}', 404) : json(fixture('soundcharts-song-by-isrc.json'))
    }) as unknown as typeof fetch
    const p = new SoundchartsProvider('app', 'key', http, 'https://sc.test')
    expect((await p.resolveTrack({ isrc: 'USSM19400325', spotifyTrackId: '0bYg9bo50gSsH3LtXe2SQn' }))?.title).toBe(
      'Test Song',
    )
    expect(urls[1]).toBe('https://sc.test/api/v2.25/song/by-platform/spotify/0bYg9bo50gSsH3LtXe2SQn')
  })

  it('Soundcharts: reads Spotify streams as running totals, adding each unique value per day', async () => {
    let asked = ''
    const http = (async (u: URL) => {
      asked = String(u)
      return json(fixture('soundcharts-audience-spotify.json'))
    }) as unknown as typeof fetch
    const p = new SoundchartsProvider('app', 'key', http, 'https://sc.test')
    const s = await p.getTrackSeries(
      '11e82612-052b-f4f4-a20c-a0369fe50396',
      'spotify_streams',
      '2026-10-01',
      '2026-10-03',
    )
    expect(s).toEqual([
      { date: '2026-10-01', value: 100000, isCumulative: true },
      { date: '2026-10-02', value: 101000, isCumulative: true },
      { date: '2026-10-03', value: 103000, isCumulative: true },
    ])
    const u = new URL(asked)
    expect(u.pathname).toBe('/api/v2/song/11e82612-052b-f4f4-a20c-a0369fe50396/audience/spotify')
    expect(Object.fromEntries(u.searchParams)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      offset: '0',
      limit: '100',
      sort: 'asc',
    })
    // Metrics whose platform code is not confirmed are not asked for.
    expect(await p.getTrackSeries('x', 'shazam_count', '2026-10-01', '2026-10-03')).toEqual([])
    expect(p.supportedTrackMetrics()).toEqual(['spotify_streams'])
  })

  it('Soundcharts: a 403 says the endpoint is not in the plan', async () => {
    const http = (async () =>
      json('{"errors":[{"key":"x","code":403,"message":"Forbidden"}]}', 403)) as unknown as typeof fetch
    const p = new SoundchartsProvider('app', 'key', http, 'https://sc.test')
    await expect(p.getTrackSeries('u', 'spotify_streams', '2026-10-01', '2026-10-02')).rejects.toBeInstanceOf(
      MusicProviderRefused,
    )
  })

  it('Scrape Creators: reads the number of videos using the sound', async () => {
    let asked = ''
    const http = (async (u: URL) => {
      asked = String(u)
      return json(fixture('scrapecreators-tiktok-song.json'))
    }) as unknown as typeof fetch
    expect(await fetchTikTokSoundTotal('key', '7439295283975702544', http, 'https://sc.test')).toEqual({
      musicId: '6717159721276540930',
      title: 'Different (Acoustic)',
      author: 'Micah Tyler',
      videoCount: 358,
    })
    expect(asked).toBe('https://sc.test/v1/tiktok/song?clipId=7439295283975702544')
  })
})
