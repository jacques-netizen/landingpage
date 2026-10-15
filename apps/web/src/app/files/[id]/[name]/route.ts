import { db, tables } from '@mde/db'
import { eq, or } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { serveFile } from '@/server/storage'
import { getViewer } from '@/server/viewer'

// Uploaded campaign covers and assets. Public, like the campaigns that show them. A view verification's
// recording or screenshot is the creator's own (owner brief, 2026-10-15: never shown to clients): only
// staff and the creator who sent it can open one.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await params
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const [proof] = await db()
      .select({ creatorId: tables.viewProofs.creatorId })
      .from(tables.viewProofs)
      .where(or(eq(tables.viewProofs.recordingFileId, id), eq(tables.viewProofs.screenshotFileId, id)))
      .limit(1)
    if (proof) {
      const viewer = await getViewer()
      if (!viewer || (viewer.id !== proof.creatorId && viewer.roles.length === 0))
        return new Response('Not found', { status: 404 })
    }
  }
  const res = await serveFile(id, req.headers.get('range'))
  return res ?? new Response('Not found', { status: 404 })
}
