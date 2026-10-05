import { db } from '@mde/db'
import { AccountError, exchangeGoogleCode, linkOAuthAccount } from '@mde/platforms'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getViewer } from '@/server/viewer'
import { OAUTH_STATE_COOKIE, youtubeLogin, youtubeProvider } from '@/server/youtube'

const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

// Google sends the creator back here. The code becomes tokens, the tokens give the creator's own
// channel, and the channel is linked as verified. Results go back to the accounts screen.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const back = new URL('/accounts', req.url)
  const fail = (code: string) => {
    back.searchParams.set('error', code)
    const res = NextResponse.redirect(back)
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/oauth' })
    return res
  }

  const viewer = await getViewer()
  if (!viewer) return NextResponse.redirect(new URL('/sign-in?next=/accounts', req.url))
  const login = youtubeLogin()
  if (!login) return fail('youtube_unavailable')

  const expected = (await cookies()).get(OAUTH_STATE_COOKIE)?.value ?? ''
  const state = url.searchParams.get('state') ?? ''
  if (!expected || !same(expected, state) || !state.startsWith(`${viewer.id}.`)) return fail('youtube_state')
  if (url.searchParams.get('error')) return fail('youtube_denied')
  const code = url.searchParams.get('code')
  if (!code) return fail('youtube_denied')

  try {
    const tokens = await exchangeGoogleCode(login.client, code)
    const profile = await youtubeProvider().fetchProfile({ platform: 'youtube', token: tokens.accessToken })
    if (!profile) return fail('youtube_no_channel')
    await linkOAuthAccount(db(), viewer.id, {
      platform: 'youtube',
      profile,
      tokens,
      encryptionKey: login.encryptionKey,
    })
  } catch (e) {
    if (e instanceof AccountError) return fail(e.code)
    console.error(JSON.stringify({ level: 'error', msg: 'youtube link failed', err: String(e) }))
    return fail('youtube_failed')
  }
  back.searchParams.set('linked', 'youtube')
  const res = NextResponse.redirect(back)
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/oauth' })
  return res
}
