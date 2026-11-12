// Does a clip use the campaign's official sound? (build proposal section 5, job 5). Pure.
// The sound comes from the post data the view check already fetches: Scrape Creators' TikTok video answer
// carries aweme_detail.music { id_str, title, is_original_sound }
// (https://docs.scrapecreators.com/v2/tiktok/video, opened 2026-11-12).

export type PostSound = { id: string | null; title: string | null; isOriginal: boolean | null }
export type SoundCheckStatus = 'matched' | 'original_sound' | 'different_sound' | 'not_checked'

/**
 * The official sound is known by the clip id in its link and, once the song details call ran, by the
 * music id Scrape Creators reported for it. Whether a video's music id equals the clip id in the sound's
 * link is not confirmed by the docs (their two examples differ), so both are accepted.
 */
export function soundCheckStatus(
  sound: PostSound | null | undefined,
  official: { tiktokClipId: string | null; tiktokMusicId: string | null },
): SoundCheckStatus {
  if (!sound || !sound.id) return 'not_checked'
  const ids = [official.tiktokClipId, official.tiktokMusicId].filter((x): x is string => !!x)
  if (!ids.length) return 'not_checked'
  if (ids.includes(sound.id)) return 'matched'
  if (sound.isOriginal === true) return 'original_sound'
  return 'different_sound'
}

export const SOUND_CHECK_LABEL: Record<SoundCheckStatus, string> = {
  matched: 'Uses the official sound',
  original_sound: 'Uses its own original sound, not the official one',
  different_sound: 'Uses a different sound',
  not_checked: 'Sound not checked: the platform gave no sound',
}
