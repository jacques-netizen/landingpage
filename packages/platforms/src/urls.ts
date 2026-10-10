// Post links to platform and post id (check 2 in 03_SYSTEMS.md section 4). Safe in the browser.
import type { Platform } from './types'

export type ParsedPost = { platform: Platform; platformPostId: string; handle: string | null }

const host = (h: string) => h.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '')

export function parsePostUrl(input: string): ParsedPost | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const h = host(url.hostname)
  const parts = url.pathname.split('/').filter(Boolean)

  if (h === 'tiktok.com') {
    // tiktok.com/@handle/video/7350000000000000000
    if (parts.length >= 3 && parts[0]!.startsWith('@') && parts[1] === 'video' && /^\d{6,25}$/.test(parts[2]!))
      return { platform: 'tiktok', platformPostId: parts[2]!, handle: normalizeHandle(parts[0]!) }
    return null
  }
  if (h === 'instagram.com') {
    // instagram.com/p/CODE, /reel/CODE, /reels/CODE, optionally after a handle
    const i = parts.findIndex((p) => p === 'p' || p === 'reel' || p === 'reels')
    if (i >= 0 && parts[i + 1] && /^[A-Za-z0-9_-]{5,40}$/.test(parts[i + 1]!))
      return {
        platform: 'instagram',
        platformPostId: parts[i + 1]!,
        handle: i === 1 ? normalizeHandle(parts[0]!) : null,
      }
    return null
  }
  if (h === 'youtube.com' || h === 'youtu.be') {
    const id =
      h === 'youtu.be'
        ? parts[0]
        : parts[0] === 'shorts' || parts[0] === 'live'
          ? parts[1]
          : parts[0] === 'watch'
            ? url.searchParams.get('v')
            : undefined
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { platform: 'youtube', platformPostId: id, handle: null }
    return null
  }
  if (h === 'x.com' || h === 'twitter.com') {
    // x.com/handle/status/1790000000000000000
    if (parts.length >= 3 && parts[1] === 'status' && /^\d{6,25}$/.test(parts[2]!))
      return { platform: 'x', platformPostId: parts[2]!, handle: normalizeHandle(parts[0]!) }
    return null
  }
  return null
}

/** "@Name" and "name" are the same account. */
export function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, '').toLowerCase()
}

const HANDLE_RE: Record<Platform, RegExp> = {
  tiktok: /^[a-z0-9._]{2,24}$/,
  instagram: /^[a-z0-9._]{1,30}$/,
  youtube: /^[a-z0-9._-]{3,30}$/,
  x: /^[a-z0-9_]{1,15}$/,
}

export function isValidHandle(platform: Platform, handle: string) {
  return HANDLE_RE[platform].test(normalizeHandle(handle))
}

export function profileUrl(platform: Platform, handle: string) {
  const h = normalizeHandle(handle)
  return {
    tiktok: `https://www.tiktok.com/@${h}`,
    instagram: `https://www.instagram.com/${h}`,
    youtube: `https://www.youtube.com/@${h}`,
    x: `https://x.com/${h}`,
  }[platform]
}

// Share links from the apps (owner's clippers, 2026-10-10): the TikTok app shares vm.tiktok.com/CODE,
// vt.tiktok.com/CODE or tiktok.com/t/CODE; Instagram shares instagram.com/share/...; the mobile site
// uses tiktok.com/v/ID.html. Each answers with a redirect to the full post link. Only these hosts are
// followed, so a link to anywhere else is never fetched from the server.
const SHORT_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com'])

export function isShortPostLink(input: string): boolean {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const h = host(url.hostname)
  if (SHORT_HOSTS.has(h)) return true
  const parts = url.pathname.split('/').filter(Boolean)
  if (h === 'tiktok.com') return parts[0] === 't' || parts[0] === 'v'
  if (h === 'instagram.com') return parts[0] === 'share'
  return false
}

/**
 * The full post link a short share link leads to, following up to 5 redirects between the platform's
 * own hosts. Anything else, a loop, a dead link or a slow answer gives the input back unchanged, and
 * parsePostUrl then says what is wrong.
 */
export async function resolvePostUrl(input: string, http: typeof fetch = fetch): Promise<string> {
  let current = input.trim()
  for (let hop = 0; hop < 5 && isShortPostLink(current); hop++) {
    let next: string | null
    try {
      const res = await http(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; MaisonDElites/1.0)' },
      })
      next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    } catch {
      return input.trim()
    }
    if (!next) return input.trim()
    const resolved = new URL(next, current).toString()
    if (resolved === current) return input.trim()
    current = resolved
  }
  return current
}
