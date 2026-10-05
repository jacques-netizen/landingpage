import crypto from 'node:crypto'
import { createDb, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  accessTokenFor,
  decryptTokens,
  encryptTokens,
  exchangeGoogleCode,
  googleAuthUrl,
  linkOAuthAccount,
  parseIsoDuration,
  YOUTUBE_SCOPE,
  YouTubeApiProvider,
} from '../src'

const KEY = crypto.randomBytes(32).toString('base64')
const client = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://app.test/api/oauth/youtube/callback' }

type Call = { url: URL; init?: RequestInit }
function fakeFetch(routes: (url: URL, init?: RequestInit) => unknown, calls: Call[] = []) {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    const body = routes(url, init)
    if (body instanceof Response) return body
    return new Response(JSON.stringify(body), { status: 200 })
  }) as typeof fetch
}

describe('YouTube provider', () => {
  it('reads a channel by handle with the API key', async () => {
    const calls: Call[] = []
    const yt = new YouTubeApiProvider(
      'key-1',
      fakeFetch(
        () => ({
          items: [
            {
              id: 'UC123',
              snippet: { description: 'bio MDE-7K4Q', publishedAt: '2019-02-03T00:00:00Z', customUrl: '@MayaClips' },
              statistics: { subscriberCount: '15300', hiddenSubscriberCount: false },
            },
          ],
        }),
        calls,
      ),
    )
    const p = await yt.fetchProfile({ platform: 'youtube', handle: 'MayaClips' })
    expect(p).toEqual({
      platformUserId: 'UC123',
      handle: 'mayaclips',
      followers: 15300,
      bio: 'bio MDE-7K4Q',
      isPublic: true,
      createdAt: new Date('2019-02-03T00:00:00Z'),
    })
    expect(calls[0]!.url.pathname).toBe('/youtube/v3/channels')
    expect(calls[0]!.url.searchParams.get('forHandle')).toBe('@mayaclips')
    expect(calls[0]!.url.searchParams.get('key')).toBe('key-1')
  })

  it('uses the creator token for their own channel and hides hidden subscriber counts', async () => {
    const calls: Call[] = []
    const yt = new YouTubeApiProvider(
      undefined,
      fakeFetch(
        () => ({ items: [{ id: 'UC9', snippet: { customUrl: '@a' }, statistics: { hiddenSubscriberCount: true } }] }),
        calls,
      ),
    )
    const p = await yt.fetchProfile({ platform: 'youtube', token: 'tok' })
    expect(p?.followers).toBeNull()
    expect(calls[0]!.url.searchParams.get('mine')).toBe('true')
    expect(calls[0]!.url.searchParams.get('key')).toBeNull()
    expect((calls[0]!.init!.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('returns null for an unknown channel', async () => {
    const yt = new YouTubeApiProvider(
      'k',
      fakeFetch(() => ({ items: [] })),
    )
    expect(await yt.fetchProfile({ platform: 'youtube', handle: 'nobody' })).toBeNull()
  })

  it('reads a video into post data', async () => {
    const yt = new YouTubeApiProvider(
      'k',
      fakeFetch(() => ({
        items: [
          {
            id: 'dQw4w9WgXcQ',
            snippet: {
              channelId: 'UC123',
              publishedAt: '2026-10-04T08:00:00Z',
              title: 'New single #ad',
              description: 'Out now #walmart',
              thumbnails: { high: { url: 'https://i.ytimg.com/vi/x/hq.jpg' } },
            },
            statistics: { viewCount: '48210', likeCount: '3100', commentCount: '120' },
            contentDetails: { duration: 'PT1M5S' },
            status: { privacyStatus: 'public', publicStatsViewable: true },
          },
        ],
      })),
    )
    const v = await yt.fetchPost({
      platform: 'youtube',
      postUrl: 'https://youtu.be/dQw4w9WgXcQ',
      platformPostId: 'dQw4w9WgXcQ',
    })
    expect(v).toMatchObject({
      exists: true,
      isPublic: true,
      views: 48210,
      likes: 3100,
      comments: 120,
      durationSeconds: 65,
      caption: 'New single #ad\nOut now #walmart',
      authorPlatformUserId: 'UC123',
      thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
    })
    expect(v.publishedAt?.toISOString()).toBe('2026-10-04T08:00:00.000Z')
  })

  it('treats unlisted videos as not public, hidden stats as no views, and missing videos as gone', async () => {
    const yt = (status: object) =>
      new YouTubeApiProvider(
        'k',
        fakeFetch(() => ({ items: [{ id: 'v', statistics: { viewCount: '9' }, status }] })),
      )
    const post = { platform: 'youtube' as const, postUrl: 'u', platformPostId: 'dQw4w9WgXcQ' }
    expect((await yt({ privacyStatus: 'unlisted' }).fetchPost(post)).isPublic).toBe(false)
    expect((await yt({ privacyStatus: 'public', publicStatsViewable: false }).fetchPost(post)).views).toBeNull()
    const gone = new YouTubeApiProvider(
      'k',
      fakeFetch(() => ({ items: [] })),
    )
    expect((await gone.fetchPost(post)).exists).toBe(false)
  })

  it('throws on API errors so the router retries', async () => {
    const yt = new YouTubeApiProvider(
      'k',
      fakeFetch(() => new Response('quota', { status: 403 })),
    )
    await expect(yt.fetchProfile({ platform: 'youtube', handle: 'a' })).rejects.toThrow('403')
  })

  it('parses ISO 8601 durations', () => {
    expect(parseIsoDuration('PT15M33S')).toBe(933)
    expect(parseIsoDuration('PT45S')).toBe(45)
    expect(parseIsoDuration('PT1H')).toBe(3600)
    expect(parseIsoDuration('P1DT1S')).toBe(86401)
    expect(parseIsoDuration('nonsense')).toBeNull()
  })
})

describe('tokens at rest', () => {
  it('round trips and refuses tampered data or a wrong key', () => {
    const t = { accessToken: 'a', refreshToken: 'r', expiresAt: null }
    const blob = encryptTokens(t, KEY)
    expect(blob.toString('utf8')).not.toContain('"a"')
    expect(decryptTokens(blob, KEY)).toEqual(t)
    const bad = Buffer.from(blob)
    bad[bad.length - 1]! ^= 1
    expect(() => decryptTokens(bad, KEY)).toThrow()
    expect(() => decryptTokens(blob, crypto.randomBytes(32).toString('base64'))).toThrow()
  })
})

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())
let n = 0
async function creator() {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `yt-${Date.now()}-${++n}@test.invalid` })
    .returning()
  return u!.id
}
const profile = (id: string) => ({
  platformUserId: id,
  handle: `@chan${id}`,
  followers: 900,
  bio: null,
  isPublic: true,
  createdAt: new Date('2020-01-01T00:00:00Z'),
})

describe('YouTube login', () => {
  it('builds the consent link with only the read-only scope', () => {
    const url = new URL(googleAuthUrl(client, 'state-1'))
    expect(url.searchParams.get('scope')).toBe(YOUTUBE_SCOPE)
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('state')).toBe('state-1')
    expect(url.searchParams.get('redirect_uri')).toBe(client.redirectUri)
  })

  it('exchanges the code for tokens', async () => {
    const calls: Call[] = []
    const now = new Date('2026-10-05T10:00:00Z')
    const t = await exchangeGoogleCode(
      client,
      'code-1',
      fakeFetch(() => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }), calls),
      now,
    )
    expect(t).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: '2026-10-05T11:00:00.000Z' })
    const body = new URLSearchParams(String(calls[0]!.init!.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code-1')
  })

  it('links a verified account with encrypted tokens, and refuses one linked to another creator', async () => {
    const [a, b] = [await creator(), await creator()]
    const id = `UC${Date.now()}`
    const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: null }
    const acc = await linkOAuthAccount(db, a, { platform: 'youtube', profile: profile(id), tokens, encryptionKey: KEY })
    expect(acc).toMatchObject({ status: 'verified', linkMethod: 'oauth', platformUserId: id, followers: 900 })
    expect(decryptTokens(acc.tokenCiphertext!, KEY)).toEqual(tokens)

    // Linking again refreshes the same row.
    const again = await linkOAuthAccount(db, a, {
      platform: 'youtube',
      profile: profile(id),
      tokens,
      encryptionKey: KEY,
    })
    expect(again.id).toBe(acc.id)

    await expect(
      linkOAuthAccount(db, b, { platform: 'youtube', profile: profile(id), tokens, encryptionKey: KEY }),
    ).rejects.toMatchObject({ code: 'linked_elsewhere' })
  })

  it('refreshes an expiring token, and marks the account failed when refresh fails', async () => {
    const me = await creator()
    const now = new Date('2026-10-05T10:00:00Z')
    const acc = await linkOAuthAccount(db, me, {
      platform: 'youtube',
      profile: profile(`UCr${Date.now()}`),
      tokens: { accessToken: 'old', refreshToken: 'rt', expiresAt: '2026-10-05T10:00:30Z' },
      encryptionKey: KEY,
    })
    const token = await accessTokenFor(db, acc, {
      client,
      encryptionKey: KEY,
      now,
      http: fakeFetch(() => ({ access_token: 'new', expires_in: 3600 })),
    })
    expect(token).toBe('new')
    const [stored] = await db.select().from(tables.linkedAccounts).where(eq(tables.linkedAccounts.id, acc.id))
    expect(decryptTokens(stored!.tokenCiphertext!, KEY)).toMatchObject({ accessToken: 'new', refreshToken: 'rt' })

    const expired = {
      ...stored!,
      tokenCiphertext: encryptTokens({ accessToken: 'x', refreshToken: 'rt', expiresAt: '2026-10-05T09:00:00Z' }, KEY),
    }
    const none = await accessTokenFor(db, expired, {
      client,
      encryptionKey: KEY,
      now,
      http: fakeFetch(() => new Response('invalid_grant', { status: 400 })),
    })
    expect(none).toBeNull()
    const [failed] = await db.select().from(tables.linkedAccounts).where(eq(tables.linkedAccounts.id, acc.id))
    expect(failed!.status).toBe('failed')
  })
})
