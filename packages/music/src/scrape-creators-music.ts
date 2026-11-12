// The exact TikTok sound MDE gives clippers, from Scrape Creators (already paid for).
// GET https://api.scrapecreators.com/v1/tiktok/song?clipId=<clip id>, header x-api-key, 1 credit a call
// (https://docs.scrapecreators.com/v1/tiktok/song, opened 2026-11-12). The answer has success and
// music_info { id, id_str, title, author, user_count, is_original, is_original_sound }; user_count is
// "the number of videos using this song". id is a number too large for JavaScript, so id_str is read.
// This call has not run against the live API from this code; the field names are from the docs example.

export const SCRAPE_CREATORS_API = 'https://api.scrapecreators.com'

export type TikTokSoundTotal = {
  musicId: string | null
  title: string | null
  author: string | null
  /** Videos using the sound so far; null when the answer did not say. */
  videoCount: number | null
}

export async function fetchTikTokSoundTotal(
  apiKey: string,
  clipId: string,
  http: typeof fetch = fetch,
  base = SCRAPE_CREATORS_API,
): Promise<TikTokSoundTotal | null> {
  const url = new URL('/v1/tiktok/song', base)
  url.searchParams.set('clipId', clipId)
  const res = await http(url, { headers: { 'x-api-key': apiKey } })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
    throw new Error(`Scrape Creators /v1/tiktok/song returned ${res.status}${text ? `: ${text}` : ''}`)
  }
  const body = (await res.json()) as Record<string, unknown>
  if (body.success === false) return null
  const m = body.music_info as Record<string, unknown> | undefined
  if (!m || typeof m !== 'object') return null
  const count = m.user_count
  return {
    musicId: typeof m.id_str === 'string' && m.id_str ? m.id_str : null,
    title: typeof m.title === 'string' ? m.title : null,
    author: typeof m.author === 'string' ? m.author : null,
    videoCount: typeof count === 'number' && Number.isFinite(count) && count >= 0 ? Math.floor(count) : null,
  }
}
