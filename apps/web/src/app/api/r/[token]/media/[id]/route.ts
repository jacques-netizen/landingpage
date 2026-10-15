import { db, tables } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { mediaGone, streamClipMedia } from '@/server/clip-media'
import { campaignForReportToken } from '@/server/report'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// A clip's video file or picture for the client report (owner request, 2026-10-12), open to anyone
// with the report link. The streaming itself is shared with the staff admin (server/clip-media.ts).
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  const campaign = await campaignForReportToken(token)
  if (!campaign || !/^[0-9a-f-]{36}$/.test(id)) return mediaGone()
  const kind = req.nextUrl.searchParams.get('kind') === 'image' ? 'image' : 'video'
  const [s] = await db()
    .select({
      id: tables.submissions.id,
      platform: tables.submissions.platform,
      postUrl: tables.submissions.postUrl,
      platformPostId: tables.submissions.platformPostId,
      videoUrl: tables.submissions.videoUrl,
      thumbnailUrl: tables.submissions.thumbnailUrl,
    })
    .from(tables.submissions)
    .where(and(eq(tables.submissions.id, id), eq(tables.submissions.campaignId, campaign.id)))
  if (!s) return mediaGone()
  return streamClipMedia(s, kind, req.headers.get('range'), campaign.demo)
}
