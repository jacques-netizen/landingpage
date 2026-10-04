import { NextResponse } from 'next/server'
import { requireStaffApi } from '@/server/guard'

// Staff API. Every handler checks the role itself as well as the proxy.
// No staff endpoints exist yet in Phase 0; `GET /api/v1/admin/me` reports the caller's roles.
async function handle(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const viewer = await requireStaffApi()
  if (viewer instanceof NextResponse) return viewer
  const { path = [] } = await ctx.params
  if (req.method === 'GET' && path.join('/') === 'me') return NextResponse.json({ id: viewer.id, roles: viewer.roles })
  return NextResponse.json({ error: { code: 'not_found', message: 'No such staff endpoint.' } }, { status: 404 })
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE }
