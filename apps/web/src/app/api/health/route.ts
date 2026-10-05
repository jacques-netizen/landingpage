import { db } from '@mde/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// For the host's health check: the app is up and can reach its database.
export async function GET() {
  try {
    await db().execute(sql`select 1`)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
