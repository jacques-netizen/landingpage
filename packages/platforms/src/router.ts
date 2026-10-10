import {
  ProviderUnavailable,
  type LinkMethod,
  type Platform,
  type PostData,
  type ProfileData,
  type ViewProvider,
} from './types'

type Options = {
  timeoutMs?: number
  attempts?: number
  backoffMs?: number
  log?: (entry: Record<string, unknown>) => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        t = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
      }),
    ])
  } finally {
    clearTimeout(t)
  }
}

// Picks providers by platform and link method, in the given order, and falls back down the list.
// Every call has a 15 second timeout and up to 3 attempts with backoff; failures are logged
// (03_SYSTEMS.md 3.1). When every provider fails it throws ProviderUnavailable.
export class ProviderRouter {
  constructor(
    private providers: ViewProvider[],
    private opts: Options = {},
  ) {}

  private async call<T>(
    platform: Platform,
    method: LinkMethod,
    what: string,
    fn: (p: ViewProvider) => Promise<T>,
  ): Promise<T> {
    const {
      timeoutMs = 15_000,
      attempts = 3,
      backoffMs = 500,
      log = (e) => console.error(JSON.stringify(e)),
    } = this.opts
    const candidates = this.providers.filter((p) => p.supports(platform, method))
    for (const p of candidates) {
      for (let i = 1; i <= attempts; i++) {
        try {
          return await withTimeout(fn(p), timeoutMs)
        } catch (err) {
          log({
            level: 'warn',
            msg: 'provider call failed',
            provider: p.name,
            what,
            platform,
            attempt: i,
            err: String(err),
          })
          if (i < attempts) await sleep(backoffMs * 2 ** (i - 1))
        }
      }
    }
    throw new ProviderUnavailable(
      candidates.length ? `No provider could ${what} right now.` : `No provider supports ${platform} by ${method}.`,
      candidates.map((p) => p.name).join(',') || 'none',
      candidates.length ? 'failed' : 'none_configured',
    )
  }

  /** The names of the providers that can answer for this platform and link method, in order. */
  supporting(platform: Platform, method: LinkMethod): string[] {
    return this.providers.filter((p) => p.supports(platform, method)).map((p) => p.name)
  }

  fetchProfile(method: LinkMethod, input: Parameters<ViewProvider['fetchProfile']>[0]): Promise<ProfileData | null> {
    return this.call(input.platform, method, 'fetch the profile', (p) => p.fetchProfile(input))
  }

  fetchPost(method: LinkMethod, input: Parameters<ViewProvider['fetchPost']>[0]): Promise<PostData> {
    return this.call(input.platform, method, 'fetch the post', async (p) => ({
      ...(await p.fetchPost(input)),
      source: `provider:${p.name}`,
    }))
  }
}
