import type { MusicDataProvider } from './types'

// MUSIC_DATA_PROVIDER=none, or no credentials: nothing from a provider. Sound counts from Scrape Creators
// and the numbers staff type in still work.
export class NoMusicProvider implements MusicDataProvider {
  readonly name = 'none' as const
  readonly requests = 0
  async resolveTrack() {
    return null
  }
  async getTrackSeries() {
    return []
  }
  async getArtistSeries() {
    return []
  }
  supportedTrackMetrics() {
    return []
  }
  supportedArtistMetrics() {
    return []
  }
}
