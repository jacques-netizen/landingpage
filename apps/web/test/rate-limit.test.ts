import { describe, expect, it } from 'vitest'
import { rateLimit } from '@/server/rate-limit'

// Needs the local Redis from REDIS_URL, like the other integration tests.
describe('rate limit', () => {
  it('allows up to the limit in a window, then refuses', async () => {
    const key = `test:${Date.now()}:${Math.random()}`
    const results = []
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60))
    expect(results).toEqual([true, true, true, false])
  })
})
