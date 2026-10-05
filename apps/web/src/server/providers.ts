import 'server-only'
import { env } from '@mde/config'
import { buildProviderRouter, type ProviderRouter } from '@mde/platforms'
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
