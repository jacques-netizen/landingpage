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
