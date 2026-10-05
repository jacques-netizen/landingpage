// ThirdPartyDataProvider (03_SYSTEMS.md 3.1, provider 5): public profile and post data for accounts
// linked by bio code on TikTok, Instagram and X, from Scrape Creators (https://docs.scrapecreators.com).
// Chosen by the owner's go-ahead: one key for all three platforms, pay per request, public data only.
// Their responses wrap platform data in several shapes, so fields are read defensively and a missing
// field becomes null (unknown), never zero.
import type { LinkMethod, Platform, PostData, ProfileData, ViewProvider } from './types'
import { normalizeHandle } from './urls'

export const SCRAPE_CREATORS_API = 'https://api.scrapecreators.com'

type Json = Record<string, unknown>

/** The first value found at any of the dotted paths. */
export function pick(obj: unknown, ...paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = obj
    for (const k of p.split('.')) {
      if (cur === null || cur === undefined) break
      cur = Array.isArray(cur) && /^\d+$/.test(k) ? cur[Number(k)] : (cur as Json)[k]
    }
    if (cur !== undefined && cur !== null) return cur
  }
  return undefined
}

const int = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v))
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
  return null
}
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length ? v : typeof v === 'number' ? String(v) : null
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
/** Unix seconds, or a date string. */
const date = (v: unknown): Date | null => {
  if (typeof v === 'number' && v > 0) return new Date(v * 1000)
  if (typeof v === 'string' && /^\d+$/.test(v)) return new Date(Number(v) * 1000)
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const GONE: PostData = {
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

export class ScrapeCreatorsProvider implements ViewProvider {
  name = 'scrape-creators'
  constructor(
    private apiKey: string,
    private http: typeof fetch = fetch,
    private base = SCRAPE_CREATORS_API,
  ) {}

  supports(platform: Platform, method: LinkMethod) {
    return method === 'bio_code' && (platform === 'tiktok' || platform === 'instagram' || platform === 'x')
  }

  /** null when the platform says the account or post does not exist. */
  private async get(path: string, params: Record<string, string>): Promise<Json | null> {
    const url = new URL(path, this.base)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await this.http(url, { headers: { 'x-api-key': this.apiKey } })
    if (res.status === 404) return null
    // 402 means the account is out of credits: an outage, so the router retries and reports it.
    if (!res.ok) throw new Error(`Scrape Creators ${url.pathname} returned ${res.status}`)
    const body = (await res.json()) as Json
    if (body.success === false) {
      const msg = String(body.message ?? body.error ?? '')
      if (/not found|does not exist|no user|unavailable|deleted|private/i.test(msg)) return null
      throw new Error(`Scrape Creators ${url.pathname} failed: ${msg || 'unknown error'}`)
    }
    return body
  }

  async fetchProfile(input: {
    platform: Platform
    handle?: string
    platformUserId?: string
  }): Promise<ProfileData | null> {
    if (!input.handle) return null
    const handle = normalizeHandle(input.handle)
    if (input.platform === 'tiktok') {
      const b = await this.get('/v1/tiktok/profile', { handle })
      if (!b) return null
      const id = str(pick(b, 'user.id', 'userInfo.user.id'))
      if (!id) return null
      return {
        platformUserId: id,
        handle: str(pick(b, 'user.uniqueId', 'userInfo.user.uniqueId')) ?? handle,
        followers: int(pick(b, 'stats.followerCount', 'statsV2.followerCount', 'userInfo.stats.followerCount')),
        bio: str(pick(b, 'user.signature', 'userInfo.user.signature')),
        isPublic: bool(pick(b, 'user.privateAccount', 'userInfo.user.privateAccount')) !== true,
        createdAt: date(pick(b, 'user.createTime', 'userInfo.user.createTime')),
      }
    }
    if (input.platform === 'instagram') {
      const b = await this.get('/v1/instagram/profile', { handle })
      if (!b) return null
      const id = str(pick(b, 'data.user.id', 'user.id'))
      if (!id) return null
      return {
        platformUserId: id,
        handle: str(pick(b, 'data.user.username', 'user.username')) ?? handle,
        followers: int(
          pick(b, 'data.user.edge_followed_by.count', 'user.edge_followed_by.count', 'data.user.follower_count'),
        ),
        bio: str(pick(b, 'data.user.biography', 'user.biography')),
        isPublic: bool(pick(b, 'data.user.is_private', 'user.is_private')) !== true,
        // Instagram does not show when an account was made.
        createdAt: null,
      }
    }
    if (input.platform === 'x') {
      const b = await this.get('/v1/twitter/profile', { handle })
      if (!b) return null
      const id = str(pick(b, 'rest_id', 'data.user.result.rest_id', 'user.rest_id'))
      if (!id) return null
      return {
        platformUserId: id,
        handle: str(pick(b, 'legacy.screen_name', 'core.screen_name', 'screen_name')) ?? handle,
        followers: int(pick(b, 'legacy.followers_count', 'followers_count')),
        bio: str(pick(b, 'legacy.description', 'description')),
        isPublic: bool(pick(b, 'legacy.protected', 'privacy.protected', 'protected')) !== true,
        createdAt: date(pick(b, 'legacy.created_at', 'core.created_at', 'created_at')),
      }
    }
    return null
  }

  async fetchPost(input: { platform: Platform; postUrl: string; platformPostId?: string }): Promise<PostData> {
    if (input.platform === 'tiktok') {
      const b = await this.get('/v2/tiktok/video', { url: input.postUrl })
      const v = pick(b, 'aweme_detail', 'aweme_details.0') as Json | undefined
      if (!b || !v) return { ...GONE, rawRef: { platform: 'tiktok', id: input.platformPostId } }
      const durationMs = int(pick(v, 'video.duration', 'duration'))
      const privateStatus = int(pick(v, 'status.private_status'))
      return {
        exists: true,
        isPublic: !privateStatus,
        views: int(pick(v, 'statistics.play_count')),
        likes: int(pick(v, 'statistics.digg_count')),
        comments: int(pick(v, 'statistics.comment_count')),
        shares: int(pick(v, 'statistics.share_count')),
        saves: int(pick(v, 'statistics.collect_count')),
        publishedAt: date(pick(v, 'create_time')),
        // TikTok gives milliseconds.
        durationSeconds: durationMs === null ? null : Math.floor(durationMs / 1000),
        caption: str(pick(v, 'desc')),
        authorPlatformUserId: str(pick(v, 'author.uid', 'author.id')),
        thumbnailUrl: str(pick(v, 'video.cover.url_list.0', 'video.origin_cover.url_list.0')),
        rawRef: { platform: 'tiktok', id: str(pick(v, 'aweme_id')) },
      }
    }
    if (input.platform === 'instagram') {
      const b = await this.get('/v1/instagram/post', { url: input.postUrl })
      const m = pick(b, 'data.xdt_shortcode_media', 'data.shortcode_media', 'xdt_shortcode_media') as Json | undefined
      if (!b || !m) return { ...GONE, rawRef: { platform: 'instagram', id: input.platformPostId } }
      const duration = pick(m, 'video_duration')
      return {
        exists: true,
        // A post this service can read is public; private accounts return nothing.
        isPublic: true,
        // Instagram shows plays for reels and views for older videos.
        views: int(pick(m, 'video_play_count', 'video_view_count')),
        likes: int(pick(m, 'edge_media_preview_like.count', 'edge_liked_by.count')),
        comments: int(pick(m, 'edge_media_to_parent_comment.count', 'edge_media_to_comment.count')),
        shares: null,
        saves: null,
        publishedAt: date(pick(m, 'taken_at_timestamp')),
        durationSeconds: typeof duration === 'number' ? Math.floor(duration) : null,
        caption: str(pick(m, 'edge_media_to_caption.edges.0.node.text')),
        authorPlatformUserId: str(pick(m, 'owner.id')),
        thumbnailUrl: str(pick(m, 'thumbnail_src', 'display_url')),
        rawRef: { platform: 'instagram', id: str(pick(m, 'shortcode')) },
      }
    }
    if (input.platform === 'x') {
      const b = await this.get('/v1/twitter/tweet', { url: input.postUrl })
      const t = (pick(b, 'tweet', 'data.tweetResult.result', 'result') as Json | undefined) ?? b ?? undefined
      if (!b || !t || !pick(t, 'rest_id', 'legacy.id_str'))
        return { ...GONE, rawRef: { platform: 'x', id: input.platformPostId } }
      const durationMs = int(pick(t, 'legacy.extended_entities.media.0.video_info.duration_millis'))
      return {
        exists: true,
        isPublic: true,
        views: int(pick(t, 'views.count')),
        likes: int(pick(t, 'legacy.favorite_count')),
        comments: int(pick(t, 'legacy.reply_count')),
        shares:
          int(pick(t, 'legacy.retweet_count')) === null
            ? null
            : (int(pick(t, 'legacy.retweet_count')) ?? 0) + (int(pick(t, 'legacy.quote_count')) ?? 0),
        saves: int(pick(t, 'legacy.bookmark_count')),
        publishedAt: date(pick(t, 'legacy.created_at')),
        durationSeconds: durationMs === null ? null : Math.floor(durationMs / 1000),
        caption: str(pick(t, 'legacy.full_text', 'note_tweet.note_tweet_results.result.text')),
        authorPlatformUserId: str(pick(t, 'core.user_results.result.rest_id', 'legacy.user_id_str')),
        thumbnailUrl: str(
          pick(t, 'legacy.extended_entities.media.0.media_url_https', 'legacy.entities.media.0.media_url_https'),
        ),
        rawRef: { platform: 'x', id: str(pick(t, 'rest_id', 'legacy.id_str')) },
      }
    }
    return { ...GONE }
  }
}
