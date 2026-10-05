import 'server-only'
import { env } from '@mde/config'
import { YOUTUBE_API, YouTubeApiProvider, type GoogleClient } from '@mde/platforms'

export const OAUTH_STATE_COOKIE = 'mde_oauth_state'

// Test overrides for Google's endpoints. Honoured only outside production or with MOCK_PROVIDER=1 (CI),
// so a real deploy always talks to Google.
const testing = process.env.NODE_ENV !== 'production' || process.env.MOCK_PROVIDER === '1'
export const googleTokenUrl = () => (testing && process.env.GOOGLE_TOKEN_URL_OVERRIDE) || undefined
export const youtubeApiBase = () => (testing && process.env.YOUTUBE_API_URL_OVERRIDE) || YOUTUBE_API

/** The Google client for linking YouTube, or null when login linking is not set up. */
export function youtubeLogin(): { client: GoogleClient; encryptionKey: string } | null {
  const e = env()
  if (!e.AUTH_GOOGLE_ID || !e.AUTH_GOOGLE_SECRET || !e.TOKEN_ENCRYPTION_KEY) return null
  return {
    client: {
      clientId: e.AUTH_GOOGLE_ID,
      clientSecret: e.AUTH_GOOGLE_SECRET,
      redirectUri: `${e.APP_URL}/api/oauth/youtube/callback`,
      tokenUrl: googleTokenUrl(),
    },
    encryptionKey: e.TOKEN_ENCRYPTION_KEY,
  }
}

export function youtubeProvider() {
  return new YouTubeApiProvider(env().YOUTUBE_API_KEY, fetch, youtubeApiBase())
}
