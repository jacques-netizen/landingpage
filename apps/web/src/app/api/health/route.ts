import { db } from '@mde/db'
import { sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// For the host's health check: the app is up and can reach its database. With ?hosts=1 it also shows
// which address headers reached the app, to check the domain setup (nothing secret).
export async function GET(req: NextRequest) {
  const hosts = req.nextUrl.searchParams.get('hosts')
    ? {
        host: req.headers.get('host'),
        xForwardedHost: req.headers.get('x-forwarded-host'),
        forwarded: req.headers.get('forwarded'),
        viaCloudflare: !!req.headers.get('cf-ray'),
        appUrl: process.env.APP_URL ?? null,
        brandHost: process.env.BRAND_HOST ?? null,
      }
    : undefined
  try {
    await db().execute(sql`select 1`)
    return NextResponse.json({ ok: true, ...(hosts ? { hosts } : {}) })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
