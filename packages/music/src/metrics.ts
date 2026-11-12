// Metric and source names for music tracking (owner, 2026-11-12). Safe in the browser.

export const TRACK_METRICS = [
  'spotify_streams',
  'spotify_saves',
  'spotify_track_listeners',
  'streams_algorithmic',
  'streams_editorial',
  'streams_listener_own',
  'streams_other',
  'spotify_playlist_count',
  'shazam_count',
  'apple_music_plays',
  'apple_music_listeners',
  'tiktok_sound_video_count',
  'instagram_audio_reel_count',
  'youtube_views',
] as const
export const ARTIST_METRICS = [
  'spotify_monthly_listeners',
  'spotify_followers',
  'tiktok_followers',
  'instagram_followers',
  'youtube_subscribers',
] as const
export type TrackMetric = (typeof TRACK_METRICS)[number]
export type ArtistMetric = (typeof ARTIST_METRICS)[number]
export type Metric = TrackMetric | ArtistMetric

export const SOURCES = [
  'soundcharts',
  'scrapecreators',
  'spotify_for_artists_manual',
  'apple_music_for_artists_manual',
  'manual',
] as const
export type Source = (typeof SOURCES)[number]
/** Sources staff type in. They win over a provider's number for the same metric, day and place. */
export const MANUAL_SOURCES: Source[] = ['spotify_for_artists_manual', 'apple_music_for_artists_manual', 'manual']

export const METRIC_LABEL: Record<Metric, string> = {
  spotify_streams: 'Spotify streams',
  spotify_saves: 'Spotify saves',
  spotify_track_listeners: 'Spotify listeners of the song',
  streams_algorithmic: "Streams from Spotify's own recommendations",
  streams_editorial: 'Streams from Spotify editorial playlists',
  streams_listener_own: "Streams from listeners' own playlists and library",
  streams_other: 'Other streams',
  spotify_playlist_count: 'Spotify playlists',
  shazam_count: 'Shazams',
  apple_music_plays: 'Apple Music plays',
  apple_music_listeners: 'Apple Music listeners',
  tiktok_sound_video_count: 'TikTok videos using the sound',
  instagram_audio_reel_count: 'Instagram Reels using the audio',
  youtube_views: 'YouTube views on the official video',
  spotify_monthly_listeners: 'Spotify monthly listeners',
  spotify_followers: 'Spotify followers',
  tiktok_followers: 'TikTok followers',
  instagram_followers: 'Instagram followers',
  youtube_subscribers: 'YouTube subscribers',
}

/** The line under a block. Soundcharts' wording is the one its terms ask for. */
export const SOURCE_LINE: Record<Source, string> = {
  soundcharts: 'Source: www.soundcharts.com',
  scrapecreators: 'Source: TikTok public sound page',
  spotify_for_artists_manual: 'Source: Spotify for Artists',
  apple_music_for_artists_manual: 'Source: Apple Music for Artists',
  manual: "Source: entered by Maison d'Élites",
}

export const SOURCE_LABEL: Record<Source, string> = {
  soundcharts: 'Soundcharts',
  scrapecreators: 'Scrape Creators',
  spotify_for_artists_manual: 'Spotify for Artists (typed in)',
  apple_music_for_artists_manual: 'Apple Music for Artists (typed in)',
  manual: 'Typed in by staff',
}

export const CHART_PLATFORMS = ['spotify', 'apple_music', 'shazam', 'youtube', 'tiktok', 'other'] as const
export const CHART_PLATFORM_LABEL: Record<(typeof CHART_PLATFORMS)[number], string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  shazam: 'Shazam',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  other: 'Other',
}

/** Metrics staff may type in from Spotify for Artists or Apple Music for Artists. */
export const MANUAL_METRICS: { source: Source; metrics: Metric[] }[] = [
  {
    source: 'spotify_for_artists_manual',
    metrics: [
      'spotify_streams',
      'spotify_track_listeners',
      'spotify_saves',
      'streams_algorithmic',
      'streams_editorial',
      'streams_listener_own',
      'streams_other',
      'spotify_playlist_count',
      'spotify_monthly_listeners',
      'spotify_followers',
    ],
  },
  { source: 'apple_music_for_artists_manual', metrics: ['shazam_count', 'apple_music_plays', 'apple_music_listeners'] },
  {
    source: 'manual',
    metrics: [
      'instagram_audio_reel_count',
      'youtube_views',
      'tiktok_followers',
      'instagram_followers',
      'youtube_subscribers',
    ],
  },
]

export const isArtistMetric = (m: string): m is ArtistMetric => (ARTIST_METRICS as readonly string[]).includes(m)
export const isMetric = (m: string): m is Metric =>
  (TRACK_METRICS as readonly string[]).includes(m) || isArtistMetric(m)

/**
 * Metrics counted over a period (streams in a day or a week). A provider may give them as a running
 * total (is_cumulative); typed rows give the count for their day or week. Every other metric is a level
 * read on a day (followers, listeners, videos using the sound so far).
 */
export const FLOW_METRICS: Metric[] = [
  'spotify_streams',
  'spotify_saves',
  'streams_algorithmic',
  'streams_editorial',
  'streams_listener_own',
  'streams_other',
  'shazam_count',
  'apple_music_plays',
]
export const isFlowMetric = (m: string) => (FLOW_METRICS as string[]).includes(m)
