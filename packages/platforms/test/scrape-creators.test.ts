import { describe, expect, it } from 'vitest'
import { ProviderRouter, ScrapeCreatorsProvider, pick } from '../src'

type Route = (url: URL) => unknown
function provider(route: Route, calls: URL[] = []) {
  const http = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push(url)
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('sc-key')
    const body = route(url)
    return body instanceof Response ? body : new Response(JSON.stringify(body), { status: 200 })
  }) as typeof fetch
  return new ScrapeCreatorsProvider('sc-key', http)
}

describe('Scrape Creators provider', () => {
  it('only serves bio code accounts on TikTok, Instagram and X', () => {
    const p = provider(() => ({}))
    expect(p.supports('tiktok', 'bio_code')).toBe(true)
    expect(p.supports('x', 'bio_code')).toBe(true)
    expect(p.supports('youtube', 'bio_code')).toBe(false)
    expect(p.supports('instagram', 'oauth')).toBe(false)
  })

  it('reads a TikTok profile', async () => {
    const calls: URL[] = []
    const p = provider(
      () => ({
        success: true,
        user: {
          id: '6789',
          uniqueId: 'Maya.Clips',
          signature: 'clips daily MDE-7K4Q',
          privateAccount: false,
          createTime: 1609459200,
        },
        stats: { followerCount: 12400 },
      }),
      calls,
    )
    expect(await p.fetchProfile({ platform: 'tiktok', handle: '@Maya.Clips' })).toEqual({
      platformUserId: '6789',
      handle: 'Maya.Clips',
      followers: 12400,
      bio: 'clips daily MDE-7K4Q',
      isPublic: true,
      createdAt: new Date('2021-01-01T00:00:00Z'),
    })
    expect(calls[0]!.pathname).toBe('/v1/tiktok/profile')
    expect(calls[0]!.searchParams.get('handle')).toBe('maya.clips')
  })

  it('reads Instagram and X profiles, and marks private accounts', async () => {
    const ig = provider(() => ({
      data: {
        user: { id: '55', username: 'maya', biography: 'hi', edge_followed_by: { count: 3000 }, is_private: true },
      },
    }))
    expect(await ig.fetchProfile({ platform: 'instagram', handle: 'maya' })).toMatchObject({
      platformUserId: '55',
      followers: 3000,
      isPublic: false,
      createdAt: null,
    })
    const x = provider(() => ({
      rest_id: '221838349',
      legacy: {
        screen_name: 'Maya',
        description: 'MDE-7K4Q',
        followers_count: 377608,
        created_at: 'Wed Dec 01 19:13:23 +0000 2010',
      },
    }))
    expect(await x.fetchProfile({ platform: 'x', handle: 'maya' })).toMatchObject({
      platformUserId: '221838349',
      handle: 'Maya',
      followers: 377608,
      bio: 'MDE-7K4Q',
      isPublic: true,
      createdAt: new Date('2010-12-01T19:13:23Z'),
    })
  })

  it('returns null for an account that does not exist', async () => {
    expect(
      await provider(() => new Response('{}', { status: 404 })).fetchProfile({ platform: 'tiktok', handle: 'nobody' }),
    ).toBeNull()
    expect(
      await provider(() => ({ success: false, message: 'User not found' })).fetchProfile({
        platform: 'x',
        handle: 'nobody',
      }),
    ).toBeNull()
  })

  it('reads a TikTok video, converting milliseconds and keeping unknowns as null', async () => {
    const calls: URL[] = []
    const p = provider(
      () => ({
        aweme_detail: {
          aweme_id: '7350123456789012345',
          desc: 'new clip #ad #client',
          create_time: 1759658400,
          author: { uid: '6789', unique_id: 'maya' },
          video: { duration: 28500, cover: { url_list: ['https://p16.tiktokcdn.com/cover.jpg'] } },
          statistics: { play_count: 48210, digg_count: 3100, comment_count: 120, share_count: 40, collect_count: 9 },
          status: { private_status: 0 },
        },
      }),
      calls,
    )
    const url = 'https://www.tiktok.com/@maya/video/7350123456789012345'
    const v = await p.fetchPost({ platform: 'tiktok', postUrl: url })
    expect(v).toMatchObject({
      exists: true,
      isPublic: true,
      views: 48210,
      likes: 3100,
      comments: 120,
      shares: 40,
      saves: 9,
      durationSeconds: 28,
      caption: 'new clip #ad #client',
      authorPlatformUserId: '6789',
      thumbnailUrl: 'https://p16.tiktokcdn.com/cover.jpg',
    })
    expect(v.publishedAt?.toISOString()).toBe('2025-10-05T10:00:00.000Z')
    expect(calls[0]!.searchParams.get('url')).toBe(url)
  })

  it('reads an Instagram reel and an X post', async () => {
    const ig = provider(() => ({
      data: {
        xdt_shortcode_media: {
          shortcode: 'C5abcDEF123',
          owner: { id: '55', username: 'maya' },
          taken_at_timestamp: 1759658400,
          video_duration: 31.4,
          video_play_count: 9000,
          video_view_count: 4000,
          edge_media_preview_like: { count: 800 },
          edge_media_to_parent_comment: { count: 12 },
          edge_media_to_caption: { edges: [{ node: { text: 'reel #ad' } }] },
          thumbnail_src: 'https://scontent.cdninstagram.com/t.jpg',
        },
      },
    }))
    expect(
      await ig.fetchPost({ platform: 'instagram', postUrl: 'https://www.instagram.com/reel/C5abcDEF123/' }),
    ).toMatchObject({
      exists: true,
      views: 9000,
      likes: 800,
      comments: 12,
      durationSeconds: 31,
      caption: 'reel #ad',
      authorPlatformUserId: '55',
    })

    const x = provider(() => ({
      rest_id: '1790000000000000001',
      core: { user_results: { result: { rest_id: '221838349' } } },
      views: { count: '15200' },
      legacy: {
        created_at: 'Sun Oct 05 10:00:00 +0000 2025',
        full_text: 'clip #ad',
        favorite_count: 300,
        reply_count: 20,
        retweet_count: 10,
        quote_count: 5,
        bookmark_count: 7,
      },
    }))
    expect(
      await x.fetchPost({ platform: 'x', postUrl: 'https://x.com/maya/status/1790000000000000001' }),
    ).toMatchObject({
      exists: true,
      views: 15200,
      likes: 300,
      comments: 20,
      shares: 15,
      saves: 7,
      authorPlatformUserId: '221838349',
      caption: 'clip #ad',
    })
  })

  it('treats a missing post as gone and an outage or empty credits as an error the router reports', async () => {
    const gone = await provider(() => new Response('{}', { status: 404 })).fetchPost({
      platform: 'tiktok',
      postUrl: 'u',
    })
    expect(gone.exists).toBe(false)
    const router = new ProviderRouter([provider(() => new Response('{}', { status: 402 }))], {
      backoffMs: 1,
      log: () => {},
    })
    await expect(router.fetchProfile('bio_code', { platform: 'tiktok', handle: 'maya' })).rejects.toThrow(
      /No provider could/,
    )
  })

  it('picks the first path that has a value', () => {
    expect(pick({ a: { b: [{ c: 1 }] } }, 'x.y', 'a.b.0.c')).toBe(1)
    expect(pick({ a: null }, 'a.b')).toBeUndefined()
  })
})
