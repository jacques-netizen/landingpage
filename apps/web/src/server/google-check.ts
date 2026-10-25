import 'server-only'
import { env } from '@mde/config'
import { redis } from './rate-limit'

// Whether Google accepts the app's two Google addresses (owner report, 2026-10-25: clippers got
// "Error 400: redirect_uri_mismatch" because the addresses were not registered on the Google client).
// The app asks Google the same question a browser does and reads the answer. The result is kept for
// 15 minutes. While Google rejects an address, the button that would lead there is hidden and staff are
// warned on the admin home and in the health check, so nobody hits Google's error page.

export type GoogleCheck = {
  checkedAt: string
  /** Sign in and sign up with Google. null when Google could not be reached (nothing is hidden then). */
  signIn: boolean | null
  /** Linking a YouTube channel by logging in with Google. */
  youtube: boolean | null
  /** The addresses Google refused, to add to the client's authorised redirect URIs. */
  rejected: string[]
}

const KEY = 'mde:google-check'
const TTL_SECONDS = 15 * 60
let memo: { at: number; value: GoogleCheck } | null = null

export const googleRedirects = () => {
  const app = env().APP_URL.replace(/\/$/, '')
  return { signIn: `${app}/api/auth/callback/google`, youtube: `${app}/api/oauth/youtube/callback` }
}

/** true: Google accepts the address; false: Google says redirect_uri_mismatch; null: no clear answer. */
async function accepts(clientId: string, redirectUri: string): Promise<boolean | null> {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email')
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8_000), cache: 'no-store' })
    const body = await res.text()
    if (body.includes('redirect_uri_mismatch')) return false
    return res.ok ? true : null
  } catch {
    return null
  }
}

async function run(): Promise<GoogleCheck> {
  const e = env()
  const now = new Date().toISOString()
  if (!e.AUTH_GOOGLE_ID) return { checkedAt: now, signIn: null, youtube: null, rejected: [] }
  const r = googleRedirects()
  const [signIn, youtube] = await Promise.all([
    accepts(e.AUTH_GOOGLE_ID, r.signIn),
    accepts(e.AUTH_GOOGLE_ID, r.youtube),
  ])
  const rejected = [signIn === false ? r.signIn : null, youtube === false ? r.youtube : null].filter(
    (x): x is string => !!x,
  )
  if (rejected.length)
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'google rejects the app redirect addresses',
        rejected,
        clientId: e.AUTH_GOOGLE_ID,
      }),
    )
  return { checkedAt: now, signIn, youtube, rejected }
}

/** The latest check, run again when it is over 15 minutes old. Never throws. */
export async function googleCheck(): Promise<GoogleCheck> {
  if (memo && Date.now() - memo.at < TTL_SECONDS * 1000) return memo.value
  try {
    const hit = await redis().get(KEY)
    if (hit) {
      const value = JSON.parse(hit) as GoogleCheck
      memo = { at: new Date(value.checkedAt).getTime(), value }
      if (Date.now() - memo.at < TTL_SECONDS * 1000) return value
    }
  } catch {
    // No Redis: check directly.
  }
  const value = await run()
  memo = { at: Date.now(), value }
  redis()
    .set(KEY, JSON.stringify(value), 'EX', TTL_SECONDS)
    .catch(() => undefined)
  return value
}
