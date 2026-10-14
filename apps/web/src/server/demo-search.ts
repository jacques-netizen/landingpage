import 'server-only'
import { env } from '@mde/config'
import { SCRAPE_CREATORS_API } from '@mde/platforms'
import type { DemoClip } from './demo-import'

// Clip search for demo campaigns (owner request, 2026-10-14): TikTok, Instagram reels and X by keyword
// through the data provider, with the same key the view checks use. One call per step, so the admin
// page can show progress and stop at the credit limit: a search page costs 1 credit; Instagram reels
// cost 1 more each for their play count, which the reels search does not give.

type Json = Record<string, unknown>
const pick = (o: unknown, ...paths: string[]): unknown => {
  for (const p of paths) {
    let cur: unknown = o
    for (const k of p.split('.')) {
      if (cur && typeof cur === 'object' && k in (cur as Json)) cur = (cur as Json)[k]
      else {
        cur = undefined
        break
      }
    }
    if (cur !== undefined && cur !== null) return cur
  }
  return undefined
}
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null)
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/** Accounts that are not creators: news, broadcasters, shows, media brands, political commentators, the subject's own accounts. */
export const NOT_A_CREATOR =
  /(cnn|msnbc|foxnews|fox ?news|nbc|abc ?news|abc7|cbs|pbs|bbc|sky ?news|cnbc|c-?span|al ?jazeera|reuters|associated ?press|apnews|bloomberg|forbes|politico|thehill|the ?hill|guardian|nytimes|new ?york ?times|washington ?post|wsj|wall ?street|daily ?mail|newsweek|huffpost|nowthis|vice|vox|axios|npr|ny1|spectrum ?news|pix11|news|noticias|tribune|times|herald|journal|gazette|democracy ?now|young ?turks|breaking ?points|meidas|pod ?save|daily ?show|late ?show|colbert|kimmel|fallon|snl|saturday ?night|piers ?morgan|shapiro|daily ?wire|tucker|rogan|maher|60 ?minutes|today ?show|the ?view|zohran|mamdani|mayor|nyc ?gov|cityofnewyork|jubilee|economist|telegraph|independent|insider|buzzfeed|yahoo|msn|media|network|broadcast|global ?news|cbc|ctv|france ?24|euronews|wion|ndtv|middle ?east ?eye|zeteo|more ?perfect ?union|rubin|megyn|freitas|crowder|turning ?point|prageru|hannity|ingraham|maddow|vanity ?fair|rolling ?stone|variety|tmz|comedy ?central|hbo|netflix|brut|ajplus|atlantic|new ?yorker|nymag|gothamist|amny|daily ?news|wnyc|usa ?today|newsnation|bongino|dsa|democrats|gop|dnc|rnc)/i

export type SearchPlatform = 'tiktok' | 'instagram' | 'x'

export type SearchStep = {
  clips: DemoClip[]
  /** Pass back for the next page; null when there are no more. */
  next: string | null
  credits: number
  creditsRemaining: number | null
}

/** Whether a data provider key is set, so the search can run at all. */
export const canSearch = () => !!env().DATA_PROVIDER_API_KEY

export async function searchStep(i: {
  platform: SearchPlatform
  query: string
  cursor: string | null
  mustMention: string[]
  minViews: number
  window: { start: string; end: string }
  /** Instagram reels and X posts on a page to look up in detail (1 credit each). */
  detailFetches?: number
}): Promise<SearchStep> {
  const key = env().DATA_PROVIDER_API_KEY
  if (!key) throw new Error('DATA_PROVIDER_API_KEY is not set on this service.')
  let credits = 0
  let creditsRemaining: number | null = null
  const get = async (path: string, params: Record<string, string>) => {
    const url = new URL(path, process.env.DATA_PROVIDER_API_URL_OVERRIDE ?? SCRAPE_CREATORS_API)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url, { headers: { 'x-api-key': key }, cache: 'no-store' })
    credits++
    if (res.status === 402) throw new Error('The data provider account is out of credits.')
    if (!res.ok) return null
    const body = (await res.json().catch(() => null)) as Json | null
    const left = num(body?.credits_remaining)
    if (left !== null) creditsRemaining = left
    return body
  }
  const start = new Date(i.window.start).getTime()
  const end = new Date(i.window.end).getTime()
  const words = i.mustMention.map((w) => w.trim()).filter(Boolean)
  const mention = words.length ? new RegExp(words.join('|'), 'i') : null
  const keep = (c: DemoClip) => {
    const at = c.publishedAt ? new Date(c.publishedAt).getTime() : NaN
    return (
      at >= start &&
      at < end &&
      c.views >= i.minViews &&
      !NOT_A_CREATOR.test(c.handle) &&
      !NOT_A_CREATOR.test(c.channel.replace(/[_.]/g, ' ')) &&
      (!mention || (c.title !== null && mention.test(c.title)))
    )
  }
  const out: DemoClip[] = []

  if (i.platform === 'tiktok') {
    const body = await get('/v1/tiktok/search/keyword', {
      query: i.query,
      sort_by: 'relevance',
      date_posted: 'all-time',
      ...(i.cursor ? { cursor: i.cursor } : {}),
    })
    const items = (pick(body, 'search_item_list') as unknown[] | undefined) ?? []
    for (const raw of items) {
      const v = (pick(raw, 'aweme_info') ?? raw) as Json
      const id = str(pick(v, 'aweme_id'))
      const handle = str(pick(v, 'author.unique_id'))
      if (!id || !handle || pick(v, 'image_post_info')) continue
      const created = num(pick(v, 'create_time'))
      const clip: DemoClip = {
        platform: 'tiktok',
        url: `https://www.tiktok.com/@${handle}/video/${id}`,
        platformPostId: id,
        handle,
        channel: str(pick(v, 'author.nickname')) ?? handle,
        title: str(pick(v, 'desc')),
        views: num(pick(v, 'statistics.play_count')) ?? 0,
        likes: num(pick(v, 'statistics.digg_count')),
        comments: num(pick(v, 'statistics.comment_count')),
        publishedAt: created ? new Date(created * 1000).toISOString() : null,
        thumbnail: str(pick(v, 'video.cover.url_list.0', 'video.origin_cover.url_list.0')),
      }
      if (keep(clip)) out.push(clip)
    }
    const next = num(pick(body, 'cursor'))
    const more = pick(body, 'has_more')
    return {
      clips: out,
      next: items.length && next !== null && more !== false && more !== 0 ? String(next) : null,
      credits,
      creditsRemaining,
    }
  }

  if (i.platform === 'x') {
    // X search gives the post, its views and text, but not its media: the most viewed posts on the page
    // are looked up (1 credit each) to keep only those with a video.
    const body = await get('/v1/twitter/search/posts', { query: i.query, ...(i.cursor ? { cursor: i.cursor } : {}) })
    const items = (pick(body, 'posts', 'tweets') as unknown[] | undefined) ?? []
    const candidates = items
      .map((t) => {
        const url = str(pick(t, 'url'))
        const created = str(pick(t, 'legacy.created_at'))
        return {
          id: str(pick(t, 'rest_id', 'legacy.id_str')),
          handle: url?.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status/)?.[1] ?? null,
          text: str(pick(t, 'legacy.full_text')),
          views: num(pick(t, 'views.count')) ?? 0,
          at: created && !Number.isNaN(Date.parse(created)) ? Date.parse(created) : NaN,
        }
      })
      .filter(
        (t) =>
          t.id &&
          t.handle &&
          t.views >= i.minViews &&
          t.at >= start &&
          t.at < end &&
          !NOT_A_CREATOR.test(t.handle) &&
          (!mention || (t.text !== null && mention.test(t.text))),
      )
      .sort((a, b) => b.views - a.views)
      .slice(0, i.detailFetches ?? 6)
    for (const c of candidates) {
      const b = await get('/v1/twitter/tweet', { url: `https://x.com/${c.handle}/status/${c.id}` })
      const t = (pick(b, 'tweet', 'data.tweetResult.result', 'result') as Json | undefined) ?? b ?? undefined
      const media = pick(t, 'legacy.extended_entities.media', 'legacy.entities.media') as unknown[] | undefined
      const first = media?.find((m) => ['video', 'animated_gif'].includes(str(pick(m, 'type')) ?? ''))
      if (!t || !first) continue
      const clip: DemoClip = {
        platform: 'x',
        url: `https://x.com/${c.handle}/status/${c.id}`,
        platformPostId: c.id!,
        handle: c.handle!,
        channel:
          str(pick(t, 'core.user_results.result.core.name', 'core.user_results.result.legacy.name')) ?? c.handle!,
        title: c.text,
        views: num(pick(t, 'views.count')) ?? c.views,
        likes: num(pick(t, 'legacy.favorite_count')),
        comments: num(pick(t, 'legacy.reply_count')),
        publishedAt: new Date(c.at).toISOString(),
        thumbnail: str(pick(first, 'media_url_https')),
      }
      if (keep(clip)) out.push(clip)
    }
    const raw = pick(body, 'cursor')
    const next = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : null
    return { clips: out, next: items.length ? next : null, credits, creditsRemaining }
  }

  // Instagram reels: the search gives likes but no plays, so the best liked reels on the page are fetched.
  const page = Number(i.cursor ?? '1')
  const body = await get('/v2/instagram/reels/search', { query: i.query, page: String(page) })
  const items = (pick(body, 'reels', 'posts') as unknown[] | undefined) ?? []
  const candidates = items
    .map((r) => ({
      shortcode: str(pick(r, 'shortcode', 'code')),
      handle: str(pick(r, 'owner.username')),
      name: str(pick(r, 'owner.full_name')),
      caption: str(pick(r, 'caption')),
      likes: num(pick(r, 'like_count')) ?? 0,
      taken: ((v: unknown) => (typeof v === 'number' ? v * 1000 : typeof v === 'string' ? Date.parse(v) : NaN))(
        pick(r, 'taken_at'),
      ),
      video: pick(r, 'is_video') !== false,
    }))
    .filter(
      (r) =>
        r.shortcode &&
        r.handle &&
        r.video &&
        !NOT_A_CREATOR.test(r.handle) &&
        !NOT_A_CREATOR.test((r.name ?? '').replace(/[_.]/g, ' ')) &&
        (!mention || (r.caption !== null && mention.test(r.caption))) &&
        (Number.isNaN(r.taken) || (r.taken >= start && r.taken < end)),
    )
    .sort((a, b) => b.likes - a.likes)
    .slice(0, i.detailFetches ?? 8)
  for (const r of candidates) {
    const post = await get('/v1/instagram/post', { url: `https://www.instagram.com/reel/${r.shortcode}/` })
    const m = (pick(post, 'data.xdt_shortcode_media', 'data.shortcode_media', 'xdt_shortcode_media') ??
      null) as Json | null
    if (!m) continue
    const handle = str(pick(m, 'owner.username')) ?? r.handle!
    const taken = num(pick(m, 'taken_at_timestamp')) ?? (Number.isNaN(r.taken) ? null : r.taken / 1000)
    const clip: DemoClip = {
      platform: 'instagram',
      url: `https://www.instagram.com/reel/${r.shortcode}/`,
      platformPostId: r.shortcode!,
      handle,
      channel: str(pick(m, 'owner.full_name')) ?? handle,
      title: str(pick(m, 'edge_media_to_caption.edges.0.node.text')) ?? r.caption,
      views: num(pick(m, 'video_play_count', 'video_view_count')) ?? 0,
      likes: num(pick(m, 'edge_media_preview_like.count', 'edge_liked_by.count')) ?? r.likes,
      comments: num(pick(m, 'edge_media_to_parent_comment.count', 'edge_media_to_comment.count')),
      publishedAt: taken ? new Date(taken * 1000).toISOString() : null,
      thumbnail: str(pick(m, 'thumbnail_src', 'display_url')),
    }
    if (keep(clip)) out.push(clip)
  }
  return { clips: out, next: items.length && page < 11 ? String(page + 1) : null, credits, creditsRemaining }
}
