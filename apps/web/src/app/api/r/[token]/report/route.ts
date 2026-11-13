import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { cachedReport, campaignForReportToken, parseReportQuery } from '@/server/report'
import { limitVisitor } from '@/server/rate-limit'

export const dynamic = 'force-dynamic'

// The report page's data (client report brief, 2026-10-12): one JSON document per token and query,
// cached for 60 seconds. The page asks again every 2 minutes while open; when nothing changed it gets a
// 304 with no body (owner, 2026-11-11: no needless polling), so an unchanged report costs almost nothing.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limited = await limitVisitor('report-data', 120, 60)
  if (limited) return limited
  const { token } = await params
  const campaign = await campaignForReportToken(token)
  if (!campaign)
    return NextResponse.json(
      { error: { code: 'inactive', message: 'This report link is no longer active.' } },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    )
  const report = await cachedReport(token, campaign.id, parseReportQuery(req.nextUrl.searchParams))
  if (!report)
    return NextResponse.json(
      { error: { code: 'inactive', message: 'This report link is no longer active.' } },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    )
  const body = JSON.stringify(report)
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`
  const headers = { etag, 'cache-control': 'private, no-cache', 'x-robots-tag': 'noindex, nofollow' }
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(body, { headers: { ...headers, 'content-type': 'application/json' } })
}
