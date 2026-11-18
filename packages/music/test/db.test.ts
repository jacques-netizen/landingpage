import { readFileSync } from 'node:fs'
import { createDb, tables } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addChartEntry,
  addManualMetric,
  confirmTrackMatch,
  matchTrack,
  musicReport,
  NoMusicProvider,
  pullTrackNow,
  runMusicPulls,
  saveMusicSetup,
  SoundchartsProvider,
  type PullDiagnostic,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(() => sql.end())
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } })

let staffId = ''
let n = 0
beforeAll(async () => {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `staff-${Date.now()}@test.invalid` })
    .returning()
  staffId = u!.id
})

async function campaign() {
  // Earlier tests' songs are closed, so each pull here sees only its own.
  await db.update(tables.musicTracks).set({ trackingEndDate: '2000-01-01' })
  const [c] = await db
    .insert(tables.campaigns)
    .values({
      type: 'music',
      title: `Song ${++n}`,
      platforms: ['tiktok'],
      budgetCents: 100_000,
      rateCentsPer1000: 100,
      status: 'live',
    })
    .returning()
  return c!
}

const setup = (over: Record<string, string> = {}) => ({
  artistName: 'Test Artist',
  title: 'Test Song',
  spotifyTrackUrl: 'https://open.spotify.com/track/0bYg9bo50gSsH3LtXe2SQn?si=x',
  isrc: 'USSM19400325',
  tiktokSoundUrl: 'https://www.tiktok.com/music/Test-Song-7439295283975702544',
  launchDate: '2026-10-02',
  baselineDays: '28',
  ...over,
})

/** A fake Soundcharts and Scrape Creators answering from the fixtures, counting calls. */
function fakes() {
  const calls: string[] = []
  const http = (async (u: URL) => {
    const s = String(u)
    calls.push(s)
    if (s.includes('/by-isrc/')) return json(fixture('soundcharts-song-by-isrc.json'))
    if (s.includes('/audience/spotify')) return json(fixture('soundcharts-audience-spotify.json'))
    if (s.includes('/v1/tiktok/song')) return json(fixture('scrapecreators-tiktok-song.json'))
    return json('{}', 404)
  }) as unknown as typeof fetch
  return { http, calls, provider: () => new SoundchartsProvider('app', 'key', http, 'https://sc.test') }
}

describe('music setup', () => {
  it('saves the artist and song from links, and says which link is wrong', async () => {
    const c = await campaign()
    const bad = await saveMusicSetup(db, staffId, c.id, setup({ spotifyTrackUrl: 'https://example.com', isrc: 'nope' }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['isrc', 'spotifyTrackUrl'])
    const r = await saveMusicSetup(db, staffId, c.id, setup())
    expect(r.ok).toBe(true)
    const [t] = await db.select().from(tables.musicTracks).where(eq(tables.musicTracks.campaignId, c.id))
    expect(t).toMatchObject({
      spotifyTrackId: '0bYg9bo50gSsH3LtXe2SQn',
      tiktokClipId: '7439295283975702544',
      isrc: 'USSM19400325',
      baselineStatus: 'pending',
      soundRule: 'warn',
    })
    const audit = await db
      .select()
      .from(tables.auditLog)
      .where(and(eq(tables.auditLog.entityId, t!.id), eq(tables.auditLog.action, 'music.track_added')))
    expect(audit).toHaveLength(1)
  })
})

describe('music pull', () => {
  it('pulls nothing from a provider until the match is confirmed, then backfills once a day', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup())
    if (!r.ok) throw new Error('setup')
    const f = fakes()
    const now = new Date('2026-10-03T12:00:00Z')

    // Not matched yet: only the sound count from Scrape Creators.
    await runMusicPulls(db, {
      provider: f.provider(),
      scrapeCreatorsKey: 'k',
      http: f.http,
      scrapeCreatorsBase: 'https://sc.test',
      now,
    })
    expect(f.calls.filter((u) => u.includes('/audience/'))).toHaveLength(0)
    expect(f.calls.filter((u) => u.includes('/v1/tiktok/song'))).toHaveLength(1)

    const m = await matchTrack(db, staffId, r.trackId, f.provider())
    expect(m).toEqual({ ok: true, title: 'Test Song', artist: 'Test Artist' })
    await confirmTrackMatch(db, staffId, r.trackId)

    // The backfill runs even though today's daily pull already ran; a second run that day does nothing.
    const later = new Date('2026-10-03T13:00:00Z')
    const deps = {
      provider: f.provider(),
      scrapeCreatorsKey: 'k',
      http: f.http,
      scrapeCreatorsBase: 'https://sc.test',
      now: later,
    }
    await runMusicPulls(db, deps)
    const before = f.calls.length
    const again = await runMusicPulls(db, deps)
    expect(f.calls.length).toBe(before)
    expect(again.skipped).toBeGreaterThanOrEqual(1)

    const rows = await db
      .select()
      .from(tables.musicMetricSnapshots)
      .where(eq(tables.musicMetricSnapshots.musicTrackId, r.trackId))
    expect(rows.filter((x) => x.metric === 'spotify_streams')).toHaveLength(3)
    expect(rows.filter((x) => x.metric === 'tiktok_sound_video_count')).toHaveLength(1)
    const [t] = await db.select().from(tables.musicTracks).where(eq(tables.musicTracks.id, r.trackId))
    // The first running total is the day before launch, so no daily count exists before launch.
    expect(t!.baselineStatus).toBe('unavailable')
    expect(t!.tiktokMusicId).toBe('6717159721276540930')
    const runs = await db.select().from(tables.musicJobRuns).where(eq(tables.musicJobRuns.musicTrackId, r.trackId))
    expect(runs.every((x) => x.status === 'ok')).toBe(true)
    expect(runs.some((x) => (x.requestsUsed as Record<string, number>).soundcharts! > 0)).toBe(true)
  })

  it('works with no provider: the sound count only', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup())
    if (!r.ok) throw new Error('setup')
    const f = fakes()
    await runMusicPulls(db, {
      provider: new NoMusicProvider(),
      scrapeCreatorsKey: 'k',
      http: f.http,
      scrapeCreatorsBase: 'https://sc.test',
      now: new Date('2026-10-05T12:00:00Z'),
    })
    expect(f.calls.every((u) => u.includes('/v1/tiktok/song'))).toBe(true)
    expect(await matchTrack(db, staffId, r.trackId, new NoMusicProvider())).toMatchObject({ ok: false })
  })

  it('keeps the run when Scrape Creators refuses (402 out of credits), and says why', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup())
    if (!r.ok) throw new Error('setup')
    const f = fakes()
    await matchTrack(db, staffId, r.trackId, f.provider())
    await confirmTrackMatch(db, staffId, r.trackId)
    const http = (async (u: URL) =>
      String(u).includes('/v1/tiktok/song')
        ? json('{"success":false,"message":"Out of credits"}', 402)
        : f.http(u)) as unknown as typeof fetch
    await runMusicPulls(db, {
      provider: new SoundchartsProvider('app', 'key', http, 'https://sc.test'),
      scrapeCreatorsKey: 'k',
      http,
      scrapeCreatorsBase: 'https://sc.test',
      now: new Date('2026-10-03T12:00:00Z'),
    })
    const [run] = await db.select().from(tables.musicJobRuns).where(eq(tables.musicJobRuns.musicTrackId, r.trackId))
    expect(run!.status).toBe('ok')
    expect(run!.error).toContain('tiktok_sound_video_count: Scrape Creators /v1/tiktok/song returned 402')
    const rows = await db
      .select()
      .from(tables.musicMetricSnapshots)
      .where(eq(tables.musicMetricSnapshots.musicTrackId, r.trackId))
    expect(rows.filter((x) => x.metric === 'spotify_streams').length).toBeGreaterThan(0)
  })
})

describe('music report', () => {
  it('keeps Soundcharts numbers off the client report until display is allowed, then labels them', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup({ launchDate: '2026-10-02' }))
    if (!r.ok) throw new Error('setup')
    const f = fakes()
    await matchTrack(db, staffId, r.trackId, f.provider())
    await confirmTrackMatch(db, staffId, r.trackId)
    await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-03T12:00:00Z') })

    const admin = await musicReport(db, c.id, { audience: 'admin', clientDisplay: { soundcharts: false } })
    expect(admin!.tracks[0]!.streams?.since.total).toBe(3000)
    expect(admin!.tracks[0]!.admin).toBeDefined()

    // Soundcharts only: nothing at all for the client.
    expect(await musicReport(db, c.id, { audience: 'client', clientDisplay: { soundcharts: false } })).toBeNull()

    const shown = await musicReport(db, c.id, { audience: 'client', clientDisplay: { soundcharts: true } })
    expect(shown!.tracks[0]!.streams!.sourceLines).toEqual(['Source: www.soundcharts.com'])
    expect(shown!.tracks[0]!.admin).toBeUndefined()
  })

  it('shows typed-in Spotify for Artists and chart numbers to the client, and hides empty blocks', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup({ launchDate: '2026-10-29' }))
    if (!r.ok) throw new Error('setup')
    const week = async (start: string, end: string, value: string) =>
      expect(
        await addManualMetric(db, staffId, {
          trackId: r.trackId,
          source: 'spotify_for_artists_manual',
          metric: 'spotify_streams',
          periodStart: start,
          periodEnd: end,
          value,
        }),
      ).toEqual({ ok: true })
    await week('2026-10-01', '2026-10-07', '7000')
    await week('2026-10-08', '2026-10-14', '7000')
    await week('2026-10-15', '2026-10-21', '7000')
    await week('2026-10-22', '2026-10-28', '7000')
    await week('2026-10-29', '2026-11-04', '14000')
    // Typing the same week again replaces it, never adds a second row.
    await week('2026-10-29', '2026-11-04', '10500')
    expect(
      await addManualMetric(db, staffId, {
        trackId: r.trackId,
        source: 'spotify_for_artists_manual',
        metric: 'spotify_streams',
        periodStart: '2026-11-05',
        value: '-4',
      }),
    ).toMatchObject({ ok: false })
    expect(
      await addChartEntry(db, staffId, {
        trackId: r.trackId,
        date: '2026-11-03',
        chartPlatform: 'shazam',
        chartName: 'Top 50',
        country: 'fr',
        position: '12',
      }),
    ).toEqual({ ok: true })

    const rep = await musicReport(db, c.id, { audience: 'client', clientDisplay: { soundcharts: false } })
    const t = rep!.tracks[0]!
    expect(t.streams!.changePercent).toBe(50)
    expect(t.streams!.sourceLines).toEqual(['Source: Spotify for Artists'])
    expect(t.charts!.sinceLaunch[0]).toMatchObject({ chartName: 'Top 50', country: 'FR', bestPosition: 12 })
    expect(t.shazams).toBeNull()
    expect(t.listeners).toBeNull()
    expect(t.sound).toBeNull()
    const text = JSON.stringify(rep)
    expect(text).not.toMatch(/Cents|cpm|payout|rate/i)
  })

  it('counts matched sound checks, leaving rejected posts out', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup())
    if (!r.ok) throw new Error('setup')
    const [u] = await db
      .insert(tables.users)
      .values({ email: `c-${Date.now()}@test.invalid` })
      .returning()
    const [terms] = await db
      .insert(tables.termsVersions)
      .values({ campaignId: c.id, bodyMarkdown: 'Rules', effectiveAt: new Date() })
      .returning()
    const post = (i: number, state: string, sound: string | null) => ({
      campaignId: c.id,
      creatorId: u!.id,
      platform: 'tiktok',
      postUrl: `https://www.tiktok.com/@a/video/700000000000000000${i}`,
      platformPostId: `700000000000000000${i}`,
      state,
      termsVersionId: terms!.id,
      rateCentsPer1000Locked: 100,
      submittedAt: new Date(),
      soundCheckStatus: sound,
    })
    await db
      .insert(tables.submissions)
      .values([post(1, 'approved', 'matched'), post(2, 'approved', 'different_sound'), post(3, 'rejected', 'matched')])
    await db.insert(tables.musicMetricSnapshots).values([
      {
        musicTrackId: r.trackId,
        date: '2026-10-01',
        source: 'scrapecreators',
        metric: 'tiktok_sound_video_count',
        value: 10,
      },
      {
        musicTrackId: r.trackId,
        date: '2026-10-10',
        source: 'scrapecreators',
        metric: 'tiktok_sound_video_count',
        value: 40,
      },
    ])
    const rep = await musicReport(db, c.id, { audience: 'admin', clientDisplay: { soundcharts: false } })
    expect(rep!.tracks[0]!.sound).toMatchObject({ newSinceLaunch: 30, campaignVideos: 1, outsideCampaign: 29 })
    expect(rep!.tracks[0]!.admin!.soundChecks).toEqual({ matched: 1, different_sound: 1 })
  })
})

describe('music pull diagnostic and pull again now (soundcharts-fix)', () => {
  /** Soundcharts that knows the song but has no Spotify numbers until `filled` is set. */
  function emptyThenFilled() {
    const calls: string[] = []
    let filled = false
    const http = (async (u: URL) => {
      const s = String(u)
      calls.push(s)
      if (s.includes('/by-isrc/')) return json(fixture('soundcharts-song-by-isrc.json'))
      if (s.includes('/identifiers')) return json(fixture('soundcharts-song-identifiers-spotify.json'))
      if (s.includes('/audience/spotify'))
        return json(fixture(filled ? 'soundcharts-audience-spotify.json' : 'soundcharts-audience-spotify-empty.json'))
      return json('{}', 404)
    }) as unknown as typeof fetch
    return {
      calls,
      fill: () => (filled = true),
      provider: () => new SoundchartsProvider('app', 'key', http, 'https://sc.test'),
    }
  }

  async function confirmedSong() {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup({ launchDate: '2026-10-02' }))
    if (!r.ok) throw new Error('setup')
    const f = emptyThenFilled()
    await matchTrack(db, staffId, r.trackId, f.provider())
    await confirmTrackMatch(db, staffId, r.trackId)
    return { c, trackId: r.trackId, f }
  }

  const runsOf = (trackId: string) =>
    db
      .select()
      .from(tables.musicJobRuns)
      .where(eq(tables.musicJobRuns.musicTrackId, trackId))
      .orderBy(tables.musicJobRuns.startedAt)

  it('keeps what Soundcharts answered, checks the ids once when empty, and asks for the history again next day', async () => {
    const { trackId, f } = await confirmedSong()
    await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-03T12:00:00Z') })
    let runs = await runsOf(trackId)
    const d1 = runs[0]!.diagnostic as unknown as PullDiagnostic
    expect(d1.window).toEqual({ from: '2026-08-27', to: '2026-10-03', wide: true })
    // Spotify, then the other numbers (unknown to this fake Soundcharts: 404), then the ids check.
    const spotify = d1.calls.filter((c) => c.path.includes('/audience/spotify') || c.path.includes('/identifiers'))
    expect(spotify.map((c) => c.status)).toEqual([200, 200])
    expect(spotify[0]).toMatchObject({ dates: 0 })
    expect(spotify[1]!.identifiers).toEqual(['0bYg9bo50gSsH3LtXe2SQn'])
    expect(d1.stored).toEqual({})
    expect(runs[0]!.requestsUsed).toEqual({ soundcharts: d1.calls.length })

    // Next day: still nothing stored, so the whole window from before launch is asked for again.
    f.fill()
    await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-04T12:00:00Z') })
    runs = await runsOf(trackId)
    const d2 = runs[1]!.diagnostic as unknown as PullDiagnostic
    expect(d2.window).toEqual({ from: '2026-08-27', to: '2026-10-04', wide: true })
    expect(d2.stored).toEqual({ spotify_streams: 3 })
    // Spotify streams are stored, so the ids check is not asked again.
    expect(d2.calls.filter((c) => c.path.includes('/identifiers'))).toHaveLength(0)

    // Once numbers are stored, the daily pull asks for the last 8 days only.
    await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-05T12:00:00Z') })
    runs = await runsOf(trackId)
    expect((runs[2]!.diagnostic as unknown as PullDiagnostic).window).toEqual({
      from: '2026-09-27',
      to: '2026-10-05',
      wide: false,
    })
  })

  it("pull again now runs even after today's pull, is audited, and waits a minute between clicks", async () => {
    const { c, trackId, f } = await confirmedSong()
    const t0 = new Date('2026-10-03T12:00:00Z')
    await runMusicPulls(db, { provider: f.provider(), now: t0 })
    // The daily pull already ran today: the hourly job skips the song.
    const skipped = await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-03T13:00:00Z') })
    expect(skipped.skipped).toBeGreaterThanOrEqual(1)

    f.fill()
    const now = new Date('2026-10-03T13:05:00Z')
    const r = await pullTrackNow(db, staffId, c.id, trackId, { provider: f.provider(), now })
    expect(r).toMatchObject({ ok: true, result: 'ok' })
    if (r.ok) expect(r.summary).toContain('Stored 3 days of spotify_streams.')
    const runs = await runsOf(trackId)
    expect(runs).toHaveLength(2)
    expect((runs[1]!.diagnostic as unknown as PullDiagnostic).forced).toBe(true)
    const audit = await db
      .select()
      .from(tables.auditLog)
      .where(and(eq(tables.auditLog.entityId, trackId), eq(tables.auditLog.action, 'music.pull_requested')))
    expect(audit).toHaveLength(1)

    const again = await pullTrackNow(db, staffId, c.id, trackId, {
      provider: f.provider(),
      now: new Date('2026-10-03T13:05:30Z'),
    })
    expect(again).toMatchObject({ ok: false })

    const other = await campaign()
    expect(await pullTrackNow(db, staffId, other.id, trackId, { provider: f.provider(), now })).toEqual({
      ok: false,
      message: 'This song is not on this campaign.',
    })
  })
})

describe('more Soundcharts numbers (soundcharts-more)', () => {
  /** A fake Soundcharts that answers every documented endpoint from the fixtures. */
  function full() {
    const calls: string[] = []
    const http = (async (u: URL) => {
      const s = String(u)
      calls.push(s)
      if (s.includes('/by-isrc/')) return json(fixture('soundcharts-song-by-isrc.json'))
      if (s.includes('/audience/spotify')) return json(fixture('soundcharts-audience-spotify.json'))
      if (s.includes('/audience/tiktok')) return json(fixture('soundcharts-audience-tiktok.json'))
      if (s.includes('/audience/shazam')) return json(fixture('soundcharts-audience-shazam.json'))
      if (s.includes('/audience/instagram'))
        return json('{"errors":[{"key":"platform","code":400,"message":"Invalid platform code"}]}', 400)
      if (s.includes('/playlist/reach/')) return json(fixture('soundcharts-playlist-reach-spotify.json'))
      if (s.includes('/playlist/current/')) return json(fixture('soundcharts-playlist-entries-spotify.json'))
      if (s.includes('/charts/ranks/')) return json(fixture('soundcharts-chart-ranks-spotify.json'))
      if (s.includes('/artist/') && s.includes('/streaming/spotify'))
        return json(fixture('soundcharts-artist-streaming-spotify.json'))
      return json('{}', 404)
    }) as unknown as typeof fetch
    return { calls, provider: () => new SoundchartsProvider('app', 'key', http, 'https://sc.test') }
  }

  it('stores every number, playlist and chart, keeps a refused one apart, and builds the attribution view', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup({ launchDate: '2026-10-02', baselineDays: '7' }))
    if (!r.ok) throw new Error('setup')
    const f = full()
    await matchTrack(db, staffId, r.trackId, f.provider())
    await confirmTrackMatch(db, staffId, r.trackId)
    // A chart place staff typed in for the same chart and day stays as typed.
    await addChartEntry(db, staffId, {
      trackId: r.trackId,
      date: '2026-10-03',
      chartPlatform: 'spotify',
      chartName: 'Viral - Global',
      position: '29',
      country: '',
      city: '',
    })

    await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-03T12:00:00Z') })
    const [run] = await db.select().from(tables.musicJobRuns).where(eq(tables.musicJobRuns.musicTrackId, r.trackId))
    expect(run!.status).toBe('ok')
    const d = run!.diagnostic as unknown as PullDiagnostic
    expect(d.stored).toMatchObject({
      spotify_streams: 3,
      tiktok_song_video_count: 4,
      shazam_count: 4,
      spotify_playlist_count: 2,
      spotify_monthly_listeners: 2,
      playlist_entries: 2,
      chart_entries: 1,
    })
    expect(run!.error).toContain('instagram_song_reel_count')
    expect(d.historyFor).toContain('tiktok_song_video_count')
    // Five audience calls, one reach call for four numbers, playlists, charts, the artist: nine.
    expect(run!.requestsUsed).toEqual({ soundcharts: 9 })

    const charts = await db.select().from(tables.chartEntries).where(eq(tables.chartEntries.musicTrackId, r.trackId))
    expect(charts).toHaveLength(1)
    expect(charts[0]).toMatchObject({ source: 'manual', position: 29 })
    const playlists = await db
      .select()
      .from(tables.musicPlaylistEntries)
      .where(eq(tables.musicPlaylistEntries.musicTrackId, r.trackId))
    expect(playlists.map((p) => p.name).sort()).toEqual(['New Music Friday', 'Test User List'])

    // Next day the same answers update rows instead of adding new ones, and only the last 8 days are asked.
    await runMusicPulls(db, { provider: f.provider(), now: new Date('2026-10-04T12:00:00Z') })
    const again = await db
      .select()
      .from(tables.musicPlaylistEntries)
      .where(eq(tables.musicPlaylistEntries.musicTrackId, r.trackId))
    expect(again).toHaveLength(2)
    const tiktokAsk = f.calls.filter((u) => u.includes('/audience/tiktok')).at(-1)!
    expect(new URL(tiktokAsk).searchParams.get('startDate')).toBe('2026-09-26')
    expect(f.calls.filter((u) => u.includes('/playlist/current/')).at(-1)).toContain('currentOnly=1')

    // Staff see every block; the client sees none of it until Soundcharts display is allowed.
    const admin = await musicReport(db, c.id, { audience: 'admin', clientDisplay: { soundcharts: false } })
    const t = admin!.tracks[0]!
    expect(t.attribution.map((b) => b.metric)).toEqual([
      'tiktok_song_video_count',
      'shazam_count',
      'spotify_streams',
      'spotify_playlist_count',
      'spotify_editorial_playlist_count',
      'spotify_playlist_reach',
      'spotify_editorial_playlist_reach',
      'spotify_monthly_listeners',
    ])
    const tiktok = t.attribution[0]!
    expect(tiktok.kind).toBe('level')
    expect(tiktok.before.level).toEqual({ date: '2026-10-01', value: 1010 })
    expect(tiktok.during.level).toEqual({ date: '2026-10-03', value: 1500 })
    expect(tiktok.sourceLines).toEqual(['Source: www.soundcharts.com'])
    const shazam = t.attribution.find((b) => b.metric === 'shazam_count')!
    expect(shazam.kind).toBe('flow')
    expect(shazam.before.perDay).toBe(100)
    expect(shazam.during.perDay).toBe(350)
    expect(t.playlists).toMatchObject({ onBeforeLaunch: 0, current: 1 })
    expect(t.playlists!.addedSinceLaunch.map((p) => p.name)).toEqual(['New Music Friday'])
    expect(t.campaignEnd).toBeNull()

    const hidden = await musicReport(db, c.id, { audience: 'client', clientDisplay: { soundcharts: false } })
    // Only the typed-in chart place is left for the client.
    expect(hidden!.tracks[0]!.attribution).toEqual([])
    expect(hidden!.tracks[0]!.playlists).toBeNull()
    const shown = await musicReport(db, c.id, { audience: 'client', clientDisplay: { soundcharts: true } })
    expect(shown!.tracks[0]!.attribution.length).toBe(8)
    expect(shown!.tracks[0]!.admin).toBeUndefined()
  })

  it('shows TikTok videos and Shazams read from the public pages to the client, with their source', async () => {
    const c = await campaign()
    const r = await saveMusicSetup(db, staffId, c.id, setup({ launchDate: '2026-10-16' }))
    if (!r.ok) throw new Error('setup')
    const add = async (source: string, metric: string, day: string, value: string) =>
      expect(
        await addManualMetric(db, staffId, { trackId: r.trackId, source, metric, periodStart: day, value }),
      ).toEqual({ ok: true })
    // Shazams so far is only typed in from the Shazam page; the TikTok count only from the TikTok page.
    expect(
      await addManualMetric(db, staffId, {
        trackId: r.trackId,
        source: 'tiktok_page_manual',
        metric: 'shazam_total',
        periodStart: '2026-11-18',
        value: '1',
      }),
    ).toMatchObject({ ok: false })
    await add('tiktok_page_manual', 'tiktok_sound_video_count', '2026-11-18', '310')
    await add('shazam_page_manual', 'shazam_total', '2026-11-18', '15,619')

    const client = await musicReport(db, c.id, { audience: 'client', clientDisplay: { soundcharts: false } })
    const t = client!.tracks[0]!
    expect(t.sound!.total).toEqual({ date: '2026-11-18', value: 310 })
    expect(t.sound!.sourceLines).toEqual(["Source: TikTok public sound page, read by Maison d'Élites"])
    const shazam = t.attribution.find((b) => b.metric === 'shazam_total')!
    expect(shazam.kind).toBe('level')
    expect(shazam.label).toBe('Shazams so far')
    expect(shazam.during.level).toEqual({ date: '2026-11-18', value: 15619 })
    expect(shazam.sourceLines).toEqual(["Source: Shazam public song page (shazam.com), read by Maison d'Élites"])
    expect(t.attribution.map((b) => b.metric)).toEqual(['tiktok_sound_video_count', 'shazam_total'])
  })
})
