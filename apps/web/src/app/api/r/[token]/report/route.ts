import { NextResponse, type NextRequest } from 'next/server'
import { cachedReport, campaignForReportToken, parseReportQuery } from '@/server/report'

export const dynamic = 'force-dynamic'

// The report page's data (client report brief, 2026-10-12): one JSON document per token and query,
// cached for 60 seconds. The page fetches it every 2 minutes while open.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
  return NextResponse.json(report, { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } })
}
