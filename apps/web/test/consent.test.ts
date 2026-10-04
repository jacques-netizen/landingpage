import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeConsentCookie, readConsent } from '@/server/consent'

describe('sign-up consent cookie', () => {
  afterEach(() => vi.useRealTimers())

  it('round-trips the time both boxes were ticked', () => {
    const at = new Date()
    const c = makeConsentCookie(at)
    expect(readConsent(c.value)?.getTime()).toBe(at.getTime())
    expect(c.options.httpOnly).toBe(true)
  })

  it('rejects a tampered or forged value', () => {
    const c = makeConsentCookie()
    const [payload, sig] = c.value.split('.')
    expect(readConsent(`${Number(payload) - 1000}.${sig}`)).toBeNull()
    expect(readConsent(`${payload}.forged`)).toBeNull()
    expect(readConsent('')).toBeNull()
    expect(readConsent(undefined)).toBeNull()
  })

  it('expires after 30 minutes', () => {
    const c = makeConsentCookie(new Date())
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 31 * 60 * 1000)
    expect(readConsent(c.value)).toBeNull()
  })
})
