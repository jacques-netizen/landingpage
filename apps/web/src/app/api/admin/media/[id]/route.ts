import { db, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { mediaGone, streamClipMedia } from '@/server/clip-media'
import { requireStaffApi } from '@/server/guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// A clip's video file or picture for the staff admin (owner brief, 2026-10-15: clips play inside the
// admin). Staff only; the streaming is shared with the client report (server/clip-media.ts).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaffApi('staff')
  if (viewer instanceof Response) return viewer
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return mediaGone()
  const kind = req.nextUrl.searchParams.get('kind') === 'image' ? 'image' : 'video'
  const [row] = await db()
    .select({
      id: tables.submissions.id,
      platform: tables.submissions.platform,
      postUrl: tables.submissions.postUrl,
      platformPostId: tables.submissions.platformPostId,
      videoUrl: tables.submissions.videoUrl,
      thumbnailUrl: tables.submissions.thumbnailUrl,
      demo: tables.campaigns.demo,
    })
    .from(tables.submissions)
    .innerJoin(tables.campaigns, eq(tables.campaigns.id, tables.submissions.campaignId))
    .where(eq(tables.submissions.id, id))
  if (!row) return mediaGone()
  const { demo, ...s } = row
  return streamClipMedia(s, kind, req.headers.get('range'), demo)
}
