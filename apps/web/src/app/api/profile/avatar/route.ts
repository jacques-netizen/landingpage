import { db, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/server/rate-limit'
import { saveUpload } from '@/server/storage'
import { getViewer } from '@/server/viewer'

const MAX = 5 * 1024 * 1024
const bad = (code: string, message: string, status = 400) => NextResponse.json({ error: { code, message } }, { status })

// The type is read from the file's first bytes, never from what the browser says.
function imageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP')
    return 'image/webp'
  return null
}

// A creator's profile picture (owner request, 2026-10-07): PNG, JPG or WebP up to 5 MB.
export async function POST(req: NextRequest) {
  const viewer = await getViewer()
  if (!viewer) return bad('unauthenticated', 'Sign in to continue.', 401)
  if (!(await rateLimit(`avatar:${viewer.id}`, 20, 3600)))
    return bad('rate_limited', 'Too many uploads. Try later.', 429)
  if (Number(req.headers.get('content-length') ?? 0) > MAX)
    return bad('too_large', 'That picture is too large. The limit is 5 MB.', 413)
  const data = new Uint8Array(await req.arrayBuffer())
  if (!data.length) return bad('empty', 'Choose a picture to upload.')
  if (data.length > MAX) return bad('too_large', 'That picture is too large. The limit is 5 MB.', 413)
  const type = imageType(data)
  if (!type) return bad('not_image', 'Choose a PNG, JPG or WebP picture.')
  const ext = type.split('/')[1]!.replace('jpeg', 'jpg')
  const file = await saveUpload(
    { name: `avatar.${ext}`, contentType: type, size: data.length, body: new Response(data).body! },
    viewer.id,
  )
  await db().update(tables.users).set({ image: file.url }).where(eq(tables.users.id, viewer.id))
  return NextResponse.json({ url: file.url })
}

export async function DELETE() {
  const viewer = await getViewer()
  if (!viewer) return bad('unauthenticated', 'Sign in to continue.', 401)
  await db().update(tables.users).set({ image: null }).where(eq(tables.users.id, viewer.id))
  return NextResponse.json({ ok: true })
}
