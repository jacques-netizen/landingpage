'use server'

import { env } from '@mde/config'
import { db, getSetting, updateSetting } from '@mde/db'
import {
  addChartEntry,
  addManualMetric,
  buildMusicProvider,
  confirmTrackMatch,
  deleteManualMetric,
  matchTrack,
  saveMusicSetup,
} from '@mde/music'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

// Music tracking on the campaign's Music tab (owner, 2026-11-12). What staff set here feeds the client
// report, so it is finance and admin only, like the report link. Every change is audited by @mde/music.

export type MusicFormState = { ok?: string; error?: string; fields?: Record<string, string> }

const text = (f: FormData, k: string) => String(f.get(k) ?? '')

export async function saveMusicSetupAction(
  campaignId: string,
  trackId: string | null,
  _prev: MusicFormState,
  f: FormData,
): Promise<MusicFormState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=music`)
  const r = await saveMusicSetup(db(), viewer.id, campaignId, {
    trackId,
    artistName: text(f, 'artistName'),
    spotifyArtistUrl: text(f, 'spotifyArtistUrl'),
    tiktokHandle: text(f, 'tiktokHandle'),
    instagramHandle: text(f, 'instagramHandle'),
    youtubeChannelId: text(f, 'youtubeChannelId'),
    s4aAccessStatus: text(f, 's4aAccessStatus'),
    amfaAccessStatus: text(f, 'amfaAccessStatus'),
    title: text(f, 'title'),
    spotifyTrackUrl: text(f, 'spotifyTrackUrl'),
    isrc: text(f, 'isrc'),
    tiktokSoundUrl: text(f, 'tiktokSoundUrl'),
    instagramAudioUrl: text(f, 'instagramAudioUrl'),
    youtubeVideoUrl: text(f, 'youtubeVideoUrl'),
    releaseDate: text(f, 'releaseDate'),
    launchDate: text(f, 'launchDate'),
    targetCountries: text(f, 'targetCountries'),
    baselineDays: text(f, 'baselineDays'),
    soundRule: text(f, 'soundRule'),
  })
  if (!r.ok) return { error: 'Check the fields marked below.', fields: r.errors }
  // With a provider switched on, ask it which song this is straight away, for staff to confirm.
  const provider = buildMusicProvider(env())
  let matched = ''
  if (provider.name !== 'none') {
    try {
      const m = await matchTrack(db(), viewer.id, r.trackId, provider)
      matched = m.ok
        ? ` The provider found "${m.title}"${m.artist ? ` by ${m.artist}` : ''}. Confirm it below.`
        : ` ${m.message}`
    } catch (e) {
      matched = ` The provider could not be asked (${e instanceof Error ? e.message : String(e)}). Try "Find the song" again later.`
    }
  }
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: `Saved.${matched}` }
}

export async function matchTrackAction(campaignId: string, trackId: string): Promise<MusicFormState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=music`)
  const provider = buildMusicProvider(env())
  try {
    const m = await matchTrack(db(), viewer.id, trackId, provider)
    revalidatePath(`/admin/campaigns/${campaignId}`)
    return m.ok
      ? { ok: `Found "${m.title}"${m.artist ? ` by ${m.artist}` : ''}. Confirm it if it is the right song.` }
      : { error: m.message }
  } catch (e) {
    return { error: `The provider could not be asked: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function confirmMatchAction(campaignId: string, trackId: string): Promise<MusicFormState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=music`)
  await confirmTrackMatch(db(), viewer.id, trackId)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: 'Confirmed. The history from before launch is pulled within the hour.' }
}

export async function addManualMetricAction(
  campaignId: string,
  trackId: string,
  _prev: MusicFormState,
  f: FormData,
): Promise<MusicFormState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=music`)
  const [source, metric] = text(f, 'what').split(':')
  const r = await addManualMetric(db(), viewer.id, {
    trackId,
    source: source ?? '',
    metric: metric ?? '',
    periodStart: text(f, 'periodStart'),
    periodEnd: text(f, 'periodEnd'),
    value: text(f, 'value'),
    country: text(f, 'country'),
    city: text(f, 'city'),
    note: text(f, 'note'),
  })
  if (!r.ok) return { error: 'Check the fields marked below.', fields: r.errors }
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: 'Number saved. The client report shows it within a minute.' }
}

export async function deleteManualMetricAction(campaignId: string, id: string): Promise<MusicFormState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=music`)
  await deleteManualMetric(db(), viewer.id, id)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: 'Number removed.' }
}

export async function addChartEntryAction(
  campaignId: string,
  trackId: string,
  _prev: MusicFormState,
  f: FormData,
): Promise<MusicFormState> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=music`)
  const r = await addChartEntry(db(), viewer.id, {
    trackId,
    date: text(f, 'date'),
    chartPlatform: text(f, 'chartPlatform'),
    chartName: text(f, 'chartName'),
    country: text(f, 'country'),
    city: text(f, 'city'),
    position: text(f, 'position'),
  })
  if (!r.ok) return { error: 'Check the fields marked below.', fields: r.errors }
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: 'Chart place saved.' }
}

/**
 * Whether Soundcharts numbers may appear on client reports. Admin only, audited (updateSetting). Only to be
 * switched on once Soundcharts has given written permission (its terms: https://www.soundcharts.com/en/terms).
 */
export async function setSoundchartsDisplayAction(campaignId: string, allowed: boolean): Promise<MusicFormState> {
  const viewer = await requireStaff('admin', `/admin/campaigns/${campaignId}?tab=music`)
  const cur = await getSetting(db(), 'music_client_display_allowed')
  await updateSetting(db(), viewer.id, 'music_client_display_allowed', { ...cur, soundcharts: allowed })
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return {
    ok: allowed
      ? 'Soundcharts numbers now show on client reports, marked "Source: www.soundcharts.com".'
      : 'Soundcharts numbers no longer show on client reports. Staff still see them here.',
  }
}
