import { NoMusicProvider } from './none'
import { SoundchartsProvider } from './soundcharts'
import type { MusicDataProvider } from './types'

export * from './types'
export { NoMusicProvider } from './none'
export { SoundchartsProvider, SOUNDCHARTS_API } from './soundcharts'

/** The provider MUSIC_DATA_PROVIDER names. Missing credentials give the empty provider, never an error. */
export function buildMusicProvider(e: {
  MUSIC_DATA_PROVIDER?: string
  SOUNDCHARTS_APP_ID?: string
  SOUNDCHARTS_API_KEY?: string
}): MusicDataProvider {
  if (e.MUSIC_DATA_PROVIDER === 'soundcharts' && e.SOUNDCHARTS_APP_ID && e.SOUNDCHARTS_API_KEY)
    return new SoundchartsProvider(e.SOUNDCHARTS_APP_ID, e.SOUNDCHARTS_API_KEY)
  return new NoMusicProvider()
}
