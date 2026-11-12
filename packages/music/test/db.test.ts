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
  runMusicPulls,
  saveMusicSetup,
  SoundchartsProvider,
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
