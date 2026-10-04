import 'server-only'
import type { Access } from '@mde/config'
import { forbidden, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { getViewer, hasAccess, type Viewer } from './viewer'

/** For staff pages and server actions: the viewer, or a redirect to sign in, or a 403. */
export async function requireStaff(access: Access = 'staff', next = '/admin'): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  if (!hasAccess(viewer, access)) forbidden()
  return viewer
}

/** For staff API routes: the viewer, or a JSON error response to return as is. */
export async function requireStaffApi(access: Access = 'staff'): Promise<Viewer | NextResponse> {
  const viewer = await getViewer()
  if (!viewer)
    return NextResponse.json({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }, { status: 401 })
  if (!hasAccess(viewer, access))
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'You do not have access to this.' } },
      { status: 403 },
    )
  return viewer
}
