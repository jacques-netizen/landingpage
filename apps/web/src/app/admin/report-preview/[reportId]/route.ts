import type { NextRequest } from 'next/server'
import { requireStaffApi } from '@/server/guard'
import { previewHtml } from '@/server/reports/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The report as the client will see it, for the editor's preview (staff only). ?v= shows another version,
// ?print=1 the PDF layout.
export async function GET(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const viewer = await requireStaffApi('money')
  if (viewer instanceof Response) return viewer
  const { reportId } = await params
  const v = req.nextUrl.searchParams.get('v')
  const html = await previewHtml(
    reportId,
    v && /^[0-9a-f-]{36}$/i.test(v) ? v : null,
    req.nextUrl.searchParams.get('print') ? 'print' : 'web',
  )
  if (!html) return new Response('Not found', { status: 404 })
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  })
}
