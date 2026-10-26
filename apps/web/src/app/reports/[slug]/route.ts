import type { NextRequest } from 'next/server'
import { clientIp } from '@/server/client-ip'
import { rateLimit } from '@/server/rate-limit'
import { internalBase, reportPdf } from '@/server/reports/pdf'
import { publicReport } from '@/server/reports/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// A published client report (owner brief, 2026-10-26): /reports/<artist>-week-<n> and
// /reports/<artist>-final, public with no login, never indexed. Add .pdf for the PDF.
const NOT_FOUND = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Report not found</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#15120D;color:#EFE7D5;font-family:Georgia,serif;text-align:center;padding:24px"><div><p style="letter-spacing:.04em">Maison <b style="color:#EBD69E;font-weight:500">d'&Eacute;lites</b></p><h1 style="font-weight:400">This report is not available.</h1><p style="color:#A09379">Ask your contact at Maison d'&Eacute;lites for the link.</p></div></body></html>`

const HEADERS = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' }

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params
  const pdf = raw.endsWith('.pdf')
  const slug = pdf ? raw.slice(0, -4) : raw
  if (!/^[a-z0-9-]{1,80}$/.test(slug))
    return new Response(NOT_FOUND, { status: 404, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' } })
  if (!pdf) {
    const page = await publicReport(slug, 'web')
    if (!page)
      return new Response(NOT_FOUND, {
        status: 404,
        headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' },
      })
    return new Response(page.html, { headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' } })
  }
  if (!(await rateLimit(`report-pdf:${await clientIp()}`, 20, 600)))
    return new Response('Too many downloads. Try again in a few minutes.', { status: 429, headers: HEADERS })
  const page = await publicReport(slug, 'print', internalBase())
  if (!page)
    return new Response(NOT_FOUND, { status: 404, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' } })
  try {
    const file = await reportPdf(page.cacheKey, page.html)
    return new Response(new Uint8Array(file), {
      headers: {
        ...HEADERS,
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${page.slug}.pdf"`,
      },
    })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'report pdf failed', slug, err: String(err) }))
    return new Response('The PDF could not be made just now. Try again in a minute.', { status: 503, headers: HEADERS })
  }
}
