import { describe, expect, it } from 'vitest'
import { MockProvider, ProviderRouter, ProviderUnavailable, type ViewProvider } from '../src'

const quiet = { backoffMs: 1, log: () => {} }

describe('provider router', () => {
  it('falls back to the next provider when one fails every attempt', async () => {
    let calls = 0
    const broken: ViewProvider = {
      name: 'broken',
      supports: () => true,
      fetchProfile: async () => {
        calls++
        throw new Error('503')
      },
      fetchPost: async () => {
        throw new Error('503')
      },
    }
    const router = new ProviderRouter([broken, new MockProvider(() => ({}))], quiet)
    const p = await router.fetchProfile('bio_code', { platform: 'tiktok', handle: 'maya' })
    expect(p?.platformUserId).toBe('mock-tiktok-maya')
    expect(calls).toBe(3)
  })

  it('skips providers that do not support the platform and method', async () => {
    const youtubeOnly: ViewProvider = {
      name: 'yt',
      supports: (platform) => platform === 'youtube',
      fetchProfile: async () => {
        throw new Error('should not be called')
      },
      fetchPost: async () => {
        throw new Error('should not be called')
      },
    }
    const router = new ProviderRouter([youtubeOnly], quiet)
    await expect(router.fetchProfile('bio_code', { platform: 'x', handle: 'maya' })).rejects.toBeInstanceOf(
      ProviderUnavailable,
    )
  })

  it('times out a provider that never answers', async () => {
    const hanging: ViewProvider = {
      name: 'hang',
      supports: () => true,
      fetchProfile: () => new Promise(() => {}),
      fetchPost: () => new Promise(() => {}),
    }
    const router = new ProviderRouter([hanging], { ...quiet, timeoutMs: 20, attempts: 2 })
    await expect(
      router.fetchPost('bio_code', { platform: 'x', postUrl: 'https://x.com/a/status/1234567' }),
    ).rejects.toBeInstanceOf(ProviderUnavailable)
  })

  it('the mock returns scripted posts and a missing post otherwise', async () => {
    const mock = new MockProvider(() => ({
      posts: {
        'tiktok:7350123456789012345': { views: 1200, authorPlatformUserId: 'u1', publishedAt: '2026-10-01T10:00:00Z' },
      },
    }))
    const hit = await mock.fetchPost({
      platform: 'tiktok',
      postUrl: 'https://www.tiktok.com/@a/video/7350123456789012345',
    })
    expect(hit).toMatchObject({ exists: true, isPublic: true, views: 1200, authorPlatformUserId: 'u1' })
    expect(hit.publishedAt?.toISOString()).toBe('2026-10-01T10:00:00.000Z')
    const miss = await mock.fetchPost({
      platform: 'tiktok',
      postUrl: 'https://www.tiktok.com/@a/video/7350000000000000000',
    })
    expect(miss.exists).toBe(false)
  })
})
