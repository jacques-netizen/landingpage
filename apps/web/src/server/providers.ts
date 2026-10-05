import 'server-only'
import { env } from '@mde/config'
import { MockProvider, ProviderRouter, type ViewProvider } from '@mde/platforms'
import { youtubeProvider } from './youtube'

const g = globalThis as unknown as { __mdeRouter?: ProviderRouter }

// Providers in the order 03_SYSTEMS.md 3.1 lists them; the router falls back down the list. The mock
// serves development, and a production build only when MOCK_PROVIDER=1 (CI end to end tests).
export function providers(): ProviderRouter {
  if (!g.__mdeRouter) {
    const list: ViewProvider[] = []
    if (env().YOUTUBE_API_KEY) list.push(youtubeProvider())
    if (process.env.NODE_ENV !== 'production' || process.env.MOCK_PROVIDER === '1') list.push(new MockProvider())
    g.__mdeRouter = new ProviderRouter(list)
  }
  return g.__mdeRouter
}
