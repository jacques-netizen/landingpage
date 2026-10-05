// YouTube Data API v3 (03_SYSTEMS.md 3.1, provider 2). Public data with an API key; the creator's own
// channel with their OAuth token (scope youtube.readonly). Checked against the API reference, October 2026.
import type { LinkMethod, Platform, PostData, ProfileData, ViewProvider } from './types'
import { normalizeHandle } from './urls'

export const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

type Fetch = typeof fetch

type Channel = {
  id: string
  snippet?: { description?: string; publishedAt?: string; customUrl?: string; title?: string }
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean }
}

type Video = {
  id: string
  snippet?: {
    channelId?: string
    publishedAt?: string
    title?: string
    description?: string
    thumbnails?: Record<string, { url: string } | undefined>
  }
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
  contentDetails?: { duration?: string }
  status?: { privacyStatus?: string; publicStatsViewable?: boolean }
}

const num = (v: string | undefined) => (v === undefined ? null : Number(v))

/** ISO 8601 durations like PT1M5S or P0DT1H, in whole seconds. */
export function parseIsoDuration(d: string | undefined): number | null {
  if (!d) return null
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(d)
  if (!m) return null
  const [, days, h, min, s] = m.map((x) => Number(x ?? 0))
  return days! * 86400 + h! * 3600 + min! * 60 + s!
}

export class YouTubeApiProvider implements ViewProvider {
  name = 'youtube'
  constructor(
    private apiKey: string | undefined,
    private http: Fetch = fetch,
    private base = YOUTUBE_API,
  ) {}

  supports(platform: Platform, _method: LinkMethod) {
    return platform === 'youtube'
  }

  private async get<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
    const url = new URL(`${this.base}/${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    if (!token) {
      if (!this.apiKey) throw new Error('YOUTUBE_API_KEY is not set')
      url.searchParams.set('key', this.apiKey)
    }
    const res = await this.http(url, { headers: token ? { authorization: `Bearer ${token}` } : {} })
    if (!res.ok) throw new Error(`YouTube API ${path} returned ${res.status}`)
    return (await res.json()) as T
  }

  async fetchProfile(input: { platform: Platform; handle?: string; platformUserId?: string; token?: string }) {
    const filter: Record<string, string> = input.token
      ? { mine: 'true' }
      : input.platformUserId
        ? { id: input.platformUserId }
        : input.handle
          ? { forHandle: `@${normalizeHandle(input.handle)}` }
          : {}
    if (!Object.keys(filter).length) return null
    const data = await this.get<{ items?: Channel[] }>(
      'channels',
      { part: 'snippet,statistics', ...filter },
      input.token,
    )
    const c = data.items?.[0]
    if (!c) return null
    return {
      platformUserId: c.id,
      handle: normalizeHandle(c.snippet?.customUrl ?? input.handle ?? c.id),
      followers: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount),
      bio: c.snippet?.description ?? null,
      // The API only returns channels anyone can see.
      isPublic: true,
      createdAt: c.snippet?.publishedAt ? new Date(c.snippet.publishedAt) : null,
    } satisfies ProfileData
  }

  async fetchPost(input: { platform: Platform; postUrl: string; platformPostId?: string; token?: string }) {
    const none: PostData = {
      exists: false,
      isPublic: false,
      views: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      publishedAt: null,
      durationSeconds: null,
      caption: null,
      authorPlatformUserId: null,
      thumbnailUrl: null,
      rawRef: null,
    }
    if (!input.platformPostId) return none
    const data = await this.get<{ items?: Video[] }>(
      'videos',
      { part: 'snippet,statistics,contentDetails,status', id: input.platformPostId },
      input.token,
    )
    const v = data.items?.[0]
    if (!v) return { ...none, rawRef: { id: input.platformPostId, found: false } }
    // Unlisted and private videos are not public posts. Hidden stats count as stats not visible.
    const isPublic = v.status?.privacyStatus === 'public'
    const statsVisible = v.status?.publicStatsViewable !== false
    const s = v.snippet ?? {}
    return {
      exists: true,
      isPublic,
      views: statsVisible ? num(v.statistics?.viewCount) : null,
      likes: statsVisible ? num(v.statistics?.likeCount) : null,
      comments: num(v.statistics?.commentCount),
      shares: null,
      saves: null,
      publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
      durationSeconds: parseIsoDuration(v.contentDetails?.duration),
      // Title and description are what viewers see. Tags are hidden keywords, not hashtags.
      caption: [s.title, s.description].filter(Boolean).join('\n') || null,
      authorPlatformUserId: s.channelId ?? null,
      thumbnailUrl: s.thumbnails?.high?.url ?? s.thumbnails?.default?.url ?? null,
      rawRef: { id: v.id, privacyStatus: v.status?.privacyStatus },
    } satisfies PostData
  }
}
