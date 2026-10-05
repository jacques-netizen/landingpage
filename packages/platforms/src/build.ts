import { MockProvider } from './mock'
import { ProviderRouter } from './router'
import { ScrapeCreatorsProvider } from './scrape-creators'
import type { ViewProvider } from './types'
import { YOUTUBE_API, YouTubeApiProvider } from './youtube'

/**
 * The providers in the order 03_SYSTEMS.md 3.1 lists them; the router falls back down the list.
 * The mock is included only when asked (development, and CI with MOCK_PROVIDER=1).
 */
export function buildProviderRouter(opts: {
  youtubeApiKey?: string
  youtubeApiBase?: string
  dataProviderApiKey?: string
  mock: boolean
}): ProviderRouter {
  const list: ViewProvider[] = []
  if (opts.youtubeApiKey)
    list.push(new YouTubeApiProvider(opts.youtubeApiKey, fetch, opts.youtubeApiBase ?? YOUTUBE_API))
  if (opts.dataProviderApiKey) list.push(new ScrapeCreatorsProvider(opts.dataProviderApiKey))
  if (opts.mock) list.push(new MockProvider())
  return new ProviderRouter(list)
}
