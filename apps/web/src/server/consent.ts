import 'server-only'
import { env } from '@mde/config'
import crypto from 'node:crypto'

// Sign up records the terms and privacy tick before the account exists. They travel
// to account creation in a short-lived signed cookie, and are stored with their time on the user.
export const CONSENT_COOKIE = 'mde_signup_consent'
const MAX_AGE_SECONDS = 30 * 60

const sign = (payload: string) => crypto.createHmac('sha256', env().AUTH_SECRET).update(payload).digest('base64url')

export function makeConsentCookie(now = new Date()) {
  const payload = String(now.getTime())
  return {
    name: CONSENT_COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE_SECONDS,
    },
  }
}

/** The time the person ticked the box, if the cookie is genuine and fresh. */
export function readConsent(value: string | undefined): Date | null {
  if (!value) return null
  const [payload, sig] = value.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  const at = Number(payload)
  if (!Number.isSafeInteger(at) || Date.now() - at > MAX_AGE_SECONDS * 1000 || at > Date.now() + 60_000) return null
  return new Date(at)
}
