import { NextResponse } from 'next/server'
import { withStaff } from '@/lib/staff'

/**
 * Catch all for /api/v1/admin. Anything under this path is checked for a staff role before it is
 * looked up, so a missing route never leaks to a non staff caller. Real routes sit beside this file
 * and wrap their handlers in withStaff with the role they need.
 */
const notFound = withStaff('reviewer', () =>
  NextResponse.json({ error: { code: 'not_found', message: 'No such route.' } }, { status: 404 }),
)

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
