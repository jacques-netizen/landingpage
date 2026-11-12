// Song and sound links to ids (music tracking, owner 2026-11-12). Safe in the browser.
// Each parser returns null for anything it does not recognise, so the form can say which link is wrong.

function url(input: string): URL | null {
  try {
    const u = new URL(input.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}
const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')

/** open.spotify.com/track/<22 character id>, with or without ?si= or a locale part (/intl-fr/track/...). */
export function parseSpotifyTrackId(input: string): string | null {
  const s = input.trim()
  const uri = s.match(/^spotify:track:([A-Za-z0-9]{22})$/)
  if (uri) return uri[1]!
  const u = url(s)
  if (!u || host(u) !== 'open.spotify.com') return null
  const parts = u.pathname.split('/').filter(Boolean)
  const i = parts.indexOf('track')
  const id = i >= 0 ? parts[i + 1] : undefined
  return id && /^[A-Za-z0-9]{22}$/.test(id) ? id : null
}

/** open.spotify.com/artist/<22 character id>. */
export function parseSpotifyArtistId(input: string): string | null {
  const u = url(input)
  if (!u || host(u) !== 'open.spotify.com') return null
  const parts = u.pathname.split('/').filter(Boolean)
  const i = parts.indexOf('artist')
  const id = i >= 0 ? parts[i + 1] : undefined
  return id && /^[A-Za-z0-9]{22}$/.test(id) ? id : null
}

/**
 * The clip id of a TikTok sound: the number at the end of tiktok.com/music/<name>-<id>. Scrape Creators'
 * song details call takes this number as clipId (https://docs.scrapecreators.com/v1/tiktok/song).
 */
export function parseTikTokClipId(input: string): string | null {
  const u = url(input)
  if (!u || host(u) !== 'tiktok.com') return null
  const parts = u.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'music' || !parts[1]) return null
  const m = decodeURIComponent(parts[1]).match(/(?:^|-)(\d{6,25})$/)
  return m ? m[1]! : null
}

/** The audio id in instagram.com/reels/audio/<id>/. */
export function parseInstagramAudioId(input: string): string | null {
  const u = url(input)
  if (!u || host(u) !== 'instagram.com') return null
  const parts = u.pathname.split('/').filter(Boolean)
  const i = parts.indexOf('audio')
  const id = i >= 0 ? parts[i + 1] : undefined
  return id && /^\d{6,25}$/.test(id) ? id : null
}

/** youtube.com/watch?v=<id>, youtu.be/<id>, youtube.com/shorts/<id>. */
export function parseYouTubeVideoId(input: string): string | null {
  const u = url(input)
  if (!u) return null
  const h = host(u)
  const parts = u.pathname.split('/').filter(Boolean)
  const id =
    h === 'youtu.be'
      ? parts[0]
      : h === 'youtube.com' || h === 'music.youtube.com'
        ? parts[0] === 'shorts'
          ? parts[1]
          : u.searchParams.get('v')
        : undefined
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/** An ISRC: two letters, three letters or digits, two digits, five digits. Dashes and spaces are dropped. */
export function parseIsrc(input: string): string | null {
  const s = input.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(s) ? s : null
}

/** "FR, ng za" to ["FR", "NG", "ZA"]; null when any part is not a two letter code. */
export function parseCountries(input: string): string[] | null {
  const parts = input
    .split(/[\s,]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
  if (parts.some((p) => !/^[A-Z]{2}$/.test(p))) return null
  return [...new Set(parts)]
}
