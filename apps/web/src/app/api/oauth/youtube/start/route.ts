import { googleAuthUrl } from '@mde/platforms'
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getViewer } from '@/server/viewer'
import { OAUTH_STATE_COOKIE, youtubeLogin } from '@/server/youtube'

// Sends the signed-in creator to Google to approve read-only access to their YouTube channel.
export async function GET(req: Request) {
  const viewer = await getViewer()
  const back = new URL('/accounts', req.url)
  if (!viewer) return NextResponse.redirect(new URL('/sign-in?next=/accounts', req.url))
  const login = youtubeLogin()
  if (!login) {
    back.searchParams.set('error', 'youtube_unavailable')
    return NextResponse.redirect(back)
  }
  // The state ties Google's answer to this browser and this person.
  const state = `${viewer.id}.${crypto.randomBytes(16).toString('base64url')}`
  const res = NextResponse.redirect(googleAuthUrl(login.client, state))
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && new URL(req.url).protocol === 'https:',
    path: '/api/oauth',
    maxAge: 600,
  })
  return res
}
