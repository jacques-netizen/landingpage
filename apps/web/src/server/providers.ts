import 'server-only'
import { env } from '@mde/config'
import { buildProviderRouter, type Platform, type ProviderRouter } from '@mde/platforms'
import { youtubeApiBase } from './youtube'

const g = globalThis as unknown as { __mdeRouter?: ProviderRouter }

// YouTube by API key, TikTok, Instagram and X through the data provider, and the mock in development
// (or a production build with MOCK_PROVIDER=1, CI only).
export function providers(): ProviderRouter {
  if (!g.__mdeRouter) {
    const e = env()
    g.__mdeRouter = buildProviderRouter({
      youtubeApiKey: e.YOUTUBE_API_KEY,
      youtubeApiBase: youtubeApiBase(),
      dataProviderApiKey: e.DATA_PROVIDER_API_KEY,
      mock: process.env.NODE_ENV !== 'production' || process.env.MOCK_PROVIDER === '1',
    })
  }
  return g.__mdeRouter
}

/** The providers that answer for each platform, for the health check and the staff dashboard. */
export function providerStatus(): Record<Platform, string[]> {
  const r = providers()
  return {
    youtube: [...new Set([...r.supporting('youtube', 'oauth'), ...r.supporting('youtube', 'bio_code')])],
    tiktok: r.supporting('tiktok', 'bio_code'),
    instagram: r.supporting('instagram', 'bio_code'),
    x: r.supporting('x', 'bio_code'),
  }
}

/** Platforms no provider answers for: posts there are kept for review without their stats. */
export function platformsWithoutProvider(): Platform[] {
  return (Object.entries(providerStatus()) as [Platform, string[]][]).filter(([, p]) => !p.length).map(([k]) => k)
}
