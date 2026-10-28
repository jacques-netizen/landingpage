import { NextResponse } from 'next/server'
import { OPENAPI } from '@/developers/openapi'
import { apiBase } from '@/server/partner-api'

// The API's OpenAPI 3.1 description, public like the docs.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { ...OPENAPI, servers: [{ url: `${apiBase()}/api/v1`, description: 'Live and sandbox (the key decides)' }] },
    { headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' } },
  )
}
