import { env } from '@mde/config'
import { db, tables } from '@mde/db'
import type { Platform } from '@mde/platforms'
import { and, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { providers } from '@/server/providers'
import { campaignForReportToken } from '@/server/report'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// A clip's video file or picture for the client report, streamed through the app (owner request,
// 2026-10-12: the report shows the video itself, not the platform's widget). The platforms' file links
// expire and refuse browsers that come from another site, so the app fetches them itself and asks the
// provider for fresh links when a stored one has stopped working. Byte ranges pass through so the
// player can seek.

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']

function upstream(url: string, range: string | null) {
  const headers: Record<string, string> = { 'user-agent': UA, accept: '*/*' }
  if (range) headers.range = range
  // Seed and uploaded pictures are paths on this app.
  return fetch(new URL(url, env().APP_URL), { headers, redirect: 'follow', cache: 'no-store' })
}

const gone = () =>
  new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } })

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  const campaign = await campaignForReportToken(token)
  if (!campaign || !/^[0-9a-f-]{36}$/.test(id)) return gone()
  const kind = req.nextUrl.searchParams.get('kind') === 'image' ? 'image' : 'video'
  const d = db()
  const [s] = await d
    .select({
      platform: tables.submissions.platform,
      postUrl: tables.submissions.postUrl,
      platformPostId: tables.submissions.platformPostId,
      videoUrl: tables.submissions.videoUrl,
      thumbnailUrl: tables.submissions.thumbnailUrl,
    })
    .from(tables.submissions)
    .where(and(eq(tables.submissions.id, id), eq(tables.submissions.campaignId, campaign.id)))
  if (!s) return gone()

  const range = req.headers.get('range')
  let url = kind === 'video' ? s.videoUrl : s.thumbnailUrl
  let res: Response | null = null
  if (url) {
    try {
      res = await upstream(url, range)
    } catch {
      res = null
    }
  }
  // A demo campaign's pictures are kept in our storage; it never spends provider credits here.
  if (!campaign.demo && (!res || !(res.status === 200 || res.status === 206))) {
    // The stored link has stopped working (or there was none): ask the platform for the post again.
    try {
      const post = await providers().fetchPost('bio_code', {
        platform: s.platform as Platform,
        postUrl: s.postUrl,
        platformPostId: s.platformPostId,
      })
      const fresh = kind === 'video' ? post.videoUrl : post.thumbnailUrl
      if (post.exists && (post.videoUrl || post.thumbnailUrl))
        await d
          .update(tables.submissions)
          .set({
            videoUrl: post.videoUrl ?? s.videoUrl,
            thumbnailUrl: post.thumbnailUrl ?? s.thumbnailUrl,
            mediaUpdatedAt: new Date(),
          })
          .where(eq(tables.submissions.id, id))
      if (fresh && fresh !== url) {
        url = fresh
        res = await upstream(url, range)
      }
    } catch (err) {
      console.error(JSON.stringify({ level: 'warn', msg: 'report media refresh failed', id, err: String(err) }))
    }
  }
  if (!res || !(res.status === 200 || res.status === 206) || !res.body) return gone()

  const headers = new Headers({
    'cache-control': 'private, max-age=3600',
    'x-robots-tag': 'noindex, nofollow',
    'accept-ranges': 'bytes',
  })
  for (const h of PASS) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  if (!headers.get('content-type')) headers.set('content-type', kind === 'video' ? 'video/mp4' : 'image/jpeg')
  return new NextResponse(res.body, { status: res.status, headers })
}
