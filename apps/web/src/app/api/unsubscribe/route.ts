import { db } from '@mde/db'
import { setPreferences, verifyPreferencesToken } from '@mde/notifications'
import { NextResponse, type NextRequest } from 'next/server'

// One-click unsubscribe for mail clients (RFC 8058): a POST turns notification emails off.
export async function POST(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') ?? ''
  const t = req.nextUrl.searchParams.get('t') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(u) || !verifyPreferencesToken(u, t))
    return NextResponse.json({ error: { code: 'invalid_link', message: 'This link is not valid.' } }, { status: 400 })
  await setPreferences(db(), u, { email: false })
  return NextResponse.json({ ok: true })
}

// Opening the link in a browser shows the preferences page instead of changing anything.
export async function GET(req: NextRequest) {
  const url = new URL('/email-preferences', req.nextUrl)
  url.search = req.nextUrl.search
  return NextResponse.redirect(url, 303)
}
