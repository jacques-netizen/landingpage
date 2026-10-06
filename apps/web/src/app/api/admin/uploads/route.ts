import { NextResponse, type NextRequest } from 'next/server'
import { requireStaffApi } from '@/server/guard'
import { maxUploadBytes, saveUpload, UploadTooLarge } from '@/server/storage'

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`

// Staff upload one file as the raw request body; the name comes in the x-file-name header.
export async function POST(req: NextRequest) {
  const viewer = await requireStaffApi('staff')
  if (viewer instanceof NextResponse) return viewer
  const size = Number(req.headers.get('content-length') ?? 0)
  const max = maxUploadBytes()
  if (!req.body || !size)
    return NextResponse.json({ error: { code: 'empty', message: 'Choose a file to upload.' } }, { status: 400 })
  if (size > max)
    return NextResponse.json(
      { error: { code: 'too_large', message: `That file is too large. The limit is ${mb(max)}.` } },
      { status: 413 },
    )
  try {
    const file = await saveUpload(
      {
        name: decodeURIComponent(req.headers.get('x-file-name') ?? 'file'),
        contentType: req.headers.get('content-type') ?? '',
        size,
        body: req.body,
      },
      viewer.id,
    )
    return NextResponse.json(file)
  } catch (e) {
    if (e instanceof UploadTooLarge)
      return NextResponse.json(
        { error: { code: 'too_large', message: `That file is too large. The limit is ${mb(max)}.` } },
        { status: 413 },
      )
    console.error(JSON.stringify({ level: 'error', msg: 'upload failed', err: String(e) }))
    return NextResponse.json(
      { error: { code: 'upload_failed', message: 'The upload failed. Try again.' } },
      { status: 502 },
    )
  }
}
