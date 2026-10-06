import type { NextRequest } from 'next/server'
import { serveFile } from '@/server/storage'

// Uploaded campaign covers and assets. Public, like the campaigns that show them.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await params
  const res = await serveFile(id, req.headers.get('range'))
  return res ?? new Response('Not found', { status: 404 })
}
