import { campaignReportRows, clipForClient } from '@mde/campaigns'
import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { type NextRequest } from 'next/server'
import { campaignForReportToken, parseReportQuery } from '@/server/report'

export const dynamic = 'force-dynamic'

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

// The report's submissions as a CSV file (01_PRODUCT.md 8.3), in the list's current range, filters and order.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const campaign = await campaignForReportToken(token)
  if (!campaign) return new Response('This report link is no longer active.', { status: 404 })
  // At the client's rate, like the report page (owner rule, 2026-10-17).
  const rows = (await campaignReportRows(db(), campaign.id, parseReportQuery(req.nextUrl.searchParams))).map((r) =>
    clipForClient(r),
  )
  const lines = [
    ['Date', 'Platform', 'Clipper', 'Link', 'Status', 'Views', 'Likes', 'Comments', 'Shares', 'Spend', 'Payout']
      .map(cell)
      .join(','),
    ...rows.map((r) =>
      [
        r.submittedAt.slice(0, 10),
        r.platform,
        r.handle,
        r.url,
        r.status,
        r.views,
        r.likes,
        r.comments,
        r.shares,
        formatDollars(r.payoutCents),
        r.payout,
      ]
        .map(cell)
        .join(','),
    ),
  ]
  const name = `${campaign.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign'}-report.csv`
  // A byte order mark first, so spreadsheets read the accents correctly.
  return new Response(`${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
