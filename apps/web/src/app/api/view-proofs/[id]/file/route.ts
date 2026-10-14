import { db, tables } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/server/rate-limit'
import { maxUploadBytes, saveUpload, UploadTooLarge } from '@/server/storage'
import { getViewer } from '@/server/viewer'

export const runtime = 'nodejs'

// The screenshot and screen recording for a view proof (owner request, 2026-10-14). The file type is
// read from its first bytes, never from what the browser says. The proof must be the creator's own and
// still open. Pictures up to 10 MB; recordings up to the storage limit, 200 MB at most.
const IMAGE_MAX = 10 * 1024 * 1024
const VIDEO_MAX = 200 * 1024 * 1024
const bad = (code: string, message: string, status = 400) => NextResponse.json({ error: { code, message } }, { status })

function imageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP')
    return 'image/webp'
  return null
}

function videoType(b: Uint8Array): string | null {
  const tag = String.fromCharCode(...b.slice(4, 8))
  if (tag === 'ftyp') {
    const brand = String.fromCharCode(...b.slice(8, 12))
    return brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4'
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) return bad('unauthenticated', 'Sign in to continue.', 401)
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad('not_found', 'This proof was not found.', 404)
  if (!(await rateLimit(`proof-upload:${viewer.id}`, 30, 3600)))
    return bad('rate_limited', 'Too many uploads. Try later.', 429)
  const kind = req.nextUrl.searchParams.get('kind') === 'recording' ? 'recording' : 'screenshot'
  const [p] = await db()
    .select({ status: tables.viewProofs.status })
    .from(tables.viewProofs)
    .where(and(eq(tables.viewProofs.id, id), eq(tables.viewProofs.creatorId, viewer.id)))
  if (!p) return bad('not_found', 'This proof was not found.', 404)
  if (p.status !== 'requested') return bad('wrong_state', 'This proof was already sent.')

  const max = kind === 'recording' ? Math.min(VIDEO_MAX, maxUploadBytes()) : IMAGE_MAX
  const limitText =
    kind === 'recording'
      ? `That recording is too large. The limit is ${Math.floor(max / (1024 * 1024))} MB. Keep it under 90 seconds.`
      : 'That picture is too large. The limit is 10 MB.'
  if (Number(req.headers.get('content-length') ?? 0) > max) return bad('too_large', limitText, 413)
  const data = new Uint8Array(await req.arrayBuffer())
  if (!data.length)
    return bad('empty', kind === 'recording' ? 'Choose the screen recording.' : 'Choose the screenshot.')
  if (data.length > max) return bad('too_large', limitText, 413)
  const type = kind === 'recording' ? videoType(data) : imageType(data)
  if (!type)
    return bad(
      'bad_type',
      kind === 'recording' ? 'Choose an MP4, MOV or WebM screen recording.' : 'Choose a PNG, JPG or WebP screenshot.',
    )
  const ext = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  }[type]
  try {
    const file = await saveUpload(
      { name: `proof-${kind}.${ext}`, contentType: type, size: data.length, body: new Response(data).body! },
      viewer.id,
    )
    return NextResponse.json({ fileId: file.id, url: file.url })
  } catch (e) {
    if (e instanceof UploadTooLarge) return bad('too_large', limitText, 413)
    throw e
  }
}
