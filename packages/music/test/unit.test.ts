import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  attribution,
  baseline,
  buildMusicProvider,
  chartRuns,
  dailyBySource,
  dailyFromCumulative,
  describeCall,
  describePull,
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
    // Metrics without a platform code are not asked for (YouTube Shorts has none in the reference).
    expect(await p.getTrackSeries('x', 'youtube_views', '2026-10-01', '2026-10-03')).toEqual([])
    expect(p.supportedTrackMetrics()).toEqual([
      'spotify_streams',
      'tiktok_song_video_count',
      'shazam_count',
      'instagram_song_reel_count',
      'youtube_song_views',
      'spotify_playlist_count',
      'spotify_playlist_reach',
      'spotify_editorial_playlist_count',
      'spotify_editorial_playlist_reach',
    ])
    expect(p.supportedArtistMetrics()).toEqual(['spotify_monthly_listeners'])
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

describe('Soundcharts pull diagnostic (soundcharts-fix)', () => {
  const sc = (handler: (u: URL) => Response) => {
    const asked: string[] = []
    const http = (async (u: URL) => {
      asked.push(String(u))
      return handler(u)
    }) as unknown as typeof fetch
    return { asked, p: new SoundchartsProvider('app', 'key', http, 'https://sc.test') }
  }

  it('notes status, days, field names and ids of each audience answer', async () => {
    const { p } = sc(() => json(fixture('soundcharts-audience-spotify.json')))
    await p.getTrackSeries('11e82612-052b-f4f4-a20c-a0369fe50396', 'spotify_streams', '2026-10-01', '2026-10-03')
    const [c] = p.takeCalls()
    expect(c).toMatchObject({
      status: 200,
      fields: ['_source', 'errors', 'items', 'page', 'related'],
      dates: 3,
      datesWithNumbers: 3,
      firstDate: '2026-10-01',
      lastDate: '2026-10-03',
      total: 3,
    })
    expect(c!.identifiers).toEqual(['0bYg9bo50gSsH3LtXe2SQn', '1aaaaaaaaaaaaaaaaaaaaa', '2bbbbbbbbbbbbbbbbbbbbb'])
    expect(c!.path).toBe(
      '/api/v2/song/11e82612-052b-f4f4-a20c-a0369fe50396/audience/spotify?startDate=2026-10-01&endDate=2026-10-03&offset=0&limit=100&sort=asc',
    )
    // Asked calls are forgotten once taken; no key or header is kept.
    expect(p.takeCalls()).toEqual([])
    expect(JSON.stringify(c)).not.toContain('key')
  })

  it('an empty answer gives no points, says "no days", and the ids check says which Spotify ids are held', async () => {
    const { p, asked } = sc((u) =>
      u.pathname.endsWith('/identifiers')
        ? json(fixture('soundcharts-song-identifiers-spotify.json'))
        : json(fixture('soundcharts-audience-spotify-empty.json')),
    )
    expect(await p.getTrackSeries('u1', 'spotify_streams', '2026-10-01', '2026-10-03')).toEqual([])
    await p.explainEmpty('u1')
    const calls = p.takeCalls()
    expect(calls.map((c) => c.status)).toEqual([200, 200])
    expect(calls[0]).toMatchObject({ dates: 0, datesWithNumbers: 0, total: 0 })
    expect(calls[1]!.identifiers).toEqual(['0bYg9bo50gSsH3LtXe2SQn'])
    expect(new URL(asked[1]!).pathname).toBe('/api/v2/song/u1/identifiers')
    expect(new URL(asked[1]!).searchParams.get('platform')).toBe('spotify')
    expect(p.requests).toBe(2)
    expect(describePull({ provider: 'soundcharts', calls, stored: {} })).toBe(
      'audience spotify: answered 200, no days, no ids, fields _source, errors, items, page, related. ' +
        'Spotify ids held: answered 200, ids 0bYg9bo50gSsH3LtXe2SQn, fields _source, errors, items, page. Stored nothing.',
    )
  })

  it('a 404 on the audience is kept as "song not found" instead of passing as an empty answer', async () => {
    const { p } = sc(() => json('{"errors":[{"key":"song","code":404,"message":"Song not found"}]}', 404))
    expect(await p.getTrackSeries('gone', 'spotify_streams', '2026-10-01', '2026-10-03')).toEqual([])
    const [c] = p.takeCalls()
    expect(c).toMatchObject({ status: 404, errors: ['song 404 Song not found'] })
    expect(describeCall(c!)).toContain('answered 404, song not found')
  })

  it('messages in the root errors array of a 200 answer are kept', async () => {
    const body = JSON.parse(fixture('soundcharts-audience-spotify-empty.json'))
    body.errors = [{ key: 'identifier', code: 0, message: 'No identifier for this platform' }]
    const { p } = sc(() => json(JSON.stringify(body)))
    await p.getTrackSeries('u', 'spotify_streams', '2026-10-01', '2026-10-02')
    expect(p.takeCalls()[0]!.errors).toEqual(['identifier 0 No identifier for this platform'])
  })

  it('a 429 says the quota is used up', async () => {
    const { p } = sc(() => json('{"errors":[]}', 429))
    await expect(p.getTrackSeries('u', 'spotify_streams', '2026-10-01', '2026-10-02')).rejects.toThrow(
      /429 \(request quota used up\)/,
    )
  })

  it('a 410 on the ISRC (blacklisted) falls back to the Spotify id', async () => {
    const { p, asked } = sc((u) =>
      u.pathname.includes('/by-isrc/') ? json('{"errors":[]}', 410) : json(fixture('soundcharts-song-by-isrc.json')),
    )
    expect((await p.resolveTrack({ isrc: 'USSM19400325', spotifyTrackId: '0bYg9bo50gSsH3LtXe2SQn' }))?.title).toBe(
      'Test Song',
    )
    expect(asked).toHaveLength(2)
  })

  it('a run from before the diagnostic existed says so', () => {
    expect(describePull(null)).toBe('No details kept for this run (it ran before details were recorded).')
    expect(describePull({ provider: 'none', skippedProvider: 'no provider switched on', calls: [], stored: {} })).toBe(
      'Provider not asked: no provider switched on. Stored nothing.',
    )
  })
})

describe('Soundcharts more numbers (soundcharts-more)', () => {
  const song = '11e82612-052b-f4f4-a20c-a0369fe50396'
  const sc = (handler: (u: URL) => Response) => {
    const asked: URL[] = []
    const http = (async (u: URL) => {
      asked.push(new URL(String(u)))
      return handler(new URL(String(u)))
    }) as unknown as typeof fetch
    return { asked, p: new SoundchartsProvider('app', 'key', http, 'https://sc.test') }
  }

  it('reads TikTok videos as a level and Shazams as a running total from the audience endpoint', async () => {
    const { asked, p } = sc((u) =>
      json(
        fixture(
          u.pathname.endsWith('/tiktok') ? 'soundcharts-audience-tiktok.json' : 'soundcharts-audience-shazam.json',
        ),
      ),
    )
    const tiktok = await p.getTrackSeries(song, 'tiktok_song_video_count', '2026-09-30', '2026-10-03')
    expect(tiktok.map((x) => [x.date, x.value, x.isCumulative])).toEqual([
      ['2026-09-30', 1000, false],
      ['2026-10-01', 1010, false],
      ['2026-10-02', 1200, false],
      ['2026-10-03', 1500, false],
    ])
    const shazam = await p.getTrackSeries(song, 'shazam_count', '2026-09-30', '2026-10-03')
    expect(shazam.every((x) => x.isCumulative)).toBe(true)
    expect(shazam.at(-1)).toEqual({ date: '2026-10-03', value: 5800, isCumulative: true })
    expect(asked.map((u) => u.pathname)).toEqual([
      `/api/v2/song/${song}/audience/tiktok`,
      `/api/v2/song/${song}/audience/shazam`,
    ])
  })

  it('gives four playlist numbers from one playlist reach call', async () => {
    const { asked, p } = sc(() => json(fixture('soundcharts-playlist-reach-spotify.json')))
    const count = await p.getTrackSeries(song, 'spotify_playlist_count', '2026-10-01', '2026-10-03')
    const reach = await p.getTrackSeries(song, 'spotify_playlist_reach', '2026-10-01', '2026-10-03')
    const ed = await p.getTrackSeries(song, 'spotify_editorial_playlist_count', '2026-10-01', '2026-10-03')
    const edReach = await p.getTrackSeries(song, 'spotify_editorial_playlist_reach', '2026-10-01', '2026-10-03')
    expect(count.map((x) => x.value)).toEqual([10, 14])
    expect(reach.map((x) => x.value)).toEqual([20000, 95000])
    expect(ed.map((x) => x.value)).toEqual([0, 1])
    expect(edReach.map((x) => x.value)).toEqual([0, 60000])
    expect(p.requests).toBe(1)
    expect(asked[0]!.pathname).toBe(`/api/v2/song/${song}/playlist/reach/spotify`)
    expect(Object.fromEntries(asked[0]!.searchParams)).toEqual({
      type: 'all',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      offset: '0',
      limit: '100',
    })
  })

  it('reads playlist entries, past ones only when asked for the history', async () => {
    const { asked, p } = sc(() => json(fixture('soundcharts-playlist-entries-spotify.json')))
    const entries = await p.getPlaylistEntries(song, true)
    expect(entries[0]).toEqual({
      platform: 'spotify',
      playlistId: '11e84493-4135-a14e-bca2-a0369fe50396',
      playlistIdentifier: '37i9dQZF1DWXJfnUiYjUKT',
      name: 'New Music Friday',
      type: 'editorial',
      country: 'US',
      followers: 60000,
      entryDate: '2026-10-03',
      exitDate: null,
      position: 12,
      peakPosition: 9,
      positionDate: '2026-10-03',
    })
    expect(entries[1]).toMatchObject({ country: null, exitDate: '2026-09-28', type: 'user' })
    expect(asked[0]!.pathname).toBe(`/api/v2.20/song/${song}/playlist/current/spotify`)
    expect(asked[0]!.searchParams.get('currentOnly')).toBe('0')
    await p.getPlaylistEntries(song, false)
    expect(asked[1]!.searchParams.get('currentOnly')).toBe('1')
  })

  it('reads chart places, leaving out position 0 (no longer in the chart)', async () => {
    const { asked, p } = sc(() => json(fixture('soundcharts-chart-ranks-spotify.json')))
    expect(await p.getChartEntries(song, true)).toEqual([
      {
        date: '2026-10-03',
        entryDate: '2026-10-03',
        chartPlatform: 'spotify',
        chartName: 'Viral - Global',
        country: null,
        city: null,
        position: 31,
        previousPosition: 37,
      },
    ])
    expect(asked[0]!.pathname).toBe(`/api/v2/song/${song}/charts/ranks/spotify`)
    expect(asked[0]!.searchParams.get('currentOnly')).toBe('0')
  })

  it('reads Spotify monthly listeners for the artist', async () => {
    const { asked, p } = sc(() => json(fixture('soundcharts-artist-streaming-spotify.json')))
    expect(await p.getArtistSeries('a1', 'spotify_monthly_listeners', '2026-10-01', '2026-10-03')).toEqual([
      { date: '2026-10-01', value: 40000, isCumulative: false },
      { date: '2026-10-03', value: 46000, isCumulative: false },
    ])
    expect(asked[0]!.pathname).toBe('/api/v2/artist/a1/streaming/spotify')
    expect(await p.getArtistSeries('a1', 'spotify_followers', '2026-10-01', '2026-10-03')).toEqual([])
  })

  it('a 400 (platform code not accepted) is a refusal for that number only, with its own words', async () => {
    const { p } = sc(() => json('{"errors":[{"key":"platform","code":400,"message":"Invalid platform code"}]}', 400))
    const e = await p.getTrackSeries(song, 'instagram_song_reel_count', '2026-10-01', '2026-10-03').catch((x) => x)
    expect(e).toBeInstanceOf(MusicProviderRefused)
    expect(String(e.message)).toContain('platform code or date not accepted')
  })

  it('names the new calls in the diagnostic', () => {
    expect(describeCall({ path: '/api/v2/song/u/playlist/reach/spotify', status: 200 })).toBe(
      'playlist reach: answered 200',
    )
    expect(describeCall({ path: '/api/v2.20/song/u/playlist/current/spotify', status: 403 })).toBe(
      'playlist entries: answered 403',
    )
    expect(describeCall({ path: '/api/v2/song/u/charts/ranks/spotify', status: 200 })).toBe(
      'chart entries: answered 200',
    )
    expect(describeCall({ path: '/api/v2/artist/a/streaming/spotify', status: 200 })).toBe(
      'artist monthly listeners: answered 200',
    )
    expect(describeCall({ path: '/api/v2/song/u/audience/tiktok', status: 400 })).toBe('audience tiktok: answered 400')
  })
})

describe('attribution', () => {
  const d = (date: string, value: number): Day => ({ date, value })
  it('splits a daily count into before, during and after the campaign', () => {
    const series = [
      d('2026-09-29', 10),
      d('2026-09-30', 10),
      d('2026-10-01', 20),
      d('2026-10-02', 30),
      d('2026-10-03', 40),
      d('2026-10-04', 15),
    ]
    const a = attribution('flow', series, '2026-10-01', 2, '2026-10-02')
    expect(a.before).toMatchObject({ from: '2026-09-29', to: '2026-09-30', days: 2, perDay: 10 })
    expect(a.during).toMatchObject({ from: '2026-10-01', to: '2026-10-02', days: 2, perDay: 25 })
    expect(a.after).toMatchObject({ from: '2026-10-03', to: '2026-10-04', days: 2, perDay: 27.5 })
    expect(a.series).toHaveLength(6)
  })

  it('gives a level its value at the end of each window and its change a day; no after while open', () => {
    const series = [d('2026-09-20', 900), d('2026-10-01', 1000), d('2026-10-02', 1200), d('2026-10-03', 1500)]
    const a = attribution('level', series, '2026-10-02', 1, null)
    expect(a.before.level).toEqual(d('2026-10-01', 1000))
    expect(a.during.level).toEqual(d('2026-10-03', 1500))
    expect(a.during.perDay).toBe(250)
    expect(a.after).toBeNull()
    // The level from before the window is still the "before" value when the window has none.
    expect(
      attribution('level', [d('2026-09-20', 900), d('2026-10-03', 1500)], '2026-10-02', 1, null).before.level,
    ).toEqual(d('2026-09-20', 900))
  })

  it('keeps the first chart day from the provider, so a chart held before launch stays "before"', () => {
    const r = chartRuns(
      [
        {
          date: '2026-10-03',
          entryDate: '2026-09-01',
          chartPlatform: 'spotify',
          chartName: 'Viral - Global',
          country: null,
          city: null,
          position: 31,
          source: 'soundcharts',
        },
      ],
      '2026-10-02',
    )
    expect(r.beforeLaunch).toHaveLength(1)
    expect(r.beforeLaunch[0]!.firstDate).toBe('2026-09-01')
  })
})
